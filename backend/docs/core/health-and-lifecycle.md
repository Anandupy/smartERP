# Health Checks & Process Lifecycle

---

## 1. Probes

Three endpoints, because an orchestrator asks three different questions. They
are **unversioned** (`VERSION_NEUTRAL`): URI versioning defaults to `v1`, and a
probe path should not move when the API version does.

| Endpoint      | Question                         | Checks         | Failure |
| :------------ | :------------------------------- | :------------- | :------ |
| `GET /live`   | Is the process alive?            | Nothing        | —       |
| `GET /ready`  | Can this instance serve traffic? | Database       | 503     |
| `GET /health` | Full report                      | Database, heap | 503     |

All three are `@Public()` and `@SkipThrottle()`. Probes run continuously; rate
limiting them into a 429 would read as an outage.

### Why `/live` checks nothing

A liveness probe that checks the database restarts every healthy instance during
a database blip — turning a partial outage into a total one, and adding restart
storms to a database that is already struggling.

Liveness answers "is this process wedged?". Readiness answers "should traffic
come here?". Only readiness should depend on a dependency.

### Database check

`SELECT 1`, with a 3 second timeout.

A pooled connection can look healthy while the server behind it is gone, so the
check issues a real query rather than inspecting the pool. The timeout matters
as much as the query: an unbounded query against an unreachable server leaves
the probe pending until the client gives up, which an orchestrator reads as "no
answer" rather than "unhealthy" — a slower and less specific signal.

### Example

```jsonc
// GET /ready
{
  "status": "ok",
  "info": { "database": { "status": "up", "responseTimeMs": 3 } },
  "error": {},
  "details": { "database": { "status": "up", "responseTimeMs": 3 } },
}
```

The terminus payload is wrapped by `GlobalResponseInterceptor` like every other
response, so the structure above appears under `data`:

```jsonc
{ "success": true, "message": "Success", "data": { "status": "ok", "info": { … } }, … }
```

A probe that only checks the HTTP status — which is what Kubernetes and most
load balancers do — is unaffected. A monitor that parses the body must read
`data`.

---

## 2. Graceful shutdown

`main.ts` calls `app.enableShutdownHooks()` before `listen`. On `SIGTERM` or
`SIGINT` Nest stops accepting connections, lets in-flight requests finish, then
runs `OnModuleDestroy` / `OnApplicationShutdown` across the module graph:

| Hook                    | Component                | Action                                       |
| :---------------------- | :----------------------- | :------------------------------------------- |
| `OnModuleDestroy`       | `PrismaService`          | `$disconnect()` — returns pooled connections |
| `OnApplicationShutdown` | `LoggerLifecycleService` | Flushes and closes `app.log` / `error.log`   |

Without the hooks, `SIGTERM` killed the process mid-request and dropped whatever
was still buffered in the log streams — which is exactly when the last few lines
matter most.

Deployments should give the container enough termination grace to let in-flight
requests drain; the default 30 seconds is comfortably more than this service
needs.

---

## 3. Logger lifecycle

`LoggerService` is `Scope.TRANSIENT` so each injecting class can label its
output through `setContext`. That is the right scope for the label, but it used
to mean the entire logger was rebuilt per injection: every consumer created its
own pino instance, its own `pino-pretty` transform, and its own write streams to
`app.log` and `error.log`.

With around forty consumers that is roughly a hundred file descriptors against
two files, plus interleaved writes from independent streams competing for the
same offsets.

The split is now explicit:

| Concern                                 | Lifetime      | Where                    |
| :-------------------------------------- | :------------ | :----------------------- |
| pino instance, transforms, file streams | Process       | `pino-root-logger.ts`    |
| Context label                           | Per injection | `LoggerService`          |
| Stream teardown                         | Process       | `LoggerLifecycleService` |

`LoggerLifecycleService` is a singleton on purpose. Hooking shutdown on the
transient logger would run teardown once per injected instance, each closing
files the others were still writing to.

### `LOG_DIR`

Now honoured. It was declared in the environment contract and documented, but
the path was hard-coded to `<cwd>/logs`, so setting it had no effect — a
deployment that pointed logs at a mounted volume silently wrote them to the
container's ephemeral filesystem instead.

# Logging System

The ERP Backend uses a structured, traceable logging system based on **Pino** for high performance and better developer experience.

## Architecture

The logging system is centralized in `src/common/logger` and consists of several components:

1.  **LoggerService**: A wrapper around Pino that handles different log levels and formats (Pretty-print in dev, JSON in prod). `Scope.TRANSIENT` so each consumer carries its own context label; the Pino instance and file streams are process-wide (`pino-root-logger.ts`).
1.  **LoggerLifecycleService**: Flushes and closes the log files on application shutdown.
1.  **RequestContextMiddleware**: Generates a unique `requestId` for every incoming request.
1.  **RequestLoggingInterceptor**: Automatically logs all incoming requests and outgoing responses, including timing and user context.

## Request Tracing

Every request is assigned a unique `requestId` (UUID v7). This ID is used to correlate logs across different parts of the system.

- **Header**: The `requestId` is returned in the `x-request-id` response header.
- **Logs**: All logs generated during a request include the `requestId`.
- **Errors**: If an error occurs, the `requestId` is included in the error response metadata, making it easy to find relevant logs.

## Log Levels

- **INFO**: Standard operational logs (request completion, startup).
- **WARN**: Slow requests (>1000ms) or non-critical issues.
- **ERROR**: Unhandled exceptions or critical failures.
- **DEBUG**: Detailed information for debugging (optional).

## Development vs. Production

### Development (`NODE_ENV != 'production'`)

- **Format**: Pretty-printed, colorized, and human-readable.
- **Stack Traces**: Included in error responses and logs.

### Production (`NODE_ENV == 'production'`)

- **Format**: Structured JSON for ingestion into log management systems (e.g., ELK, Datadog).
- **Noise Reduction**: Verbose NestJS internal logs are suppressed.
- **Security**: Sensitive fields (passwords, tokens) are never logged.

## Slow Request Detection

Requests that take longer than **1000ms** are automatically logged as `WARN` with a `🐢 [SLOW]` prefix in development to help identify performance bottlenecks.

## Usage in Services

To use the logger in your services, inject the `LoggerService`:

```typescript
constructor(private readonly logger: LoggerService) {
  this.logger.setContext('MyService');
}

myMethod() {
  this.logger.log('Executing myMethod');
}
```

## Lifecycle and configuration

The log directory is set by `LOG_DIR` (default `<cwd>/logs`) and the threshold
by `LOG_LEVEL`. Both are validated at boot — see
[Configuration Contract](./configuration.md).

Streams are created once per process, not once per injection, and are closed on
shutdown. See [Health Checks & Process Lifecycle](./health-and-lifecycle.md#3-logger-lifecycle)
for why that distinction matters.

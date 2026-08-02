import pino from 'pino';
import pinoPretty from 'pino-pretty';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The process-wide pino instance and the file handles behind it.
 *
 * `LoggerService` is `Scope.TRANSIENT` so that each consumer can carry its own
 * `context` label. That is the right scope for the *label*, but it used to mean
 * the whole logger was rebuilt per injection: every service that injected it
 * created a fresh pino instance, its own `pino-pretty` transform, and its own
 * write streams to `app.log` and `error.log`. With around forty consumers that
 * is a hundred-odd file descriptors on two files, plus interleaved writes from
 * independent streams.
 *
 * The expensive parts are built once here and shared; only the label stays
 * per-instance.
 */
let rootLogger: pino.Logger | undefined;
let openStreams: fs.WriteStream[] = [];

const resolveLogDir = (): string => {
  const configured = process.env.LOG_DIR;
  return configured && configured.length > 0
    ? path.resolve(configured)
    : path.join(process.cwd(), 'logs');
};

const buildLogger = (): pino.Logger => {
  const isDev = process.env.NODE_ENV !== 'production';
  const logsDir = resolveLogDir();

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const streams: pino.StreamEntry[] = [];

  // Common pretty options for Dev (both console and file)
  const prettyOptions = {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname', // Hide internal noise
    messageFormat: (log: Record<string, unknown>, messageKey: string) => {
      const message = log[messageKey];
      const context = log.context;
      if (context) {
        return `[\x1b[33m${context as string}\x1b[0m] ${message as string}`;
      }
      return message as string;
    },
  };

  // Console Stream
  if (isDev) {
    streams.push({
      level: 'info',
      stream: pinoPretty(prettyOptions),
    });
  } else {
    streams.push({ level: 'info', stream: process.stdout });
  }

  const appLog = fs.createWriteStream(path.join(logsDir, 'app.log'), {
    flags: 'a',
  });
  openStreams.push(appLog);

  // File Streams - pretty in dev for readability, JSON in prod
  if (isDev) {
    const prettyFileStream = pinoPretty({
      ...prettyOptions,
      colorize: false, // No colors in files
    });
    prettyFileStream.pipe(appLog);
    streams.push({ level: 'info', stream: prettyFileStream });
  } else {
    streams.push({ level: 'info', stream: appLog });
  }

  // Error-specific file stream
  const errorLog = fs.createWriteStream(path.join(logsDir, 'error.log'), {
    flags: 'a',
  });
  openStreams.push(errorLog);
  streams.push({ level: 'error', stream: errorLog });

  return pino(
    {
      level: process.env.LOG_LEVEL || 'info',
      base: undefined, // Remove pid and hostname from the base object
    },
    pino.multistream(streams),
  );
};

export const getRootLogger = (): pino.Logger => {
  rootLogger ??= buildLogger();
  return rootLogger;
};

/**
 * Flushes and closes the log files.
 *
 * Called from the shutdown hook so that a terminating process does not drop
 * buffered log lines — which is exactly when the last few lines matter most.
 */
export const closeRootLogger = async (): Promise<void> => {
  const streams = openStreams;
  openStreams = [];
  rootLogger = undefined;

  await Promise.all(
    streams.map(
      (stream) =>
        new Promise<void>((resolve) => {
          stream.end(() => resolve());
        }),
    ),
  );
};

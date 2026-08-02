import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('logger lifecycle', () => {
  let logDir: string;
  let originalLogDir: string | undefined;

  beforeEach(() => {
    jest.resetModules();
    originalLogDir = process.env.LOG_DIR;
    logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-logs-'));
    process.env.LOG_DIR = logDir;
  });

  afterEach(async () => {
    const { closeRootLogger } =
      await import('@/common/logger/pino-root-logger');
    await closeRootLogger();

    if (originalLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = originalLogDir;
    }
    fs.rmSync(logDir, { recursive: true, force: true });
  });

  it('honours LOG_DIR', async () => {
    const { getRootLogger, closeRootLogger } =
      await import('@/common/logger/pino-root-logger');

    getRootLogger().error({ context: 'Test' }, 'probe line');
    // Write streams open lazily; closing flushes and settles them.
    await closeRootLogger();

    // The variable was declared and documented but the path was hard-coded to
    // <cwd>/logs, so configuring it had no effect.
    expect(fs.existsSync(path.join(logDir, 'app.log'))).toBe(true);
    expect(fs.readFileSync(path.join(logDir, 'error.log'), 'utf8')).toContain(
      'probe line',
    );
  });

  it('builds the pino instance once for the whole process', async () => {
    const { getRootLogger } = await import('@/common/logger/pino-root-logger');

    expect(getRootLogger()).toBe(getRootLogger());
  });

  it('shares one logger across transient LoggerService instances', async () => {
    const { LoggerService } = await import('@/common/logger/logger.service');

    const a = new LoggerService();
    const b = new LoggerService();

    // LoggerService is Scope.TRANSIENT so each consumer can carry its own
    // context label. Rebuilding the streams per instance opened a pair of file
    // descriptors for every service that injected it.
    expect((a as any).logger).toBe((b as any).logger);
  });

  it('keeps context labels independent per instance', async () => {
    const { LoggerService } = await import('@/common/logger/logger.service');

    const a = new LoggerService();
    const b = new LoggerService();
    a.setContext('AlphaService');
    b.setContext('BetaService');

    expect((a as any).context).toBe('AlphaService');
    expect((b as any).context).toBe('BetaService');
  });

  it('closes the streams on shutdown', async () => {
    const { LoggerLifecycleService } =
      await import('@/common/logger/logger-lifecycle.service');
    const { getRootLogger } = await import('@/common/logger/pino-root-logger');

    const before = getRootLogger();
    await new LoggerLifecycleService().onApplicationShutdown();

    // A fresh instance after teardown proves the old one was released rather
    // than left holding file handles.
    expect(getRootLogger()).not.toBe(before);
  });
});

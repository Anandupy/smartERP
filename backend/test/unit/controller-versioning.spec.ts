import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '../../src');

/** Every `@Controller('...')` literal in the codebase, with its file. */
function collectControllerPaths(): Array<{ file: string; value: string }> {
  const found: Array<{ file: string; value: string }> = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.controller.ts')) continue;

      const source = fs.readFileSync(full, 'utf8');
      const matches = source.matchAll(/@Controller\(\s*'([^']*)'\s*\)/g);
      for (const match of matches) {
        found.push({
          file: path.relative(SRC, full).replace(/\\/g, '/'),
          value: match[1],
        });
      }
    }
  };

  walk(SRC);
  return found;
}

/**
 * The project uses one versioning strategy: NestJS URI versioning with
 * `defaultVersion: '1'`, configured in `main.ts`. Controllers must not repeat
 * the version in their path.
 *
 * Eleven controllers once did, and because Nest prepends the default version
 * regardless, they were served at `/v1/v1/...` — the whole workspace,
 * communication and admin-navigation surface. Nothing failed loudly; the routes
 * simply were not where the documentation said they were.
 */
describe('controller versioning convention', () => {
  const controllers = collectControllerPaths();

  it('finds the controllers', () => {
    expect(controllers.length).toBeGreaterThan(30);
  });

  it('no controller hard-codes a version prefix', () => {
    const offenders = controllers.filter(({ value }) =>
      /^v\d+(\/|$)/.test(value),
    );

    expect(offenders).toEqual([]);
  });

  it('no controller path starts with a slash', () => {
    // A leading slash silently escapes the version prefix entirely.
    const offenders = controllers.filter(({ value }) => value.startsWith('/'));

    expect(offenders).toEqual([]);
  });
});

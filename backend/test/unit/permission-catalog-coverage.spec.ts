import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '../../src');
const SEEDER = path.join(SRC, 'infrastructure/database/seeder.service.ts');

/** Collects every `PERMISSIONS.X.Y` reference under a directory. */
function collectReferences(dir: string): Set<string> {
  const found = new Set<string>();

  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;

      const source = fs.readFileSync(full, 'utf8');
      for (const match of source.matchAll(/PERMISSIONS\.(\w+)\.(\w+)/g)) {
        found.add(`${match[1]}.${match[2]}`);
      }
    }
  };

  walk(dir);
  return found;
}

/**
 * A permission that is enforced but never seeded locks the route out entirely.
 *
 * `SUPER_ADMIN` does not rescue it: its bypass grants "all active permissions",
 * which is every row in the `Permission` table — so a permission with no row is
 * granted to nobody. `System.View`, `System.Manage` and `System.Maintenance`
 * were in exactly that state, making System Settings and Maintenance Rules
 * unreachable for every role.
 */
describe('permission catalogue coverage', () => {
  const enforced = collectReferences(SRC);

  const seededNames = (() => {
    const source = fs.readFileSync(SEEDER, 'utf8');
    const block = source.slice(
      source.indexOf('const permissionSeedData'),
      source.indexOf('const permissionMap'),
    );
    const found = new Set<string>();
    for (const match of block.matchAll(/PERMISSIONS\.(\w+)\.(\w+)/g)) {
      found.add(`${match[1]}.${match[2]}`);
    }
    return found;
  })();

  it('locates both sides of the comparison', () => {
    expect(enforced.size).toBeGreaterThan(20);
    expect(seededNames.size).toBeGreaterThan(20);
  });

  it('seeds every permission the application enforces', () => {
    const missing = [...enforced].filter((p) => !seededNames.has(p)).sort();

    expect(missing).toEqual([]);
  });
});

import { Reflector } from '@nestjs/core';
import { AcademicYearController } from '@/modules/academic-year/academic-year.controller';
import { ALLOW_DURING_SETUP_KEY } from '@/common/decorators/allow-during-setup.decorator';

/**
 * `GET /academic-years` must be reachable during setup.
 *
 * The setup wizard's Academic Year step checks a branch's existing years
 * before creating the first one (the same overlap-check every other caller
 * of `AcademicYearForm` gets) — but only `POST /academic-years` carried
 * `@AllowDuringSetup()`, so that read 409'd with SETUP_REQUIRED throughout
 * setup even though the create it precedes was explicitly allowed. Same
 * shape as the `POST /system-settings/init` and `POST /v1/users` gaps
 * `docs/core/workspace-bootstrap.md` §4 already documents: a route the
 * bootstrap flow genuinely needs, left off the allow-list by omission.
 */
describe('AcademicYearController — setup reachability', () => {
  it('marks findAll (GET /academic-years) @AllowDuringSetup', () => {
    const reflector = new Reflector();
    const allowed = reflector.get(
      ALLOW_DURING_SETUP_KEY,
      AcademicYearController.prototype.findAll,
    );
    expect(allowed).toBe(true);
  });
});

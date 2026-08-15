import { Reflector } from '@nestjs/core';
import { GuardianshipController } from '@/modules/admissions/guardians/guardianship.controller';
import { PERMISSION_KEY } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';

/** R4.5 — every guardianship read route must carry @RequirePermission. */
const routes: Array<{
  method: 'findByWard' | 'findSiblings' | 'findByGuardianPerson';
  expected: string;
}> = [
  { method: 'findByWard', expected: PERMISSIONS.Guardian.View },
  { method: 'findSiblings', expected: PERMISSIONS.Guardian.View },
  { method: 'findByGuardianPerson', expected: PERMISSIONS.Guardian.View },
];

describe('GuardianshipController permission enforcement', () => {
  const reflector = new Reflector();

  it.each(routes)(
    '$method declares @RequirePermission($expected)',
    ({ method, expected }) => {
      const handler = (GuardianshipController.prototype as any)[method];
      const declared = reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
        handler,
        GuardianshipController,
      ]);

      expect(declared).toBeDefined();
      expect(declared).toContain(expected);
    },
  );

  it('every controller route is covered by the table above', () => {
    const declaredRouteMethods = Object.getOwnPropertyNames(
      GuardianshipController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(declaredRouteMethods.sort()).toEqual(
      routes.map((r) => r.method).sort(),
    );
  });
});

import { Reflector } from '@nestjs/core';
import { DocumentRequirementController } from '@/modules/documents/document-requirement.controller';
import { PERMISSION_KEY } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';

/** Every DocumentRequirement route must carry @RequirePermission. */
const routes: Array<{
  method: 'create' | 'findAll' | 'findOne' | 'update' | 'remove';
  expected: string;
}> = [
  { method: 'create', expected: PERMISSIONS.DocumentRequirements.Manage },
  { method: 'findAll', expected: PERMISSIONS.Documents.View },
  { method: 'findOne', expected: PERMISSIONS.Documents.View },
  { method: 'update', expected: PERMISSIONS.DocumentRequirements.Manage },
  { method: 'remove', expected: PERMISSIONS.DocumentRequirements.Manage },
];

describe('DocumentRequirementController permission enforcement', () => {
  const reflector = new Reflector();

  it.each(routes)(
    '$method declares @RequirePermission($expected)',
    ({ method, expected }) => {
      const handler = (DocumentRequirementController.prototype as any)[method];
      const declared = reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
        handler,
        DocumentRequirementController,
      ]);

      expect(declared).toBeDefined();
      expect(declared).toContain(expected);
    },
  );

  it('every controller route is covered by the table above', () => {
    const declaredRouteMethods = Object.getOwnPropertyNames(
      DocumentRequirementController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(declaredRouteMethods.sort()).toEqual(
      routes.map((r) => r.method).sort(),
    );
  });
});

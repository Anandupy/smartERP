import { Reflector } from '@nestjs/core';
import { DocumentController } from '@/modules/documents/document.controller';
import { PERMISSION_KEY } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';

/** R5 — every document route must carry @RequirePermission. */
const routes: Array<{
  method:
    | 'upload'
    | 'findForOwner'
    | 'findOne'
    | 'replace'
    | 'verify'
    | 'reject'
    | 'archive'
    | 'download';
  expected: string;
}> = [
  { method: 'upload', expected: PERMISSIONS.Documents.Upload },
  { method: 'findForOwner', expected: PERMISSIONS.Documents.View },
  { method: 'findOne', expected: PERMISSIONS.Documents.View },
  { method: 'replace', expected: PERMISSIONS.Documents.Replace },
  { method: 'verify', expected: PERMISSIONS.Documents.Verify },
  { method: 'reject', expected: PERMISSIONS.Documents.Reject },
  { method: 'archive', expected: PERMISSIONS.Documents.Archive },
  { method: 'download', expected: PERMISSIONS.Documents.Download },
];

describe('DocumentController permission enforcement', () => {
  const reflector = new Reflector();

  it.each(routes)(
    '$method declares @RequirePermission($expected)',
    ({ method, expected }) => {
      const handler = (DocumentController.prototype as any)[method];
      const declared = reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
        handler,
        DocumentController,
      ]);

      expect(declared).toBeDefined();
      expect(declared).toContain(expected);
    },
  );

  it('every controller route is covered by the table above', () => {
    const declaredRouteMethods = Object.getOwnPropertyNames(
      DocumentController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(declaredRouteMethods.sort()).toEqual(
      routes.map((r) => r.method).sort(),
    );
  });
});

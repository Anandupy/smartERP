-- Backfill the workspace bootstrap state for installations that predate it.
--
-- The setup gate blocks the ordinary API until a workspace is marked
-- initialized. An existing deployment already past bootstrap has no state row,
-- so without this backfill an upgrade would lock every user out of a working
-- system.
--
-- A workspace that already holds an active organization, an active branch and
-- an academic year is by definition past bootstrap. `initializedById` stays
-- NULL because no user performed the action.
INSERT INTO "workspace_state" ("id", "scope", "initializedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'GLOBAL', NOW(), NOW(), NOW()
WHERE
  EXISTS (SELECT 1 FROM "Organization" WHERE "status" = 'ACTIVE')
  AND EXISTS (SELECT 1 FROM "Branch" WHERE "isActive" = true AND "isDeleted" = false)
  AND EXISTS (SELECT 1 FROM "AcademicYear" WHERE "isDeleted" = false)
ON CONFLICT ("scope") DO NOTHING;

-- Store only the hash of a refresh token.
--
-- The raw token was persisted alongside its SHA-256 digest, so anyone who could
-- read the table held directly usable session credentials — a database backup,
-- a read replica or a SQL injection became a full session takeover. Hashing is
-- only protective if the plaintext is absent.

-- Legacy rows predate the tokenHash column and cannot be migrated: recomputing
-- the digest needs the raw value, which is exactly what is being removed.
-- Those sessions are revoked; their owners re-authenticate.
DELETE FROM "RefreshToken" WHERE "tokenHash" IS NULL;

ALTER TABLE "RefreshToken" DROP COLUMN "token";
ALTER TABLE "RefreshToken" ALTER COLUMN "tokenHash" SET NOT NULL;

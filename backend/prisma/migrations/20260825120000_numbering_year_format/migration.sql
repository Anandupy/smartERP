-- Numbering: configurable `{year}` rendering (R6).
--
-- Additive only. `NumberSequenceConfig` gains one column with a default that
-- reproduces today's behaviour exactly, so every sequence provisioned before
-- this migration keeps rendering `{year}` from `AcademicYear.name` verbatim —
-- nothing issued so far changes shape. See docs/planning/00-foundation/
-- 03-numbering.md §8 and numbering.enums.prisma for why `NAME` cannot be
-- computed the same way the other four modes are.

-- CreateEnum
CREATE TYPE "SequenceYearFormat" AS ENUM ('NAME', 'FULL_START', 'SHORT_START', 'FULL_RANGE', 'SHORT_RANGE');

-- AlterTable
ALTER TABLE "NumberSequenceConfig" ADD COLUMN     "yearFormat" "SequenceYearFormat" NOT NULL DEFAULT 'NAME';

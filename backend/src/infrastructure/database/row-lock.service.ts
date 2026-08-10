import { Injectable, Logger } from '@nestjs/common';
import { PrismaTransactionClient } from './prisma-transaction.types';

/**
 * Tables a caller may take a row lock on.
 *
 * A table name cannot be a bound parameter, so it is interpolated into the
 * statement. This allowlist is what makes that safe: nothing outside it reaches
 * the SQL, and a typo fails to compile rather than reaching the database.
 *
 * Phases add to this list as their tables land.
 */
export const LOCKABLE_TABLES = [
  'Applicant',
  'Enrollment',
  'AcademicYear',
] as const;

export type LockableTable = (typeof LOCKABLE_TABLES)[number];

/**
 * The execution scope a locked row must belong to.
 *
 * Every supplied dimension is ANDed into the `WHERE`. A row outside the scope
 * is not returned, and the caller cannot tell that from a row that does not
 * exist — which is the point (§30.1: a 403 confirms existence).
 */
export interface RowLockScope {
  organizationId?: string | null;
  branchId?: string | null;
  academicYearId?: string | null;
}

export interface LockRowOptions<TColumn extends string> {
  table: LockableTable;
  id: string;
  scope: RowLockScope;
  /** Columns to read back under the lock. `id` is always included. */
  columns: readonly TColumn[];
  /**
   * Fail immediately instead of waiting when another transaction holds the
   * row. Off by default: the normal case is a brief wait, and a caller that
   * cannot wait usually wants a queue rather than an error.
   */
  noWait?: boolean;
  /**
   * `FOR SHARE` instead of `FOR UPDATE`.
   *
   * For a row the caller must *read consistently* but has no intention of
   * changing — the academic year during an enrolment write being the case this
   * exists for. A share lock blocks anyone trying to lock the year for update
   * (which is what setting `isLocked` does) while letting every other enrolment
   * in the same year proceed in parallel. `FOR UPDATE` there would serialise
   * every write in the year behind one row for no benefit.
   */
  mode?: 'UPDATE' | 'SHARE';
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Scoped row-level locking.
 *
 * Prisma has no row-lock API. `findUnique` and `findFirst` take no lock at all,
 * so a service that reads a row, checks its state and then writes it is racing
 * every other caller doing the same — which is how two administrators approve
 * the same applicant and both pass the guard.
 *
 * The lock has to be a raw `SELECT ... FOR UPDATE`, and it has to be the first
 * statement in the transaction. Centralised here so that raw SQL exists in one
 * tested place instead of being copied into each service that needs it.
 *
 * Under `READ COMMITTED` — Postgres' and Prisma's default — `FOR UPDATE`
 * re-evaluates the row after the blocking transaction commits, so the caller
 * sees the *updated* state. That is what makes re-checking the state after
 * acquiring the lock meaningful rather than decorative.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §33.2.
 */
@Injectable()
export class RowLockService {
  private readonly logger = new Logger(RowLockService.name);

  /**
   * Lock one row and read it back, or return null when no row matches the id
   * *within the given scope*.
   *
   * Null means "not found or not yours". Callers translate it to 404 — never
   * 403, which would confirm the row exists to someone not entitled to know.
   */
  async lockRow<TColumn extends string>(
    tx: PrismaTransactionClient,
    options: LockRowOptions<TColumn>,
  ): Promise<(Record<TColumn, unknown> & { id: string }) | null> {
    const { table, id, scope, columns, noWait, mode } = options;

    if (!LOCKABLE_TABLES.includes(table)) {
      throw new Error(
        `Row lock requested on a table outside the allowlist: ${table}`,
      );
    }

    for (const column of columns) {
      if (!IDENTIFIER.test(column)) {
        throw new Error(
          `Row lock requested with an invalid column name: ${column}`,
        );
      }
    }

    const selected = Array.from(new Set<string>(['id', ...columns]))
      .map((c) => `"${c}"`)
      .join(', ');

    // $1 is always the id; scope dimensions follow in the order they are added.
    const conditions = ['"id" = $1'];
    const params: unknown[] = [id];

    for (const [column, value] of [
      ['organizationId', scope.organizationId],
      ['branchId', scope.branchId],
      ['academicYearId', scope.academicYearId],
    ] as const) {
      if (value !== undefined && value !== null) {
        params.push(value);
        conditions.push(`"${column}" = $${params.length}`);
      }
    }

    const sql =
      `SELECT ${selected} FROM "${table}" ` +
      `WHERE ${conditions.join(' AND ')} ` +
      `FOR ${mode === 'SHARE' ? 'SHARE' : 'UPDATE'}${noWait ? ' NOWAIT' : ''}`;

    const rows = await tx.$queryRawUnsafe<
      Array<Record<TColumn, unknown> & { id: string }>
    >(sql, ...params);

    if (rows.length === 0) {
      this.logger.debug(
        `Row lock on ${table}/${id} matched nothing within the requested scope.`,
      );
      return null;
    }

    return rows[0];
  }
}

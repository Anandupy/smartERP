import { Transform } from 'class-transformer';

/** A calendar date with no time part: `YYYY-MM-DD`. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A full ISO 8601 timestamp: `YYYY-MM-DDTHH:mm[:ss[.sss]][Z|±HH:mm]`. */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,7})?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Turns an ISO 8601 string into a `Date`.
 *
 * A calendar date carries no time zone, so `2027-08-07` is pinned to UTC
 * midnight rather than to midnight in whatever zone the server happens to run
 * in — the stored instant is then the same on every machine.
 *
 * Anything that is not a recognisable ISO string is returned untouched, so the
 * validator on the property is the one that reports the error and the client
 * still gets a 400 rather than a transformed surprise.
 */
export function toDate(value: unknown): unknown {
  if (value instanceof Date || typeof value !== 'string') {
    return value;
  }

  const raw = value.trim();
  const isCalendarDate = CALENDAR_DATE.test(raw);

  if (!isCalendarDate && !ISO_DATE_TIME.test(raw)) {
    return value;
  }

  const parsed = new Date(isCalendarDate ? `${raw}T00:00:00.000Z` : raw);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  // `new Date('2027-02-31')` rolls over to March 3 rather than failing. Storing
  // a date the client never sent is worse than rejecting it, so a calendar date
  // has to survive the round trip unchanged.
  if (isCalendarDate && !parsed.toISOString().startsWith(raw)) {
    return value;
  }

  return parsed;
}

/**
 * Property decorator applying {@link toDate} during validation-pipe transform.
 *
 * Pair it with `@IsDate()`: the transform runs first, so a valid string is a
 * `Date` by the time the validator sees it, and an invalid one is still the
 * original string and fails.
 */
export function ToDate(): PropertyDecorator {
  return Transform(({ value }) => toDate(value), { toClassOnly: true });
}

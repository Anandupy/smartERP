/**
 * Parses a date of birth written in words, as the admission form asks for
 * ("Fifth November Two Thousand Nineteen"), into `YYYY-MM-DD`.
 *
 * Tolerates OCR slips: each word is matched to the closest number/month word
 * within an edit distance of 2 ("Movember", "Mineteen"). Returns null when
 * the text does not read as a complete, valid date.
 */

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
};

const CARDINALS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
};

const VOCABULARY = [
  ...MONTHS,
  ...Object.keys(ORDINALS),
  ...Object.keys(CARDINALS),
  "thousand",
  "hundred",
  "and",
];

function distance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previous = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return dp[b.length];
}

function closestWord(word: string): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of VOCABULARY) {
    const d = distance(word, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  const allowed = word.length <= 4 ? 1 : 2;
  return bestDistance <= allowed ? best : null;
}

export function parseDateInWords(text: string): string | null {
  const words = text
    .toLowerCase()
    .replace(/-/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    // Numerals are kept as-is ("Two Thousand 18"); words are matched fuzzily.
    .map((word) => (/^\d+$/.test(word) ? word : closestWord(word)));
  if (words.length < 4 || words.some((w) => w === null)) return null;
  const tokens = words as string[];

  // Day: ordinal, optionally preceded by "twenty"/"thirty" ("Twenty First").
  let i = 0;
  let day = 0;
  if (
    (tokens[i] === "twenty" || tokens[i] === "thirty") &&
    ORDINALS[tokens[i + 1]] &&
    ORDINALS[tokens[i + 1]] < 10
  ) {
    day = CARDINALS[tokens[i]] + ORDINALS[tokens[i + 1]];
    i += 2;
  } else if (ORDINALS[tokens[i]]) {
    day = ORDINALS[tokens[i]];
    i += 1;
  } else return null;

  if (tokens[i] === "of") i++;
  const month = MONTHS.indexOf(tokens[i]) + 1;
  if (month === 0) return null;
  i++;

  // Year: "two thousand [and] nineteen" or "twenty twenty".
  const rest = tokens.slice(i).filter((w) => w !== "and");
  let year = 0;
  if (rest[0] === "two" && rest[1] === "thousand") {
    year = 2000;
    let j = 2;
    if (rest[j] === "twenty" || rest[j] === "thirty") {
      year += CARDINALS[rest[j]];
      j++;
      if (rest[j] && CARDINALS[rest[j]] < 10) year += CARDINALS[rest[j++]];
    } else if (rest[j] && CARDINALS[rest[j]]) {
      year += CARDINALS[rest[j++]];
    } else if (rest[j] && /^\d{1,2}$/.test(rest[j])) {
      year += Number(rest[j++]);
    }
    // A bare "Two Thousand" is far more often a line cut short than the year 2000.
    if (j === 2 || j !== rest.length) return null;
  } else if (rest[0] === "twenty" && rest.length >= 2) {
    year =
      2000 +
      CARDINALS[rest[1]] +
      (rest[2] && CARDINALS[rest[2]] < 10 ? CARDINALS[rest[2]] : 0);
  } else return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

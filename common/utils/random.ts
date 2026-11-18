import { randomInt } from 'node:crypto';

// Random / unique value helpers used by the test-data generators.

// Integer in [min, max] (inclusive)
export const randInt = (min: number, max: number): number => randomInt(min, max + 1);

// One random element of a list
export const pick = <T>(list: readonly T[]): T => list[randInt(0, list.length - 1)];

// `count` different random elements of a list
export const pickSome = <T>(list: readonly T[], count: number): T[] =>
  [...list].sort(() => randInt(0, 2) - 1).slice(0, count);

// String of random digits; the first digit is never 0 unless allowed
export function digits(length: number, { leadingZero = false } = {}): string {
  let out = String(leadingZero ? randInt(0, 9) : randInt(1, 9));
  while (out.length < length) out += String(randInt(0, 9));
  return out;
}

// Random lowercase letters
export const letters = (length: number): string =>
  Array.from({ length }, () => String.fromCharCode(97 + randInt(0, 25))).join('');

// Short value unique to this run: time-based + random, base36 (e.g. "k3x9q2")
export const uniqueTag = (): string =>
  (Date.now() % 36 ** 4).toString(36).padStart(4, '0') +
  randInt(0, 36 ** 2 - 1).toString(36).padStart(2, '0');

// Number of digits that is unique per millisecond + random tail
export const uniqueDigits = (length: number): string => {
  const time = String(Date.now());           // 13 digits
  const random = digits(4, { leadingZero: true });
  const base = (time + random).slice(-(length - 1));
  return String(randInt(1, 9)) + base.padStart(length - 1, '0');
};

// Short unique suffix for test data, e.g. "1117-4821"
// (month+day, then 4 random digits) - easy to find again in the system
export function randomId(): string {
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${date}-${randomInt(1000, 10000)}`;
}
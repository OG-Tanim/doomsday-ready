import { ApiError } from "./errors.js";

const fail = (message: string): never => {
  throw new ApiError(400, "VALIDATION_ERROR", message);
};

export function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    fail("Body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function nonEmptyString(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== "string") return fail(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) return fail(`${field} must not be empty`);
  if (trimmed.length > maxLength) return fail(`${field} must be at most ${maxLength} characters`);
  return trimmed;
}

export function intInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return fail(`${field} must be an integer from ${min} to ${max}`);
  }
  return value;
}

export function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") return fail(`${field} must be true or false`);
  return value;
}

/** Array of distinct integers, each in [min, max], length in [minLen, maxLen]. */
export function distinctIntArray(
  value: unknown,
  field: string,
  opts: { min: number; max: number; minLen?: number; maxLen?: number },
): number[] {
  if (!Array.isArray(value)) return fail(`${field} must be an array`);
  const { min, max, minLen = 0, maxLen = Infinity } = opts;
  if (value.length < minLen || value.length > maxLen) {
    return fail(`${field} must have ${minLen === maxLen ? minLen : `${minLen} to ${maxLen}`} items`);
  }
  value.forEach((v, i) => intInRange(v, `${field}[${i}]`, min, max));
  if (new Set(value).size !== value.length) fail(`${field} must not contain duplicates`);
  return value as number[];
}

/** Route param or query value → positive integer, or 400. */
export function positiveIntParam(value: unknown, field: string): number {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n < 1) return fail(`${field} must be a positive integer`);
  return n;
}

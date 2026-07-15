import { canonicalize } from "./lib.mjs";

const DEFAULT_VOLATILE_KEYS = new Set([
  "generated_at",
  "detected_at",
  "evaluated_at",
  "created_at",
  "updated_at",
]);

export function withoutVolatileFields(value, volatileKeys = DEFAULT_VOLATILE_KEYS) {
  if (Array.isArray(value)) return value.map((entry) => withoutVolatileFields(entry, volatileKeys));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !volatileKeys.has(key))
    .map(([key, entry]) => [key, withoutVolatileFields(entry, volatileKeys)]));
}

export function semanticallyEqual(left, right, volatileKeys = DEFAULT_VOLATILE_KEYS) {
  if (left === undefined || right === undefined) return false;
  return JSON.stringify(canonicalize(withoutVolatileFields(left, volatileKeys)))
    === JSON.stringify(canonicalize(withoutVolatileFields(right, volatileKeys)));
}

export function preserveStableRows(nextRows, previousRows, keyFor, volatileKeys = DEFAULT_VOLATILE_KEYS) {
  const previousByKey = new Map((previousRows ?? []).map((row) => [keyFor(row), row]));
  return (nextRows ?? []).map((row) => {
    const previous = previousByKey.get(keyFor(row));
    return semanticallyEqual(row, previous, volatileKeys) ? previous : row;
  });
}

export function preserveArtifactTimestamp(nextArtifact, previousArtifact, timestamp = new Date().toISOString()) {
  const next = { ...nextArtifact, generated_at: timestamp };
  if (semanticallyEqual(next, previousArtifact)) return previousArtifact?.generated_at ?? timestamp;
  return timestamp;
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  preserveArtifactTimestamp,
  preserveStableRows,
  semanticallyEqual,
} from "../scripts/artifact-stability.mjs";

test("scheduled Signal artifacts ignore clock-only changes", () => {
  const previous = {
    generated_at: "2026-07-15T12:00:00.000Z",
    signals: [{ id: "sig_1", bounded_claims: [{ text: "Documented context" }], updated_at: "2026-07-15T12:00:00.000Z" }],
  };
  const next = {
    generated_at: "2026-07-15T15:00:00.000Z",
    signals: [{ id: "sig_1", bounded_claims: [{ text: "Documented context" }], updated_at: "2026-07-15T15:00:00.000Z" }],
  };

  assert.equal(semanticallyEqual(previous, next), true);
  assert.equal(preserveArtifactTimestamp(next, previous, next.generated_at), previous.generated_at);
});

test("stable rows retain original audit timestamps while material changes advance", () => {
  const previous = [{ id: "sig_1", claim: "A", evaluated_at: "2026-07-15T12:00:00.000Z" }];
  const stable = preserveStableRows(
    [{ id: "sig_1", claim: "A", evaluated_at: "2026-07-15T15:00:00.000Z" }],
    previous,
    (row) => row.id,
  );
  const changed = preserveStableRows(
    [{ id: "sig_1", claim: "B", evaluated_at: "2026-07-15T15:00:00.000Z" }],
    previous,
    (row) => row.id,
  );

  assert.equal(stable[0], previous[0]);
  assert.notEqual(changed[0], previous[0]);
  assert.equal(changed[0].evaluated_at, "2026-07-15T15:00:00.000Z");
});

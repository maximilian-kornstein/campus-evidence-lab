import test from "node:test";
import assert from "node:assert/strict";
import {
  affectedCommunityForCodeTag,
  categoryForCodeTag,
  buildEdCertificationBatchReview,
  validateEdCertificationBatchReview
} from "../scripts/ed-certification-batch-review-lib.mjs";
import { ED_CERTIFICATION_REVIEW_SPECS } from "../scripts/ed-certification-review-registry.mjs";

test("ED certification review registry lists applied review artifacts in order", () => {
  assert.deepEqual(
    ED_CERTIFICATION_REVIEW_SPECS.map((spec) => ({
      reviewBatchId: spec.reviewBatchId,
      sourceBatchId: spec.sourceBatchId,
      dataPathKey: spec.dataPathKey,
      route: spec.route,
      artifactName: spec.artifactName
    })),
    [
      {
        reviewBatchId: "ed_dataset_batch_001",
        sourceBatchId: "ed_dataset_batch_001",
        dataPathKey: "edCertificationBatchReview",
        route: "/ed-certification-batch-001/",
        artifactName: "ed-certification-batch-001-review.json"
      },
      {
        reviewBatchId: "ed_certification_batch_002",
        sourceBatchId: "ed_dataset_batch_001",
        dataPathKey: "edCertificationBatch002Review",
        route: "/ed-certification-batch-002/",
        artifactName: "ed-certification-batch-002-review.json"
      },
      {
        reviewBatchId: "ed_certification_batch_003",
        sourceBatchId: "ed_dataset_batch_001",
        dataPathKey: "edCertificationBatch003Review",
        route: "/ed-certification-batch-003/",
        artifactName: "ed-certification-batch-003-review.json"
      }
    ]
  );
});

test("maps ED code tags to bounded site categories and affected labels", () => {
  assert.equal(categoryForCodeTag("intim-rac24"), "Harassment or threat");
  assert.equal(categoryForCodeTag("vandal-rel24"), "Vandalism");
  assert.equal(categoryForCodeTag("lar-t-sex24"), "Other source-backed civil rights event");
  assert.equal(affectedCommunityForCodeTag("rac"), "Race");
  assert.equal(affectedCommunityForCodeTag("gid"), "LGBTQ+");
});

test("buildEdCertificationBatchReview certifies only records with matched source cells and passing gates", () => {
  const events = [
    {
      id: "evt_cert",
      school_id: "school_a",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response:
        "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    },
    {
      id: "evt_uncertain",
      school_id: "school_b",
      date: "2024-01-01",
      date_precision: "year",
      category: "Harassment or threat",
      affected_communities: ["Race"],
      institutional_response:
        "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rac24"]
    },
    {
      id: "evt_blocked",
      school_id: "school_c",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response:
        "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    }
  ];
  const certificationBatches = {
    id: "certification_batches_v1",
    snapshot_id: "snapshot_test",
    generated_at: "2026-06-17",
    batches: [
      {
        id: "ed_dataset_batch_001",
        records: events.map((event) => ({ event_id: event.id, school_id: event.school_id }))
      }
    ]
  };
  const edDatasetProvenanceAudit = {
    records: [
      {
        event_id: "evt_cert",
        school_id: "school_a",
        code_tag: "vandal-rel24",
        source_year: "2024",
        expected_column: "VANDAL_REL24",
        expected_count: 2,
        provenance_status: "matched",
        locator: {
          workbook: "Oncampushate222324.xlsx",
          sheet: "sheet1",
          row: 12,
          column: "VANDAL_REL24",
          column_letter: "NU",
          cell: "NU12",
          cell_value: "2",
          locator: "Oncampushate222324.xlsx > sheet1 row 12 > column VANDAL_REL24 > cell NU12"
        }
      },
      {
        event_id: "evt_uncertain",
        school_id: "school_b",
        code_tag: "vandal-rac24",
        source_year: "2024",
        expected_column: "VANDAL_RAC24",
        expected_count: 1,
        provenance_status: "matched",
        locator: {
          workbook: "Oncampushate222324.xlsx",
          sheet: "sheet1",
          row: 13,
          column: "VANDAL_RAC24",
          column_letter: "NT",
          cell: "NT13",
          cell_value: "1",
          locator: "Oncampushate222324.xlsx > sheet1 row 13 > column VANDAL_RAC24 > cell NT13"
        }
      },
      {
        event_id: "evt_blocked",
        school_id: "school_c",
        code_tag: "vandal-rel24",
        source_year: "2024",
        expected_column: "VANDAL_REL24",
        expected_count: 1,
        provenance_status: "unmatched",
        locator: null,
        unresolved_reason: "Multiple workbook rows matched school_c, VANDAL_REL24, and count 1."
      }
    ]
  };

  const review = buildEdCertificationBatchReview({
    events,
    certificationBatches,
    edDatasetProvenanceAudit,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" }
  });

  assert.equal(review.totals.records, 3);
  assert.equal(review.status_counts.certified, 1);
  assert.equal(review.status_counts.not_certified, 1);
  assert.equal(review.status_counts.blocked, 1);
  assert.equal(
    review.records.find((record) => record.event_id === "evt_cert").certification_basis,
    "ed_dataset_batch_001_internal_source_to_record_review"
  );
  assert.match(review.records.find((record) => record.event_id === "evt_uncertain").not_certified_reason, /category/i);
  assert.match(review.records.find((record) => record.event_id === "evt_blocked").blocked_reason, /Multiple workbook rows/);
  assert.deepEqual(
    validateEdCertificationBatchReview({
      review,
      events,
      certificationBatches,
      manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" }
    }),
    []
  );
});

test("buildEdCertificationBatchReview freezes existing Batch 001 record ids across later batch-manifest changes", () => {
  const events = [
    {
      id: "evt_frozen",
      school_id: "school_a",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response:
        "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    },
    {
      id: "evt_new_manifest",
      school_id: "school_b",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response:
        "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    }
  ];
  const certificationBatches = {
    id: "certification_batches_v1",
    snapshot_id: "snapshot_test",
    generated_at: "2026-06-17",
    batches: [{ id: "ed_dataset_batch_001", records: [{ event_id: "evt_new_manifest", school_id: "school_b" }] }]
  };
  const edDatasetProvenanceAudit = {
    records: [
      {
        event_id: "evt_frozen",
        school_id: "school_a",
        code_tag: "vandal-rel24",
        source_year: "2024",
        expected_column: "VANDAL_REL24",
        expected_count: 2,
        provenance_status: "matched",
        locator: {
          workbook: "Oncampushate222324.xlsx",
          sheet: "sheet1",
          row: 12,
          column: "VANDAL_REL24",
          column_letter: "NU",
          cell: "NU12",
          cell_value: "2",
          locator: "Oncampushate222324.xlsx > sheet1 row 12 > column VANDAL_REL24 > cell NU12"
        }
      },
      {
        event_id: "evt_new_manifest",
        school_id: "school_b",
        code_tag: "vandal-rel24",
        source_year: "2024",
        expected_column: "VANDAL_REL24",
        expected_count: 1,
        provenance_status: "matched",
        locator: {
          workbook: "Oncampushate222324.xlsx",
          sheet: "sheet1",
          row: 13,
          column: "VANDAL_REL24",
          column_letter: "NU",
          cell: "NU13",
          cell_value: "1",
          locator: "Oncampushate222324.xlsx > sheet1 row 13 > column VANDAL_REL24 > cell NU13"
        }
      }
    ]
  };
  const existingReview = {
    id: "ed_certification_batch_001_review_v1",
    review_batch_id: "ed_dataset_batch_001",
    records: [{ event_id: "evt_frozen", school_id: "school_a" }]
  };

  const review = buildEdCertificationBatchReview({
    events,
    certificationBatches,
    edDatasetProvenanceAudit,
    existingReview,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" }
  });

  assert.deepEqual(
    review.records.map((record) => record.event_id),
    ["evt_frozen"]
  );
  assert.match(review.selection_method, /^Frozen/);
  assert.deepEqual(
    validateEdCertificationBatchReview({
      review,
      events,
      certificationBatches,
      manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" }
    }),
    []
  );
});

test("buildEdCertificationBatchReview supports a second frozen ED review wave with batch-specific basis", () => {
  const events = [
    {
      id: "evt_wave_2_cert",
      school_id: "school_wave_two",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response:
        "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    },
    {
      id: "evt_new_manifest",
      school_id: "school_new",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response:
        "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    }
  ];
  const certificationBatches = {
    id: "certification_batches_v1",
    snapshot_id: "snapshot_test",
    generated_at: "2026-06-17",
    batches: [
      {
        id: "ed_dataset_batch_001",
        records: [{ event_id: "evt_new_manifest", school_id: "school_new" }]
      }
    ]
  };
  const edDatasetProvenanceAudit = {
    records: [
      {
        event_id: "evt_wave_2_cert",
        school_id: "school_wave_two",
        code_tag: "vandal-rel24",
        source_year: "2024",
        expected_column: "VANDAL_REL24",
        expected_count: 1,
        provenance_status: "matched",
        locator: {
          workbook: "Oncampushate222324.xlsx",
          sheet: "sheet1",
          row: 22,
          column: "VANDAL_REL24",
          column_letter: "NU",
          cell: "NU22",
          cell_value: "1",
          locator: "Oncampushate222324.xlsx > sheet1 row 22 > column VANDAL_REL24 > cell NU22"
        }
      },
      {
        event_id: "evt_new_manifest",
        school_id: "school_new",
        code_tag: "vandal-rel24",
        source_year: "2024",
        expected_column: "VANDAL_REL24",
        expected_count: 1,
        provenance_status: "matched",
        locator: {
          workbook: "Oncampushate222324.xlsx",
          sheet: "sheet1",
          row: 23,
          column: "VANDAL_REL24",
          column_letter: "NU",
          cell: "NU23",
          cell_value: "1",
          locator: "Oncampushate222324.xlsx > sheet1 row 23 > column VANDAL_REL24 > cell NU23"
        }
      }
    ]
  };
  const existingReview = {
    id: "ed_certification_batch_002_review_v1",
    review_batch_id: "ed_certification_batch_002",
    records: [{ event_id: "evt_wave_2_cert", school_id: "school_wave_two" }]
  };

  const review = buildEdCertificationBatchReview({
    events,
    certificationBatches,
    edDatasetProvenanceAudit,
    existingReview,
    reviewBatchId: "ed_certification_batch_002",
    sourceBatchId: "ed_dataset_batch_001",
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" }
  });

  assert.equal(review.id, "ed_certification_batch_002_review_v1");
  assert.equal(review.review_batch_id, "ed_certification_batch_002");
  assert.equal(review.source_batch_id, "ed_dataset_batch_001");
  assert.match(review.selection_method, /^Frozen/);
  assert.deepEqual(
    review.records.map((record) => record.event_id),
    ["evt_wave_2_cert"]
  );
  assert.equal(review.records[0].review_batch_id, "ed_certification_batch_002");
  assert.equal(review.records[0].certification_basis, "ed_certification_batch_002_internal_source_to_record_review");
  assert.deepEqual(
    validateEdCertificationBatchReview({
      review,
      events,
      certificationBatches,
      batchId: "ed_dataset_batch_001",
      reviewBatchId: "ed_certification_batch_002",
      manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" }
    }),
    []
  );
});

test("buildEdCertificationBatchReview freezes a newly initialized named review immediately", () => {
  const events = [
    {
      id: "evt_wave_3_cert",
      school_id: "school_wave_three",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response:
        "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    },
    {
      id: "evt_later_manifest",
      school_id: "school_later",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response:
        "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    }
  ];
  const initialCertificationBatches = {
    id: "certification_batches_v1",
    snapshot_id: "snapshot_test",
    generated_at: "2026-06-17",
    batches: [
      {
        id: "ed_dataset_batch_001",
        records: [{ event_id: "evt_wave_3_cert", school_id: "school_wave_three" }]
      }
    ]
  };
  const laterCertificationBatches = {
    ...initialCertificationBatches,
    batches: [
      {
        id: "ed_dataset_batch_001",
        records: [{ event_id: "evt_later_manifest", school_id: "school_later" }]
      }
    ]
  };
  const edDatasetProvenanceAudit = {
    records: [
      {
        event_id: "evt_wave_3_cert",
        school_id: "school_wave_three",
        code_tag: "vandal-rel24",
        source_year: "2024",
        expected_column: "VANDAL_REL24",
        expected_count: 1,
        provenance_status: "matched",
        locator: {
          workbook: "Oncampushate222324.xlsx",
          sheet: "sheet1",
          row: 24,
          column: "VANDAL_REL24",
          column_letter: "NU",
          cell: "NU24",
          cell_value: "1",
          locator: "Oncampushate222324.xlsx > sheet1 row 24 > column VANDAL_REL24 > cell NU24"
        }
      }
    ]
  };

  const review = buildEdCertificationBatchReview({
    events,
    certificationBatches: initialCertificationBatches,
    edDatasetProvenanceAudit,
    reviewBatchId: "ed_certification_batch_003",
    sourceBatchId: "ed_dataset_batch_001",
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" }
  });

  assert.match(review.selection_method, /^Frozen from the existing ED Batch 003 review artifact/);
  assert.deepEqual(
    validateEdCertificationBatchReview({
      review,
      events,
      certificationBatches: laterCertificationBatches,
      sourceBatchId: "ed_dataset_batch_001",
      reviewBatchId: "ed_certification_batch_003",
      manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" }
    }),
    []
  );
});

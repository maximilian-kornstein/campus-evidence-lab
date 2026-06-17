export const ED_CERTIFICATION_REVIEW_SPECS = [
  {
    reviewBatchId: "ed_dataset_batch_001",
    sourceBatchId: "ed_dataset_batch_001",
    dataPathKey: "edCertificationBatchReview",
    route: "/ed-certification-batch-001/",
    outputDir: "ed-certification-batch-001",
    artifactName: "ed-certification-batch-001-review.json",
    pageTitle: "ED Certification Batch 001 Review",
    pageKicker: "Applied ED Batch 001 review",
    previousRoute: null,
    nextRoute: "/ed-certification-batch-002/"
  },
  {
    reviewBatchId: "ed_certification_batch_002",
    sourceBatchId: "ed_dataset_batch_001",
    dataPathKey: "edCertificationBatch002Review",
    route: "/ed-certification-batch-002/",
    outputDir: "ed-certification-batch-002",
    artifactName: "ed-certification-batch-002-review.json",
    pageTitle: "ED Certification Batch 002 Review",
    pageKicker: "Applied ED Batch 002 review",
    previousRoute: "/ed-certification-batch-001/",
    nextRoute: "/ed-certification-batch-003/"
  },
  {
    reviewBatchId: "ed_certification_batch_003",
    sourceBatchId: "ed_dataset_batch_001",
    dataPathKey: "edCertificationBatch003Review",
    route: "/ed-certification-batch-003/",
    outputDir: "ed-certification-batch-003",
    artifactName: "ed-certification-batch-003-review.json",
    pageTitle: "ED Certification Batch 003 Review",
    pageKicker: "Applied ED Batch 003 review",
    previousRoute: "/ed-certification-batch-002/",
    nextRoute: "/ed-certification-batch-004/"
  },
  {
    reviewBatchId: "ed_certification_batch_004",
    sourceBatchId: "ed_dataset_batch_001",
    dataPathKey: "edCertificationBatch004Review",
    route: "/ed-certification-batch-004/",
    outputDir: "ed-certification-batch-004",
    artifactName: "ed-certification-batch-004-review.json",
    pageTitle: "ED Certification Batch 004 Review",
    pageKicker: "Applied ED Batch 004 review",
    previousRoute: "/ed-certification-batch-003/",
    nextRoute: "/ed-certification-batch-005/"
  },
  {
    reviewBatchId: "ed_certification_batch_005",
    sourceBatchId: "ed_dataset_batch_001",
    dataPathKey: "edCertificationBatch005Review",
    route: "/ed-certification-batch-005/",
    outputDir: "ed-certification-batch-005",
    artifactName: "ed-certification-batch-005-review.json",
    pageTitle: "ED Certification Batch 005 Review",
    pageKicker: "Applied ED Batch 005 review",
    previousRoute: "/ed-certification-batch-004/",
    nextRoute: "/ed-certification-batch-006/"
  },
  {
    reviewBatchId: "ed_certification_batch_006",
    sourceBatchId: "ed_dataset_batch_001",
    dataPathKey: "edCertificationBatch006Review",
    route: "/ed-certification-batch-006/",
    outputDir: "ed-certification-batch-006",
    artifactName: "ed-certification-batch-006-review.json",
    pageTitle: "ED Certification Batch 006 Review",
    pageKicker: "Applied ED Batch 006 review",
    previousRoute: "/ed-certification-batch-005/",
    nextRoute: "/ed-certification-batch-007/"
  },
  {
    reviewBatchId: "ed_certification_batch_007",
    sourceBatchId: "ed_dataset_batch_001",
    dataPathKey: "edCertificationBatch007Review",
    route: "/ed-certification-batch-007/",
    outputDir: "ed-certification-batch-007",
    artifactName: "ed-certification-batch-007-review.json",
    pageTitle: "ED Certification Batch 007 Review",
    pageKicker: "Applied ED Batch 007 review",
    previousRoute: "/ed-certification-batch-006/",
    nextRoute: "/ed-certification-batch-008/"
  },
  {
    reviewBatchId: "ed_certification_batch_008",
    sourceBatchId: "ed_dataset_batch_001",
    dataPathKey: "edCertificationBatch008Review",
    route: "/ed-certification-batch-008/",
    outputDir: "ed-certification-batch-008",
    artifactName: "ed-certification-batch-008-review.json",
    pageTitle: "ED Certification Batch 008 Review",
    pageKicker: "Applied ED Batch 008 review",
    previousRoute: "/ed-certification-batch-007/",
    nextRoute: null
  }
];

export function reviewSpecByBatchId(reviewBatchId) {
  const spec = ED_CERTIFICATION_REVIEW_SPECS.find((candidate) => candidate.reviewBatchId === reviewBatchId);
  if (!spec) throw new Error(`Unknown ED certification review batch: ${reviewBatchId}`);
  return spec;
}

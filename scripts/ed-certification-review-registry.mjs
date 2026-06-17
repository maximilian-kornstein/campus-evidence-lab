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
    nextRoute: null
  }
];

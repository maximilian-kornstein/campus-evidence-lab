import test from "node:test";
import assert from "node:assert/strict";
import {
  auditRecordQuality,
  buildGoldV1CertificationStatus,
  buildRecordQualityAudit,
  buildRecordQualityReviewerPacket,
  hasProhibitedRecordAuditClaim,
  validateRecordQualityAudit
} from "../scripts/record-quality-audit-lib.mjs";

const sources = [
  {
    id: "src_dataset",
    title: "Campus Safety and Security Data Analysis Cutting Tool 2025 Excel data files",
    publisher: "U.S. Department of Education Office of Postsecondary Education",
    source_type: "Government dataset",
    published_date: "2026-04-30",
    accessed_date: "2026-06-03",
    url: "https://example.edu/Crime2025EXCEL.zip"
  },
  {
    id: "src_ocr_mixed",
    title: "What's New in OCR",
    publisher: "U.S. Department of Education Office for Civil Rights",
    source_type: "Government release",
    published_date: "Mixed",
    accessed_date: "2026-06-03",
    url: "https://example.edu/ocr"
  },
  {
    id: "src_university_redirect",
    title: "Hate/bias investigation update",
    publisher: "Towson University",
    source_type: "University statement",
    published_date: "2016-11-16",
    accessed_date: "2026-06-03",
    url: "https://example.edu/news/2016/hatebiasupdate.html"
  }
];

const events = [
  {
    id: "evt_2026_0001",
    school_id: "adams_state_university",
    date: "2022-01-01",
    date_precision: "year",
    affected_communities: ["Race"],
    category: "Harassment or threat",
    summary: "ED campus safety data listed one hate-crime statistic: Aggravated assault characterized by Race.",
    description: "The government dataset cell listed an aggravated assault characterized by Race.",
    source_ids: ["src_dataset"],
    source_types: ["Government dataset"],
    institutional_response:
      "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
    verification_status: "Verified from public source",
    confidence: "Medium"
  },
  {
    id: "evt_2026_0002",
    school_id: "emory_university",
    date: "2025-01-16",
    date_precision: "day",
    affected_communities: ["Muslim", "Palestinian"],
    category: "OCR complaint",
    summary: "OCR announced a resolution agreement.",
    description: "According to OCR's What's New page, the agency announced a resolution agreement.",
    source_ids: ["src_ocr_mixed"],
    source_types: ["Government release"],
    institutional_response: "The record summarizes OCR's public announcement and does not independently evaluate the institution's completed response.",
    verification_status: "Verified from public source",
    confidence: "Medium"
  },
  {
    id: "evt_2026_0003",
    school_id: "towson_university",
    date: "2016-11-16",
    date_precision: "day",
    affected_communities: ["Black"],
    category: "Institutional response",
    summary: "Towson University publicly updated a hate/bias investigation.",
    description: "The university update described an investigation and a campus denial of access.",
    source_ids: ["src_university_redirect"],
    source_types: ["University statement"],
    institutional_response: "The university update states that campus police identified the non-affiliate and issued a denial of access to campus.",
    classification_rationale: "The category reflects a direct public institutional update rather than an independent legal finding.",
    community_rationale: "The affected-community label follows the public statement summary stored in the record metadata.",
    confidence_rationale: "High confidence reflects a linked public university statement and not an assessment of severity.",
    verification_status: "Verified from public source",
    confidence: "High"
  }
];

const liveAudit = {
  entries: [
    {
      source_id: "src_dataset",
      launch_check_status: "live_checked",
      live_status: "ok",
      http_status: 200,
      final_url: "https://example.edu/Crime2025EXCEL.zip"
    },
    {
      source_id: "src_ocr_mixed",
      launch_check_status: "live_checked",
      live_status: "ok",
      http_status: 200,
      final_url: "https://example.edu/ocr"
    },
    {
      source_id: "src_university_redirect",
      launch_check_status: "live_checked",
      live_status: "ok",
      http_status: 200,
      final_url: "https://example.edu/news/"
    }
  ]
};

test("auditRecordQuality flags dataset locator, broad label, year precision, thin response, and category-fit risk", () => {
  const audit = auditRecordQuality(events[0], { sources, liveAudit });
  assert.equal(audit.audit_status, "needs_internal_review");
  assert.equal(audit.issue_ids.includes("dataset_cell_locator_needed"), true);
  assert.equal(audit.issue_ids.includes("broad_affected_community_label"), true);
  assert.equal(audit.issue_ids.includes("year_precision_public_use_limit"), true);
  assert.equal(audit.issue_ids.includes("thin_response_note"), true);
  assert.equal(audit.issue_ids.includes("category_may_be_too_generic_for_offense"), true);
});

test("auditRecordQuality treats redirecting source locators as blockers even when live status is ok", () => {
  const audit = auditRecordQuality(events[2], { sources, liveAudit });
  assert.equal(audit.audit_status, "blocked_before_external_packet");
  assert.equal(audit.issue_ids.includes("source_redirect_locator_risk"), true);
});

test("auditRecordQuality flags day precision and item-locator review for mixed OCR source pages", () => {
  const audit = auditRecordQuality(events[1], { sources, liveAudit });
  assert.equal(audit.issue_ids.includes("aggregated_source_item_locator_needed"), true);
  assert.equal(audit.issue_ids.includes("day_precision_from_mixed_date_source"), true);
  assert.equal(audit.issue_ids.includes("high_stakes_record_needs_explicit_rationale"), true);
});

test("auditRecordQuality accepts source-specific workbook, page, and aggregate item locators", () => {
  const datasetAudit = auditRecordQuality(
    {
      ...events[0],
      source_locators: [
        {
          source_id: "src_dataset",
          locator_type: "workbook_cell",
          locator: "Crime2025EXCEL.zip > Oncampushate222324.xlsx > sheet1 row 42 > column INTIM_RAC22",
          workbook: "Oncampushate222324.xlsx",
          sheet: "sheet1",
          row: 42,
          column: "INTIM_RAC22",
          cell: "INTIM_RAC22 row 42"
        }
      ]
    },
    { sources, liveAudit }
  );
  assert.equal(datasetAudit.issue_ids.includes("dataset_cell_locator_needed"), false);

  const pageAudit = auditRecordQuality(
    {
      ...events[2],
      source_ids: ["src_asr"],
      source_types: ["Annual security report"],
      source_locators: [
        {
          source_id: "src_asr",
          locator_type: "page_table",
          locator: "Annual Security Report, Hate Crime Statistics table, p. 52",
          page: "52",
          table: "Hate Crime Statistics"
        }
      ]
    },
    {
      sources: [
        ...sources,
        {
          id: "src_asr",
          title: "Annual Security Report",
          publisher: "Example University",
          source_type: "Annual security report",
          published_date: "2025-10-01",
          accessed_date: "2026-06-03",
          url: "https://example.edu/asr.pdf"
        }
      ],
      liveAudit
    }
  );
  assert.equal(pageAudit.issue_ids.includes("page_table_locator_needed"), false);

  const aggregateAudit = auditRecordQuality(
    {
      ...events[1],
      source_locators: [
        {
          source_id: "src_ocr_mixed",
          locator_type: "aggregate_item",
          locator: "What's New in OCR item dated January 16, 2025, Emory University resolution agreement",
          item_date: "2025-01-16",
          item_label: "Emory University resolution agreement"
        }
      ],
      classification_rationale: "The OCR item states that the matter was resolved through a resolution agreement.",
      confidence_rationale: "Confidence is limited to the source-to-record support from the item-level OCR locator."
    },
    { sources, liveAudit }
  );
  assert.equal(aggregateAudit.issue_ids.includes("aggregated_source_item_locator_needed"), false);
  assert.equal(aggregateAudit.issue_ids.includes("day_precision_from_mixed_date_source"), false);

  const monthAggregateAudit = auditRecordQuality(
    {
      ...events[1],
      date: "2025-01-01",
      date_precision: "month",
      source_locators: [
        {
          source_id: "src_ocr_mixed",
          locator_type: "aggregate_item",
          locator: "What's New in OCR January 2025 item, Johns Hopkins University shared ancestry resolution",
          item_date: "2025-01-01",
          item_date_precision: "month",
          item_label: "Johns Hopkins University shared ancestry resolution"
        }
      ],
      classification_rationale: "The OCR item states that the matter was resolved through a resolution agreement.",
      confidence_rationale: "Confidence is limited to the source-to-record support from the item-level OCR locator."
    },
    { sources, liveAudit }
  );
  assert.equal(monthAggregateAudit.issue_ids.includes("aggregated_source_item_locator_needed"), false);
  assert.equal(monthAggregateAudit.issue_ids.includes("day_precision_from_mixed_date_source"), false);
});

test("auditRecordQuality accepts source-specific certification rationales for bounded year-level records", () => {
  const audit = auditRecordQuality(
    {
      ...events[0],
      summary: "ED campus safety data listed one hate-crime statistic: intimidation characterized by Race.",
      description:
        "The government dataset cell listed one intimidation statistic characterized by Race; the source supports a year-level statistic, not an exact incident date.",
      response_depth: "limited_public_response_note",
      source_locators: [
        {
          source_id: "src_dataset",
          locator_type: "workbook_cell",
          locator: "Crime2025EXCEL.zip > Oncampushate222324.xlsx > sheet1 row 42 > column INTIM_RAC22 > cell DS42",
          workbook: "Oncampushate222324.xlsx",
          sheet: "sheet1",
          row: 42,
          column: "INTIM_RAC22",
          cell: "DS42"
        }
      ],
      classification_rationale:
        "The official dataset column INTIM_RAC22 identifies an intimidation statistic; the Harassment or threat category is limited to that structured source field.",
      community_rationale:
        "The Race label is retained because the official dataset column INTIM_RAC22 uses a Race bias category; no narrower community is inferred.",
      confidence_rationale:
        "Medium confidence reflects a single official workbook cell with year-level timing and broad bias-category metadata; it is not a severity score or legal finding."
    },
    { sources, liveAudit }
  );

  assert.equal(audit.issue_ids.includes("year_precision_public_use_limit"), false);
  assert.equal(audit.issue_ids.includes("broad_affected_community_label"), false);
  assert.equal(audit.issue_ids.includes("thin_response_note"), false);
  assert.equal(audit.issue_ids.includes("missing_explicit_rationales"), false);
  assert.equal(audit.issue_ids.includes("category_may_be_too_generic_for_offense"), false);
});

test("auditRecordQuality keeps label-boundary issues when source-specific rationale says labels remain unresolved", () => {
  const audit = auditRecordQuality(
    {
      ...events[1],
      affected_communities: ["Jewish", "Muslim", "Palestinian", "Arab"],
      source_locators: [
        {
          source_id: "src_ocr_mixed",
          locator_type: "aggregate_item",
          locator: "What's New in OCR January 2025 shared ancestry item",
          item_date: "2025-01-01",
          item_date_precision: "month",
          item_label: "Shared ancestry resolution item"
        }
      ],
      date: "2025-01-01",
      date_precision: "month",
      classification_rationale:
        "The OCR aggregate item identifies a shared ancestry resolution; the OCR complaint category is limited to that public item.",
      community_rationale:
        "The aggregate item says shared ancestry but does not by itself certify each listed label; Jewish, Muslim, Palestinian, and Arab remain unresolved pending item-level document review.",
      confidence_rationale:
        "Medium confidence reflects one OCR aggregate item locator with month-level timing and unresolved label boundaries; it is not a severity score or legal finding.",
      response_depth: "limited_public_response_note"
    },
    { sources, liveAudit }
  );

  assert.equal(audit.issue_ids.includes("generic_or_generated_rationale"), false);
  assert.equal(audit.issue_ids.includes("multi_community_label_boundary_review"), true);
});

test("buildRecordQualityAudit produces all-record rows, priority rows, and expanded Gold v1 pre-review rows", () => {
  const goldRecordV1 = {
    records: [
      {
        event_id: "evt_2026_0001",
        status: "gold_v1_review_packet",
        selection_reason: "test packet",
        challenge_url: "/challenge/?packet=evt_2026_0001"
      }
    ]
  };
  const artifact = buildRecordQualityAudit({
    events,
    sources,
    liveAudit,
    goldRecordV1,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" },
    priorityLimit: 2
  });

  assert.equal(artifact.id, "record_quality_audit_v1");
  assert.equal(artifact.records.length, 3);
  assert.equal(artifact.priority_records.length, 2);
  assert.equal(artifact.gold_v1_pre_review.length, 1);
  assert.equal(artifact.gold_v1_pre_review[0].issues.length > 0, true);
  assert.equal(hasProhibitedRecordAuditClaim(JSON.stringify(artifact)), false);
});

test("buildRecordQualityReviewerPacket summarizes all-record risk and source locator issues for external reviewers", () => {
  const audit = buildRecordQualityAudit({
    events,
    sources,
    liveAudit,
    goldRecordV1: {
      records: [
        {
          event_id: "evt_2026_0001",
          status: "gold_v1_review_packet",
          selection_reason: "test packet",
          challenge_url: "/challenge/?packet=evt_2026_0001"
        }
      ]
    },
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" },
    priorityLimit: 3
  });

  const packet = buildRecordQualityReviewerPacket({
    audit,
    sources,
    liveAudit,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" },
    limit: 2
  });

  assert.equal(packet.id, "record_quality_reviewer_packet_v1");
  assert.equal(packet.review_scope.records_checked, 3);
  assert.equal(packet.source_link_review.sources_checked_live, 3);
  assert.equal(packet.source_link_review.hard_broken_sources.length, 0);
  assert.deepEqual(packet.source_link_review.locator_risk_sources.map((source) => source.source_id), ["src_university_redirect"]);
  assert.equal(packet.source_link_review.records_affected_by_locator_risk.includes("evt_2026_0003"), true);
  assert.equal(packet.priority_queues.blocker_records.records[0].event_id, "evt_2026_0003");
  assert.equal(packet.priority_queues.gold_v1_records.records[0].event_id, "evt_2026_0001");
  assert.equal(packet.reviewer_checklist.length >= 6, true);
  assert.equal(hasProhibitedRecordAuditClaim(JSON.stringify(packet)), false);
});

test("buildGoldV1CertificationStatus applies strict no-known-blocker gates before certification", () => {
  const audit = buildRecordQualityAudit({
    events,
    sources,
    liveAudit,
    goldRecordV1: {
      records: [
        {
          event_id: "evt_2026_0001",
          status: "gold_v1_review_packet",
          selection_reason: "test packet",
          challenge_url: "/challenge/?packet=evt_2026_0001"
        },
        {
          event_id: "evt_2026_0003",
          status: "gold_v1_review_packet",
          selection_reason: "test packet",
          challenge_url: "/challenge/?packet=evt_2026_0003"
        }
      ]
    },
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" },
    priorityLimit: 3
  });
  const goldRecordV1 = {
    records: [
      {
        event_id: "evt_2026_0001",
        school_name: "Adams State University",
        category: "Harassment or threat",
        confidence: "Medium",
        challenge_url: "/challenge/?packet=evt_2026_0001"
      },
      {
        event_id: "evt_2026_0003",
        school_name: "Towson University",
        category: "Institutional response",
        confidence: "High",
        challenge_url: "/challenge/?packet=evt_2026_0003"
      }
    ]
  };

  const status = buildGoldV1CertificationStatus({
    audit,
    goldRecordV1,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" }
  });

  assert.equal(status.id, "gold_v1_certification_status");
  assert.equal(status.records.length, 2);
  assert.equal(status.totals.certified, 0);
  assert.equal(status.records.find((record) => record.event_id === "evt_2026_0003").certification_status, "blocked");
  assert.equal(status.records.find((record) => record.event_id === "evt_2026_0003").gates.source_locator.status, "fail");
  assert.equal(status.records.find((record) => record.event_id === "evt_2026_0001").certification_status, "not_certified");
  assert.equal(status.records.find((record) => record.event_id === "evt_2026_0001").gates.dataset_cell_or_item_locator.status, "fail");
  assert.equal(hasProhibitedRecordAuditClaim(JSON.stringify(status)), false);
});

test("validateRecordQualityAudit rejects missing event coverage and prohibited claims", () => {
  const artifact = buildRecordQualityAudit({
    events,
    sources,
    liveAudit,
    goldRecordV1: { records: [] },
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" }
  });
  assert.deepEqual(
    validateRecordQualityAudit({
      audit: artifact,
      events,
      goldRecordV1: { records: [] },
      manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" }
    }),
    []
  );

  const bad = structuredClone(artifact);
  bad.public_claim_limit = "externally validated safety score";
  assert.equal(validateRecordQualityAudit({ audit: bad, events, goldRecordV1: { records: [] }, manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" } }).length > 0, true);
});

test("validateRecordQualityAudit allows certified Gold rows with no open deterministic issues", () => {
  const cleanSources = [
    {
      id: "src_clean_university_statement",
      title: "Campus message",
      publisher: "Example University",
      source_type: "University statement",
      published_date: "2026-01-15",
      accessed_date: "2026-06-03",
      url: "https://example.edu/campus-message"
    }
  ];
  const cleanEvents = [
    {
      id: "evt_2026_0100",
      school_id: "example_university",
      date: "2026-01-15",
      date_precision: "day",
      affected_communities: ["Jewish"],
      category: "Public statement",
      summary: "Example University published a campus message about reported antisemitic harassment.",
      description: "The university statement described reported antisemitic harassment and campus support resources.",
      source_ids: ["src_clean_university_statement"],
      source_types: ["University statement"],
      institutional_response: "The university statement described direct outreach, support resources, and reporting options.",
      response_depth: "direct_institutional_response",
      classification_rationale: "The linked university statement is a public campus message, so the record uses Public statement as a documentation category.",
      community_rationale: "The Jewish label is limited to the statement's antisemitic-harassment wording.",
      confidence_rationale: "High confidence is limited to source-to-record support from a live, item-specific university statement.",
      verification_status: "Verified from public source",
      confidence: "High"
    }
  ];
  const cleanLiveAudit = {
    entries: [
      {
        source_id: "src_clean_university_statement",
        launch_check_status: "live_checked",
        live_status: "ok",
        http_status: 200,
        final_url: "https://example.edu/campus-message"
      }
    ]
  };
  const artifact = buildRecordQualityAudit({
    events: cleanEvents,
    sources: cleanSources,
    liveAudit: cleanLiveAudit,
    goldRecordV1: {
      records: [
        {
          event_id: "evt_2026_0100",
          status: "gold_v1_review_packet",
          selection_reason: "test certified packet",
          challenge_url: "/challenge/?record=evt_2026_0100"
        }
      ]
    },
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" }
  });

  const goldRow = artifact.gold_v1_pre_review.find((row) => row.event_id === "evt_2026_0100");
  assert.deepEqual(goldRow.issue_ids, []);
  assert.deepEqual(goldRow.issues, []);
  assert.equal(goldRow.highest_severity, "none");

  assert.deepEqual(
    validateRecordQualityAudit({
      audit: artifact,
      events: cleanEvents,
      goldRecordV1: {
        records: [
          {
            event_id: "evt_2026_0100",
            status: "gold_v1_review_packet",
            selection_reason: "test certified packet",
            challenge_url: "/challenge/?record=evt_2026_0100"
          }
        ]
      },
      manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" }
    }),
    []
  );
});

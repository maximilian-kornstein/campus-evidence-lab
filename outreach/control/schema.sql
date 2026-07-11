PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  aliases TEXT NOT NULL DEFAULT '[]',
  relationship_status TEXT NOT NULL DEFAULT 'unknown',
  block_level TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_domain
ON organizations(domain)
WHERE domain != '';

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  organization_id TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unknown',
  relationship_status TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email
ON contacts(email)
WHERE email != '';

CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(domain);
CREATE INDEX IF NOT EXISTS idx_contacts_organization ON contacts(organization_id);

CREATE TABLE IF NOT EXISTS gmail_items (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL DEFAULT '',
  item_type TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  from_email TEXT NOT NULL DEFAULT '',
  to_emails TEXT NOT NULL DEFAULT '[]',
  labels TEXT NOT NULL DEFAULT '[]',
  email_ts TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  body_excerpt TEXT NOT NULL DEFAULT '',
  is_cel INTEGER NOT NULL DEFAULT 0,
  is_future_or_scheduled INTEGER NOT NULL DEFAULT 0,
  person_key TEXT NOT NULL DEFAULT '',
  domain_key TEXT NOT NULL DEFAULT '',
  organization_key TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gmail_items_type ON gmail_items(item_type);
CREATE INDEX IF NOT EXISTS idx_gmail_items_domain ON gmail_items(domain_key);
CREATE INDEX IF NOT EXISTS idx_gmail_items_person ON gmail_items(person_key);
CREATE INDEX IF NOT EXISTS idx_gmail_items_org ON gmail_items(organization_key);
CREATE INDEX IF NOT EXISTS idx_gmail_items_cel ON gmail_items(is_cel);
CREATE INDEX IF NOT EXISTS idx_gmail_items_future ON gmail_items(is_future_or_scheduled);

CREATE TABLE IF NOT EXISTS gmail_snapshot_imports (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL DEFAULT '',
  snapshot_at TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  item_count INTEGER NOT NULL DEFAULT 0,
  label_count INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gmail_snapshot_imports_snapshot_at
ON gmail_snapshot_imports(snapshot_at);

CREATE TABLE IF NOT EXISTS gmail_label_counts (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL DEFAULT '',
  label_name TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (import_id) REFERENCES gmail_snapshot_imports(id)
);

CREATE INDEX IF NOT EXISTS idx_gmail_label_counts_import ON gmail_label_counts(import_id);
CREATE INDEX IF NOT EXISTS idx_gmail_label_counts_label ON gmail_label_counts(label_name);

CREATE TABLE IF NOT EXISTS relationship_events (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL DEFAULT '',
  organization_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL DEFAULT '',
  permission TEXT NOT NULL DEFAULT '',
  block_level TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  next_action_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_relationship_events_contact ON relationship_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_relationship_events_org ON relationship_events(organization_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_send_date TEXT NOT NULL DEFAULT '',
  campaign_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_targets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL DEFAULT '',
  contact_id TEXT NOT NULL DEFAULT '',
  organization_id TEXT NOT NULL DEFAULT '',
  intended_ask TEXT NOT NULL DEFAULT '',
  template_type TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'needs_preflight',
  draft_status TEXT NOT NULL DEFAULT 'not_drafted',
  scheduled_date TEXT NOT NULL DEFAULT '',
  preflight_run_id TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (preflight_run_id) REFERENCES preflight_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_contact ON campaign_targets(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_org ON campaign_targets(organization_id);

CREATE TABLE IF NOT EXISTS preflight_runs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  checklist_path TEXT NOT NULL,
  checklist_sha256 TEXT NOT NULL,
  ran_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (target_id) REFERENCES campaign_targets(id)
);

CREATE INDEX IF NOT EXISTS idx_preflight_runs_target ON preflight_runs(target_id);

CREATE TABLE IF NOT EXISTS duplicate_flags (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL DEFAULT '',
  contact_id TEXT NOT NULL DEFAULT '',
  organization_id TEXT NOT NULL DEFAULT '',
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  evidence_item_id TEXT NOT NULL DEFAULT '',
  evidence_summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (target_id) REFERENCES campaign_targets(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_duplicate_flags_target ON duplicate_flags(target_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_flags_contact ON duplicate_flags(contact_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_flags_org ON duplicate_flags(organization_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_flags_type ON duplicate_flags(flag_type);

CREATE TABLE IF NOT EXISTS target_pool (
  id TEXT PRIMARY KEY,
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  organization_name TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  lane TEXT NOT NULL CHECK (lane IN ('usage', 'protocol')),
  category TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  fit_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'imported', 'blocked', 'exhausted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_target_pool_email
ON target_pool(email)
WHERE email != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_target_pool_domain_contact
ON target_pool(domain, contact_name)
WHERE email = '' AND domain != '' AND contact_name != '';

CREATE INDEX IF NOT EXISTS idx_target_pool_lane ON target_pool(lane);
CREATE INDEX IF NOT EXISTS idx_target_pool_status ON target_pool(status);
CREATE INDEX IF NOT EXISTS idx_target_pool_domain ON target_pool(domain);

CREATE TABLE IF NOT EXISTS outreach_queue (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  lane TEXT NOT NULL CHECK (lane IN ('usage', 'protocol')),
  send_date TEXT NOT NULL DEFAULT '',
  send_window_start TEXT NOT NULL DEFAULT '',
  send_window_end TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'draft_created', 'ready_to_send', 'sent', 'blocked', 'error', 'cancelled')),
  gmail_draft_id TEXT NOT NULL DEFAULT '',
  gmail_message_id TEXT NOT NULL DEFAULT '',
  gmail_thread_id TEXT NOT NULL DEFAULT '',
  gmail_label TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL DEFAULT '',
  last_preflight_run_id TEXT DEFAULT NULL,
  last_live_check_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (target_id) REFERENCES campaign_targets(id),
  FOREIGN KEY (last_preflight_run_id) REFERENCES preflight_runs(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_outreach_queue_idempotency
ON outreach_queue(idempotency_key)
WHERE idempotency_key != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_outreach_queue_gmail_draft
ON outreach_queue(gmail_draft_id)
WHERE gmail_draft_id != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_outreach_queue_active_target
ON outreach_queue(target_id)
WHERE status IN ('planned', 'draft_created', 'ready_to_send');

CREATE INDEX IF NOT EXISTS idx_outreach_queue_campaign ON outreach_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_target ON outreach_queue(target_id);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_send_date ON outreach_queue(send_date);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_status ON outreach_queue(status);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_lane ON outreach_queue(lane);

CREATE TABLE IF NOT EXISTS send_attempts (
  id TEXT PRIMARY KEY,
  queue_id TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL DEFAULT '',
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result TEXT NOT NULL CHECK (result IN ('sent', 'blocked', 'error', 'would_send')),
  gmail_message_id TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  live_check_summary TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (queue_id) REFERENCES outreach_queue(id)
);

CREATE INDEX IF NOT EXISTS idx_send_attempts_queue ON send_attempts(queue_id);
CREATE INDEX IF NOT EXISTS idx_send_attempts_result ON send_attempts(result);
CREATE INDEX IF NOT EXISTS idx_send_attempts_idempotency ON send_attempts(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_send_attempt_success
ON send_attempts(idempotency_key)
WHERE result = 'sent' AND idempotency_key != '';

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL CHECK (run_type IN ('fill_queue', 'create_drafts', 'send_due', 'followup_scan', 'followup_send')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT 'ok' CHECK (result IN ('ok', 'partial', 'blocked', 'error')),
  summary TEXT NOT NULL DEFAULT '',
  created_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_type ON automation_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started ON automation_runs(started_at);

CREATE TABLE IF NOT EXISTS followup_queue (
  id TEXT PRIMARY KEY,
  source_thread_id TEXT NOT NULL DEFAULT '',
  source_message_id TEXT NOT NULL DEFAULT '',
  original_sent_message_id TEXT NOT NULL DEFAULT '',
  contact_id TEXT DEFAULT NULL,
  organization_id TEXT DEFAULT NULL,
  sequence_no INTEGER NOT NULL DEFAULT 1,
  due_date TEXT NOT NULL DEFAULT '',
  send_window_start TEXT NOT NULL DEFAULT '',
  send_window_end TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'draft_created', 'ready_to_send', 'sent', 'blocked', 'error', 'cancelled')),
  gmail_draft_id TEXT NOT NULL DEFAULT '',
  gmail_message_id TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL DEFAULT '',
  last_thread_check_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_followup_thread_sequence
ON followup_queue(source_thread_id, sequence_no)
WHERE source_thread_id != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_followup_idempotency
ON followup_queue(idempotency_key)
WHERE idempotency_key != '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_followup_gmail_draft
ON followup_queue(gmail_draft_id)
WHERE gmail_draft_id != '';

CREATE INDEX IF NOT EXISTS idx_followup_queue_status ON followup_queue(status);
CREATE INDEX IF NOT EXISTS idx_followup_queue_due_date ON followup_queue(due_date);
CREATE INDEX IF NOT EXISTS idx_followup_queue_contact ON followup_queue(contact_id);
CREATE INDEX IF NOT EXISTS idx_followup_queue_org ON followup_queue(organization_id);

CREATE TABLE IF NOT EXISTS signals_partner_events (
  id TEXT PRIMARY KEY,
  campaign_target_id TEXT NOT NULL DEFAULT '',
  organization_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL CHECK (event_type IN ('invited','followed_up','subscribed','embedded','webhook_enabled','declined','opted_out','cancelled')),
  feed_key TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (campaign_target_id) REFERENCES campaign_targets(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_signals_partner_target ON signals_partner_events(campaign_target_id);
CREATE INDEX IF NOT EXISTS idx_signals_partner_org ON signals_partner_events(organization_id);

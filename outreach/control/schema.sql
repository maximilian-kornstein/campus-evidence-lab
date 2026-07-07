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
  preflight_run_id TEXT NOT NULL DEFAULT '',
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

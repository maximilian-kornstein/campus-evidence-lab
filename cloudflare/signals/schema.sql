CREATE TABLE IF NOT EXISTS controls (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO controls (key, value) VALUES ('global_pause', 'true');
INSERT OR IGNORE INTO controls (key, value) VALUES ('bluesky_status', 'shadow');
INSERT OR IGNORE INTO controls (key, value) VALUES ('approved_shadow_count', '0');
INSERT OR IGNORE INTO controls (key, value) VALUES ('activation_status', 'inactive');
INSERT OR IGNORE INTO controls (key, value) VALUES ('activated_at', '');
INSERT OR IGNORE INTO controls (key, value) VALUES ('partner_outreach_status', 'paused');

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('shadow','approved','published','paused','withdrawn')),
  signal_type TEXT NOT NULL DEFAULT 'source_context',
  policy_version TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  distribution_group TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_institution ON signals(institution_id);

CREATE TABLE IF NOT EXISTS signal_sources (
  signal_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_url TEXT NOT NULL,
  PRIMARY KEY (signal_id, source_id),
  FOREIGN KEY (signal_id) REFERENCES signals(id)
);

CREATE TABLE IF NOT EXISTS distribution_events (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'original',
  idempotency_key TEXT NOT NULL UNIQUE,
  attribution_code TEXT NOT NULL UNIQUE,
  result TEXT NOT NULL,
  external_id TEXT NOT NULL DEFAULT '',
  institution_id TEXT NOT NULL,
  material_update INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (signal_id) REFERENCES signals(id)
);
CREATE INDEX IF NOT EXISTS idx_distribution_signal ON distribution_events(signal_id);
CREATE INDEX IF NOT EXISTS idx_distribution_day ON distribution_events(channel, attempted_at);

CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  actor_id TEXT NOT NULL DEFAULT '',
  institution_id TEXT NOT NULL DEFAULT '',
  action_count INTEGER NOT NULL DEFAULT 0,
  opted_out INTEGER NOT NULL DEFAULT 0,
  last_action_at TEXT NOT NULL DEFAULT '',
  pending_action TEXT NOT NULL DEFAULT '',
  UNIQUE(platform, thread_id)
);

CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  evidence_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  received_at TEXT NOT NULL,
  resolved_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (signal_id) REFERENCES signals(id)
);

CREATE TABLE IF NOT EXISTS attribution_events (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  attribution_code TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  visitor_hash TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (signal_id) REFERENCES signals(id)
);
CREATE INDEX IF NOT EXISTS idx_attribution_signal ON attribution_events(signal_id, event_type);

CREATE TABLE IF NOT EXISTS outcomes (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  outcome_type TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  attribution TEXT NOT NULL CHECK (attribution IN ('direct','contributed','plausible','unknown')),
  verified INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (signal_id) REFERENCES signals(id)
);

CREATE TABLE IF NOT EXISTS partner_subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL DEFAULT '',
  feed_key TEXT NOT NULL,
  delivery_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, feed_key, delivery_type)
);

CREATE TABLE IF NOT EXISTS institution_aliases (
  alias TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signal_dossiers (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  calculation_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trigger_events (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  institution_id TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'collected',
  published_at TEXT NOT NULL DEFAULT '',
  collected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_state (
  provider_id TEXT PRIMARY KEY,
  cursor TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unknown',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  quota_remaining INTEGER,
  retry_after TEXT NOT NULL DEFAULT '',
  last_success_at TEXT NOT NULL DEFAULT '',
  last_error_at TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS shadow_reviews (
  signal_id TEXT PRIMARY KEY,
  passed INTEGER NOT NULL,
  reason_codes TEXT NOT NULL DEFAULT '[]',
  policy_version TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  FOREIGN KEY (signal_id) REFERENCES signals(id)
);

CREATE TABLE IF NOT EXISTS reply_queue (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('ask_cel','proactive_reply')),
  actor_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  parent_uri TEXT NOT NULL,
  parent_cid TEXT NOT NULL,
  root_uri TEXT NOT NULL,
  root_cid TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  copy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_reply_queue_status ON reply_queue(status, action_type, created_at);

CREATE TABLE IF NOT EXISTS follower_snapshots (
  captured_at TEXT PRIMARY KEY,
  followers_count INTEGER NOT NULL,
  follows_count INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS partner_outreach_queue (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  organization_name TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  sequence_no INTEGER NOT NULL DEFAULT 1,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  idempotency_key TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT NOT NULL DEFAULT '',
  gmail_message_id TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  UNIQUE(contact_email, sequence_no)
);

CREATE TABLE IF NOT EXISTS partner_send_attempts (
  id TEXT PRIMARY KEY,
  queue_id TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  result TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  gmail_message_id TEXT NOT NULL DEFAULT '',
  UNIQUE(queue_id, result)
);

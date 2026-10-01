CREATE TABLE devices (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE INDEX devices_expiry ON devices(expires_at);
CREATE TABLE live_shares (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  lat REAL NOT NULL, lon REAL NOT NULL, accuracy REAL NOT NULL,
  updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX live_shares_expiry ON live_shares(expires_at);
CREATE INDEX live_shares_device ON live_shares(device_id);
CREATE TABLE retired_share_keys (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX retired_share_expiry ON retired_share_keys(expires_at);
CREATE INDEX retired_share_token ON retired_share_keys(token_hash);

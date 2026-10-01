CREATE TABLE IF NOT EXISTS provider_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS cache_expiry ON provider_cache(expires_at);
CREATE TABLE IF NOT EXISTS provider_gates (name TEXT PRIMARY KEY, next_at INTEGER NOT NULL);

CREATE TABLE users (id TEXT PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE login_challenges (nonce_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE INDEX login_challenges_expiry ON login_challenges(expires_at);
CREATE TABLE favorites (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, place_id TEXT NOT NULL, data TEXT NOT NULL, saved_at INTEGER NOT NULL, PRIMARY KEY(user_id, place_id));

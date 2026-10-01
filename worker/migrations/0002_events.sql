CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL,
 address TEXT NOT NULL, description TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')), created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_public ON events(status,date);
CREATE TABLE IF NOT EXISTS submission_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, next_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);

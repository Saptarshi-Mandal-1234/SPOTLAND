CREATE TABLE venues (id TEXT PRIMARY KEY, data TEXT NOT NULL, booking_links TEXT NOT NULL, price_note TEXT NOT NULL, price_updated_at TEXT, status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')), created_at INTEGER NOT NULL);
CREATE INDEX venues_status ON venues(status);
CREATE TABLE venue_reports (id TEXT PRIMARY KEY, venue_id TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')), created_at INTEGER NOT NULL);

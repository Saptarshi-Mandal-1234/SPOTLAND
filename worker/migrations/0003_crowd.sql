CREATE TABLE crowd_reports (
  place_id TEXT NOT NULL,
  reporter_day TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('quiet','moderate','busy')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(place_id, reporter_day)
);
CREATE INDEX crowd_place_time ON crowd_reports(place_id, created_at);

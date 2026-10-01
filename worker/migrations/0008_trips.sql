CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trip_date TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('walk','drive','cycle')),
  saved_at INTEGER NOT NULL,
  mutation_key TEXT NOT NULL
);
CREATE INDEX trips_owner ON trips(user_id,saved_at DESC);
CREATE TABLE trip_stops (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL CHECK (sort_order BETWEEN 0 AND 7),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  PRIMARY KEY (trip_id,sort_order)
);

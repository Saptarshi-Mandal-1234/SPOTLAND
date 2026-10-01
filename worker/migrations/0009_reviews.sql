CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  text TEXT NOT NULL CHECK(length(text) BETWEEN 10 AND 1000),
  status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id,place_id)
);
CREATE INDEX reviews_place_status ON reviews(place_id,status,created_at);
CREATE TABLE review_reports (
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(review_id,user_id)
);

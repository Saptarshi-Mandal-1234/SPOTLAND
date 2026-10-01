CREATE TABLE review_photo_storage_budget (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  bytes_used INTEGER NOT NULL DEFAULT 0 CHECK(bytes_used>=0)
);
INSERT INTO review_photo_storage_budget (singleton,bytes_used) VALUES (1,0);

CREATE TABLE review_photos (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK(content_type='image/jpeg'),
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 3145728),
  status TEXT NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','pending','approved','hidden')),
  created_at INTEGER NOT NULL,
  slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 2),
  UNIQUE(review_id,slot)
);
CREATE INDEX review_photos_review_status ON review_photos(review_id,status,created_at);

CREATE TABLE review_photo_reports (
  photo_id TEXT NOT NULL REFERENCES review_photos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(photo_id,user_id)
);

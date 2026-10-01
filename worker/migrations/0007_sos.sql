ALTER TABLE devices ADD COLUMN geohash TEXT;
ALTER TABLE devices ADD COLUMN nearby_expires_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN push_sub TEXT;
CREATE INDEX devices_nearby ON devices(geohash,nearby_expires_at);
CREATE TABLE sos_alerts (
 id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
 geohash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','safe','hidden')),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, report_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sos_area ON sos_alerts(geohash,status,expires_at);
CREATE INDEX sos_device ON sos_alerts(device_id,created_at);
CREATE INDEX sos_expiry ON sos_alerts(expires_at);
CREATE TABLE sos_reports (alert_id TEXT NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE, PRIMARY KEY(alert_id,device_id));
CREATE TABLE sos_help (alert_id TEXT NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE, PRIMARY KEY(alert_id,device_id));
CREATE TABLE push_deliveries (
 alert_id TEXT NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
 device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('pending','sending','sent','failed')),
 attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
 PRIMARY KEY(alert_id,device_id)
);
CREATE INDEX push_pending ON push_deliveries(status,next_at);
CREATE TABLE retired_sos_ids (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE INDEX retired_sos_expiry ON retired_sos_ids(expires_at);

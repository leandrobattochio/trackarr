-- Demo data for the README media: four trackers with 60 hours of history, all fictional.
-- Apply to a trackarr.db the app has already migrated; it replaces every integration.

DELETE FROM "IntegrationSnapshots";
DELETE FROM "Integrations";

CREATE TEMP TABLE demo (
    id TEXT, plugin TEXT, payload TEXT, required TEXT,
    up_end INTEGER, down_end INTEGER, up_step INTEGER, down_step INTEGER,
    bonus_end INTEGER, buffer TEXT, hnr INTEGER, seeding INTEGER, leeching INTEGER, active INTEGER
);

INSERT INTO demo VALUES
    ('0F3A9C1E-2B7D-4E5A-9C81-6D2E4F1A0B01', 'seedpool',
     '{"baseUrl":"https://seedpool.org/","apiKey":"demo","required_ratio":"1.25","cron":"0 0 1 1 *"}', '1.25',
     20450000000000, 5981000000000, 60000000000, 10000000000, 48213, '13.16 TiB', 0, 412, 1, 3),
    ('0F3A9C1E-2B7D-4E5A-9C81-6D2E4F1A0B02', 'fearnopeer',
     '{"baseUrl":"https://fearnopeer.com/","apiKey":"demo","required_ratio":"1.0","cron":"0 0 1 1 *"}', '1.0',
     2310000000000, 1240000000000, 15000000000, 6000000000, 12904, '1.07 TiB', 1, 156, 0, 2),
    ('0F3A9C1E-2B7D-4E5A-9C81-6D2E4F1A0B03', 'bj-share',
     '{"baseUrl":"https://bj-share.info/","cookie":"demo","username":"demo","required_ratio":"0.8","cron":"0 0 1 1 *"}', '0.8',
     640000000000, 901000000000, 2000000000, 4000000000, 3120, NULL, NULL, 48, 2, 4),
    ('0F3A9C1E-2B7D-4E5A-9C81-6D2E4F1A0B04', 'asc',
     '{"baseUrl":"https://amigos-share.club/","cookie":"demo","required_ratio":"1.0","cron":"0 0 1 1 *"}', '1.0',
     4200000000000, 1900000000000, 25000000000, 8000000000, 27650, NULL, NULL, 233, 0, 1);

-- 120 snapshots per tracker, one every 30 minutes, ending now.
WITH RECURSIVE step(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM step WHERE i < 119),
points AS (
    SELECT d.*, s.i,
           d.up_end - (119 - s.i) * d.up_step - (abs(random()) % (d.up_step / 2)) * (s.i < 119) AS up,
           d.down_end - (119 - s.i) * d.down_step AS down
    FROM demo d CROSS JOIN step s
)
INSERT INTO "IntegrationSnapshots" (
    "Id", "IntegrationId", "CapturedAt", "Ratio", "UploadedBytes", "DownloadedBytes", "SeedBonus", "Buffer",
    "HitAndRuns", "RequiredRatio", "SeedingTorrents", "LeechingTorrents", "ActiveTorrents")
SELECT printf('%s-%s-4%s-A%s-%s', hex(randomblob(4)), hex(randomblob(2)), substr(hex(randomblob(2)), 2),
              substr(hex(randomblob(2)), 2), hex(randomblob(6))),
       id,
       strftime('%Y-%m-%d %H:%M:%S', 'now', printf('-%d minutes', (119 - i) * 30)),
       printf('%.2f', up * 1.0 / down), up, down,
       printf('%,d', bonus_end - (119 - i) * 3), buffer, hnr, required,
       seeding - (119 - i) / 20, leeching, active
FROM points;

INSERT INTO "Integrations" (
    "Id", "PluginId", "Payload", "LastSyncAt", "LastSyncResult", "Ratio", "UploadedBytes", "DownloadedBytes",
    "SeedBonus", "Buffer", "HitAndRuns", "RequiredRatio", "SeedingTorrents", "LeechingTorrents", "ActiveTorrents")
SELECT id, plugin, payload, strftime('%Y-%m-%d %H:%M:%S', 'now', '-4 minutes'), 'Success',
       printf('%.2f', up_end * 1.0 / down_end), up_end, down_end, printf('%,d', bonus_end), buffer, hnr, required,
       seeding, leeching, active
FROM demo;

DROP TABLE demo;

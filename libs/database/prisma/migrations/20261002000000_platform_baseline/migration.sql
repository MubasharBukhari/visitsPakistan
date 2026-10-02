BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE "platform_metadata" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "platform_metadata_pkey" PRIMARY KEY ("key")
);
INSERT INTO "platform_metadata" ("key", "value") VALUES ('schema_version', 'sprint-0');
COMMIT;

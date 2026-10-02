BEGIN;
-- CreateEnum
CREATE TYPE "EntityKind" AS ENUM ('GEO_ENTITY', 'PLACE', 'EXPERIENCE', 'CONTENT_ITEM', 'CUISINE', 'ROUTE', 'PARTNER', 'TRAVEL_PRODUCT');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "GeoEntityType" AS ENUM ('COUNTRY', 'REGION', 'PROVINCE_TERRITORY', 'CITY', 'DESTINATION', 'NEIGHBOURHOOD');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('HAS_ATTRACTION', 'HAS_EXPERIENCE', 'NEAR', 'PART_OF', 'HAS_CUISINE', 'HAS_ROUTE', 'ABOUT', 'VISITS', 'OPERATES');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('OFFICIAL', 'EDITORIAL', 'FIELD_OBSERVATION', 'DATASET', 'DEVELOPMENT_FIXTURE');

-- CreateEnum
CREATE TYPE "PlaceType" AS ENUM ('ATTRACTION', 'RESTAURANT', 'HOTEL', 'MARKET', 'VENUE', 'TRANSPORT_POINT');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('GUIDE', 'STORY', 'COLLECTION');

-- CreateTable
CREATE TABLE "entity_registry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "EntityKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "last_verified" TIMESTAMPTZ(6),
    "primary_source_id" UUID,
    "provenance" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "entity_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_entity" (
    "id" UUID NOT NULL,
    "kind" "EntityKind" NOT NULL DEFAULT 'GEO_ENTITY',
    "type" "GeoEntityType" NOT NULL,
    "parent_id" UUID,
    "alt_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "location" geography(Point,4326),

    CONSTRAINT "geo_entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place" (
    "id" UUID NOT NULL,
    "kind" "EntityKind" NOT NULL DEFAULT 'PLACE',
    "type" "PlaceType" NOT NULL,
    "geo_entity_id" UUID NOT NULL,
    "facts" JSONB NOT NULL DEFAULT '{}',
    "location" geography(Point,4326),

    CONSTRAINT "place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience" (
    "id" UUID NOT NULL,
    "kind" "EntityKind" NOT NULL DEFAULT 'EXPERIENCE',
    "geo_entity_id" UUID,
    "category" TEXT NOT NULL,
    "difficulty" TEXT,
    "duration_minutes" INTEGER,
    "seasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "facts" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_item" (
    "id" UUID NOT NULL,
    "kind" "EntityKind" NOT NULL DEFAULT 'CONTENT_ITEM',
    "type" "ContentType" NOT NULL,
    "cms_external_id" TEXT,
    "primary_entity_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "content_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_relation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" UUID NOT NULL,
    "source_kind" "EntityKind" NOT NULL,
    "target_id" UUID NOT NULL,
    "target_kind" "EntityKind" NOT NULL,
    "type" "RelationType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "source_record_id" UUID,
    "last_verified" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "entity_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_record" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_key" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "accessed_at" TIMESTAMPTZ(6) NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "retired_at" TIMESTAMPTZ(6),

    CONSTRAINT "source_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_source" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "fact_path" TEXT NOT NULL DEFAULT 'entity',
    "confidence" DOUBLE PRECISION,
    "reviewer" TEXT,
    "last_verified" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "entity_source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_registry_status_deleted_at_idx" ON "entity_registry"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "entity_registry_primary_source_id_idx" ON "entity_registry"("primary_source_id");

-- CreateIndex
CREATE INDEX "entity_registry_last_verified_idx" ON "entity_registry"("last_verified");

-- CreateIndex
CREATE UNIQUE INDEX "entity_registry_id_kind_key" ON "entity_registry"("id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "entity_registry_kind_locale_slug_key" ON "entity_registry"("kind", "locale", "slug");

-- CreateIndex
CREATE INDEX "geo_entity_parent_id_type_idx" ON "geo_entity"("parent_id", "type");

-- CreateIndex
CREATE INDEX "geo_entity_type_idx" ON "geo_entity"("type");

-- CreateIndex
CREATE UNIQUE INDEX "geo_entity_id_kind_key" ON "geo_entity"("id", "kind");

-- CreateIndex
CREATE INDEX "place_geo_entity_id_type_idx" ON "place"("geo_entity_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "place_id_kind_key" ON "place"("id", "kind");

-- CreateIndex
CREATE INDEX "experience_geo_entity_id_category_idx" ON "experience"("geo_entity_id", "category");

-- CreateIndex
CREATE INDEX "experience_category_idx" ON "experience"("category");

-- CreateIndex
CREATE UNIQUE INDEX "experience_id_kind_key" ON "experience"("id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "content_item_cms_external_id_key" ON "content_item"("cms_external_id");

-- CreateIndex
CREATE INDEX "content_item_primary_entity_id_idx" ON "content_item"("primary_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_item_id_kind_key" ON "content_item"("id", "kind");

-- CreateIndex
CREATE INDEX "entity_relation_source_id_type_status_deleted_at_idx" ON "entity_relation"("source_id", "type", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "entity_relation_target_id_type_status_deleted_at_idx" ON "entity_relation"("target_id", "type", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "entity_relation_source_record_id_idx" ON "entity_relation"("source_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_relation_source_id_type_target_id_key" ON "entity_relation"("source_id", "type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_record_source_key_key" ON "source_record"("source_key");

-- CreateIndex
CREATE INDEX "source_record_source_type_accessed_at_idx" ON "source_record"("source_type", "accessed_at");

-- CreateIndex
CREATE INDEX "entity_source_source_id_idx" ON "entity_source"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_source_entity_id_source_id_fact_path_key" ON "entity_source"("entity_id", "source_id", "fact_path");

-- AddForeignKey
ALTER TABLE "entity_registry" ADD CONSTRAINT "entity_registry_primary_source_id_fkey" FOREIGN KEY ("primary_source_id") REFERENCES "source_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_entity" ADD CONSTRAINT "geo_entity_id_kind_fkey" FOREIGN KEY ("id", "kind") REFERENCES "entity_registry"("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_entity" ADD CONSTRAINT "geo_entity_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "geo_entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place" ADD CONSTRAINT "place_id_kind_fkey" FOREIGN KEY ("id", "kind") REFERENCES "entity_registry"("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place" ADD CONSTRAINT "place_geo_entity_id_fkey" FOREIGN KEY ("geo_entity_id") REFERENCES "geo_entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience" ADD CONSTRAINT "experience_id_kind_fkey" FOREIGN KEY ("id", "kind") REFERENCES "entity_registry"("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience" ADD CONSTRAINT "experience_geo_entity_id_fkey" FOREIGN KEY ("geo_entity_id") REFERENCES "geo_entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_id_kind_fkey" FOREIGN KEY ("id", "kind") REFERENCES "entity_registry"("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_primary_entity_id_fkey" FOREIGN KEY ("primary_entity_id") REFERENCES "entity_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation" ADD CONSTRAINT "entity_relation_source_id_source_kind_fkey" FOREIGN KEY ("source_id", "source_kind") REFERENCES "entity_registry"("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation" ADD CONSTRAINT "entity_relation_target_id_target_kind_fkey" FOREIGN KEY ("target_id", "target_kind") REFERENCES "entity_registry"("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relation" ADD CONSTRAINT "entity_relation_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "source_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_source" ADD CONSTRAINT "entity_source_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_source" ADD CONSTRAINT "entity_source_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- SQL-owned constraints/extensions are part of the reviewed migration contract.
CREATE INDEX geo_entity_location_gist ON geo_entity USING gist(location);
CREATE INDEX place_location_gist ON place USING gist(location);
ALTER TABLE entity_registry ADD CONSTRAINT registry_name_nonempty CHECK (length(trim(name)) > 0),
  ADD CONSTRAINT registry_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT registry_locale_format CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  ADD CONSTRAINT registry_publication CHECK (status <> 'PUBLISHED' OR (last_verified IS NOT NULL AND primary_source_id IS NOT NULL AND deleted_at IS NULL)),
  ADD CONSTRAINT registry_deleted_withdrawn CHECK (deleted_at IS NULL OR status = 'WITHDRAWN');
ALTER TABLE geo_entity ADD CONSTRAINT geo_kind CHECK (kind = 'GEO_ENTITY'),
  ADD CONSTRAINT country_parent CHECK ((type = 'COUNTRY') = (parent_id IS NULL));
ALTER TABLE place ADD CONSTRAINT place_kind CHECK (kind = 'PLACE');
ALTER TABLE experience ADD CONSTRAINT experience_kind CHECK (kind = 'EXPERIENCE'),
  ADD CONSTRAINT positive_duration CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  ADD CONSTRAINT experience_category_nonempty CHECK (length(trim(category)) > 0);
ALTER TABLE content_item ADD CONSTRAINT content_kind CHECK (kind = 'CONTENT_ITEM'),
  ADD CONSTRAINT content_not_about_self CHECK (primary_entity_id IS NULL OR primary_entity_id <> id);
ALTER TABLE entity_relation ADD CONSTRAINT relation_not_self CHECK (source_id <> target_id),
  ADD CONSTRAINT relation_weight CHECK (weight >= 0 AND weight <= 1),
  ADD CONSTRAINT relation_near_order CHECK (type <> 'NEAR' OR source_id < target_id),
  ADD CONSTRAINT relation_publication CHECK (status <> 'PUBLISHED' OR (last_verified IS NOT NULL AND source_record_id IS NOT NULL AND deleted_at IS NULL)),
  ADD CONSTRAINT relation_deleted_withdrawn CHECK (deleted_at IS NULL OR status = 'WITHDRAWN'),
  ADD CONSTRAINT relation_endpoint_rules CHECK (
    (type = 'HAS_ATTRACTION' AND source_kind = 'GEO_ENTITY' AND target_kind = 'PLACE') OR
    (type = 'HAS_EXPERIENCE' AND source_kind IN ('GEO_ENTITY','PLACE') AND target_kind = 'EXPERIENCE') OR
    (type = 'NEAR' AND source_kind IN ('GEO_ENTITY','PLACE') AND target_kind IN ('GEO_ENTITY','PLACE')) OR
    (type = 'PART_OF' AND source_kind IN ('GEO_ENTITY','PLACE','EXPERIENCE') AND target_kind = 'GEO_ENTITY') OR
    (type = 'HAS_CUISINE' AND source_kind IN ('GEO_ENTITY','PLACE') AND target_kind = 'CUISINE') OR
    (type = 'HAS_ROUTE' AND source_kind = 'GEO_ENTITY' AND target_kind = 'ROUTE') OR
    (type = 'ABOUT' AND source_kind = 'CONTENT_ITEM' AND target_kind <> 'CONTENT_ITEM') OR
    (type = 'VISITS' AND source_kind IN ('EXPERIENCE','ROUTE','TRAVEL_PRODUCT') AND target_kind IN ('GEO_ENTITY','PLACE')) OR
    (type = 'OPERATES' AND source_kind = 'PARTNER' AND target_kind IN ('ROUTE','TRAVEL_PRODUCT'))
  );
ALTER TABLE entity_source ADD CONSTRAINT source_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  ADD CONSTRAINT source_fact_nonempty CHECK (length(trim(fact_path)) > 0);
ALTER TABLE source_record ADD CONSTRAINT source_fields_nonempty CHECK (length(trim(title)) > 0 AND length(trim(publisher)) > 0 AND length(trim(source_key)) > 0),
  ADD CONSTRAINT source_http_url CHECK (url IS NULL OR url ~ '^https?://[^[:space:]]+$');

CREATE FUNCTION graph_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['entity_registry','entity_relation','source_record','entity_source'] LOOP
    EXECUTE format('CREATE TRIGGER graph_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION graph_touch_updated_at()',t);
  END LOOP;
END $$;

CREATE FUNCTION geo_tier(t "GeoEntityType") RETURNS integer LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE t WHEN 'COUNTRY' THEN 0 WHEN 'REGION' THEN 1 WHEN 'PROVINCE_TERRITORY' THEN 2 WHEN 'CITY' THEN 3 WHEN 'DESTINATION' THEN 4 WHEN 'NEIGHBOURHOOD' THEN 5 END;
$$;
CREATE FUNCTION graph_geo_hierarchy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "GeoEntityType";
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.kind <> OLD.kind OR NEW.type <> OLD.type) THEN
    RAISE EXCEPTION 'Geographic identity and tier are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT type INTO p FROM geo_entity WHERE id = NEW.parent_id;
    IF p IS NULL OR geo_tier(p) >= geo_tier(NEW.type) THEN
      RAISE EXCEPTION 'Geographic parent must be an existing lower tier' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER geo_hierarchy BEFORE INSERT OR UPDATE ON geo_entity FOR EACH ROW EXECUTE FUNCTION graph_geo_hierarchy();

CREATE FUNCTION graph_registry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE src source_record;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.kind <> OLD.kind) THEN
    RAISE EXCEPTION 'Registry identity and kind are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.last_verified > now() THEN
    RAISE EXCEPTION 'Verification cannot be in the future' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'PUBLISHED' THEN
    SELECT * INTO src FROM source_record WHERE id = NEW.primary_source_id;
    IF src.id IS NULL OR src.source_type = 'DEVELOPMENT_FIXTURE' OR src.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'Publication requires an active non-fixture source' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER registry_guard BEFORE INSERT OR UPDATE ON entity_registry FOR EACH ROW EXECUTE FUNCTION graph_registry_guard();

-- Require every registry row to have exactly its implemented typed owner at commit.
CREATE FUNCTION graph_owner_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eid uuid; k "EntityKind"; present boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN eid := OLD.id; ELSE eid := NEW.id; END IF;
  SELECT kind INTO k FROM entity_registry WHERE id = eid;
  IF k IS NULL THEN RETURN NULL; END IF;
  CASE k
    WHEN 'GEO_ENTITY' THEN SELECT EXISTS(SELECT 1 FROM geo_entity WHERE id=eid) INTO present;
    WHEN 'PLACE' THEN SELECT EXISTS(SELECT 1 FROM place WHERE id=eid) INTO present;
    WHEN 'EXPERIENCE' THEN SELECT EXISTS(SELECT 1 FROM experience WHERE id=eid) INTO present;
    WHEN 'CONTENT_ITEM' THEN SELECT EXISTS(SELECT 1 FROM content_item WHERE id=eid) INTO present;
    ELSE present := false;
  END CASE;
  IF NOT present THEN RAISE EXCEPTION 'Registry requires an implemented typed owner' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END;
$$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['entity_registry','geo_entity','place','experience','content_item'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER graph_owner_integrity AFTER INSERT OR UPDATE OR DELETE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION graph_owner_integrity()',t);
  END LOOP;
END $$;

CREATE FUNCTION graph_relation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; src source_record;
BEGIN
  IF NEW.type = 'PART_OF' THEN
    CASE NEW.source_kind
      WHEN 'GEO_ENTITY' THEN SELECT parent_id INTO sid FROM geo_entity WHERE id=NEW.source_id;
      WHEN 'PLACE' THEN SELECT geo_entity_id INTO sid FROM place WHERE id=NEW.source_id;
      WHEN 'EXPERIENCE' THEN SELECT geo_entity_id INTO sid FROM experience WHERE id=NEW.source_id;
      ELSE sid := NULL;
    END CASE;
    IF sid IS DISTINCT FROM NEW.target_id THEN RAISE EXCEPTION 'PART_OF must match the typed geographic parent' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.last_verified > now() THEN RAISE EXCEPTION 'Verification cannot be in the future' USING ERRCODE='23514'; END IF;
  IF NEW.status = 'PUBLISHED' THEN
    SELECT * INTO src FROM source_record WHERE id=NEW.source_record_id;
    IF src.id IS NULL OR src.source_type = 'DEVELOPMENT_FIXTURE' OR src.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'Publication requires an active non-fixture source' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER relation_guard BEFORE INSERT OR UPDATE ON entity_relation FOR EACH ROW EXECUTE FUNCTION graph_relation_guard();

-- A reparent cannot leave an existing active PART_OF edge asserting the old parent.
CREATE FUNCTION graph_parent_edges() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eid uuid; parent uuid;
BEGIN
  eid := NEW.id;
  IF TG_TABLE_NAME='geo_entity' THEN SELECT parent_id INTO parent FROM geo_entity WHERE id=eid;
  ELSE EXECUTE format('SELECT geo_entity_id FROM %I WHERE id=$1',TG_TABLE_NAME) INTO parent USING eid; END IF;
  IF EXISTS(SELECT 1 FROM entity_relation WHERE source_id=eid AND type='PART_OF' AND deleted_at IS NULL AND target_id IS DISTINCT FROM parent) THEN
    RAISE EXCEPTION 'Reparent must update PART_OF edges in the same transaction' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['geo_entity','place','experience'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER graph_parent_edges AFTER UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION graph_parent_edges()',t);
  END LOOP;
END $$;
COMMIT;

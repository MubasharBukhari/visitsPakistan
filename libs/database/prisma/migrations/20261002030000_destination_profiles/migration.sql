-- CreateTable
CREATE TABLE "destination_profile" (
    "id" UUID NOT NULL,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_id" UUID NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "last_verified" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "destination_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "destination_profile_status_deleted_at_idx" ON "destination_profile"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "destination_profile_source_id_idx" ON "destination_profile"("source_id");

-- CreateIndex
CREATE INDEX "destination_profile_interests_idx" ON "destination_profile" USING GIN ("interests");

-- CreateIndex
CREATE INDEX "destination_profile_seasons_idx" ON "destination_profile" USING GIN ("seasons");

-- AddForeignKey
ALTER TABLE "destination_profile" ADD CONSTRAINT "destination_profile_id_fkey" FOREIGN KEY ("id") REFERENCES "geo_entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_profile" ADD CONSTRAINT "destination_profile_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE destination_profile ADD CONSTRAINT destination_profile_publication CHECK (status <> 'PUBLISHED' OR (last_verified IS NOT NULL AND deleted_at IS NULL));
ALTER TABLE destination_profile ADD CONSTRAINT destination_profile_seasons CHECK (seasons <@ ARRAY['spring','summer','autumn','winter','all-year']::text[]);
CREATE FUNCTION guard_destination_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM geo_entity WHERE id=NEW.id AND type IN ('DESTINATION','CITY')) THEN
    RAISE EXCEPTION 'Discovery profiles require destination or city geography';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.interests) tag WHERE tag !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(tag)>40) OR cardinality(NEW.interests)>40 OR cardinality(NEW.seasons)>5 THEN
    RAISE EXCEPTION 'Invalid destination facet tags';
  END IF;
  IF NEW.last_verified > clock_timestamp() THEN RAISE EXCEPTION 'Verification cannot be in the future'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.created_at<>OLD.created_at) THEN RAISE EXCEPTION 'Immutable discovery identity'; END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER destination_profile_guard BEFORE INSERT OR UPDATE ON destination_profile FOR EACH ROW EXECUTE FUNCTION guard_destination_profile();

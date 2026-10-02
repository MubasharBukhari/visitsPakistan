-- CreateEnum
CREATE TYPE "EditorialStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('CONTRIBUTOR', 'EDITOR', 'ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "TemplateLayout" AS ENUM ('EDITORIAL', 'MAGAZINE', 'COMPACT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContentType" ADD VALUE 'DESTINATION_EDITORIAL';
ALTER TYPE "ContentType" ADD VALUE 'ATTRACTION_EDITORIAL';
ALTER TYPE "ContentType" ADD VALUE 'TRAVEL_GUIDE';
ALTER TYPE "ContentType" ADD VALUE 'FOOD_GUIDE';
ALTER TYPE "ContentType" ADD VALUE 'ROUTE_GUIDE';
ALTER TYPE "ContentType" ADD VALUE 'ITINERARY_EDITORIAL';
ALTER TYPE "ContentType" ADD VALUE 'TRAVEL_STORY';

-- CreateTable
CREATE TABLE "staff_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "mfa_secret" TEXT NOT NULL,
    "last_mfa_step" BIGINT,
    "roles" "StaffRole"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "staff_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "staff_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_document" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "current_revision_id" UUID,
    "published_revision_id" UUID,
    "first_published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "editorial_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_revision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "EditorialStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "seo_title" TEXT NOT NULL,
    "meta_description" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "author_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "hero_media_id" UUID,
    "last_verified" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "editorial_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_source" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "revision_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,

    CONSTRAINT "editorial_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_entity_reference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "revision_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,

    CONSTRAINT "editorial_entity_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storage_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'image/webp',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "alt" TEXT NOT NULL,
    "credit" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_theme" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tokens" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "logo_media_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "layout" "TemplateLayout" NOT NULL,
    "allowed_blocks" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_presentation" (
    "id" TEXT NOT NULL DEFAULT 'website',
    "theme_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_presentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_assignment" (
    "type" "ContentType" NOT NULL,
    "template_id" UUID NOT NULL,

    CONSTRAINT "template_assignment_pkey" PRIMARY KEY ("type")
);

-- CreateTable
CREATE TABLE "cms_audit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "revision_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "content_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_account_email_key" ON "staff_account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_session_token_hash_key" ON "staff_session"("token_hash");

-- CreateIndex
CREATE INDEX "staff_session_staff_id_expires_at_idx" ON "staff_session"("staff_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_document_current_revision_id_key" ON "editorial_document"("current_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_document_published_revision_id_key" ON "editorial_document"("published_revision_id");

-- CreateIndex
CREATE INDEX "editorial_revision_status_updated_at_idx" ON "editorial_revision"("status", "updated_at");

-- CreateIndex
CREATE INDEX "editorial_revision_author_id_idx" ON "editorial_revision"("author_id");

-- CreateIndex
CREATE INDEX "editorial_revision_reviewer_id_idx" ON "editorial_revision"("reviewer_id");

-- CreateIndex
CREATE INDEX "editorial_revision_hero_media_id_idx" ON "editorial_revision"("hero_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_revision_document_id_number_key" ON "editorial_revision"("document_id", "number");

-- CreateIndex
CREATE INDEX "editorial_source_source_id_idx" ON "editorial_source"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_source_revision_id_source_id_key" ON "editorial_source"("revision_id", "source_id");

-- CreateIndex
CREATE INDEX "editorial_entity_reference_entity_id_idx" ON "editorial_entity_reference"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_entity_reference_revision_id_entity_id_key" ON "editorial_entity_reference"("revision_id", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_storage_key_key" ON "media_asset"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "site_theme_slug_key" ON "site_theme"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "site_template_slug_key" ON "site_template"("slug");

-- CreateIndex
CREATE INDEX "cms_audit_resource_id_created_at_idx" ON "cms_audit"("resource_id", "created_at");

-- CreateIndex
CREATE INDEX "content_outbox_processed_at_created_at_idx" ON "content_outbox"("processed_at", "created_at");

-- AddForeignKey
ALTER TABLE "staff_session" ADD CONSTRAINT "staff_session_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_document" ADD CONSTRAINT "editorial_document_id_fkey" FOREIGN KEY ("id") REFERENCES "content_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_document" ADD CONSTRAINT "editorial_document_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "editorial_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_document" ADD CONSTRAINT "editorial_document_published_revision_id_fkey" FOREIGN KEY ("published_revision_id") REFERENCES "editorial_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_revision" ADD CONSTRAINT "editorial_revision_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "editorial_document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_revision" ADD CONSTRAINT "editorial_revision_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_revision" ADD CONSTRAINT "editorial_revision_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_revision" ADD CONSTRAINT "editorial_revision_hero_media_id_fkey" FOREIGN KEY ("hero_media_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_source" ADD CONSTRAINT "editorial_source_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "editorial_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_source" ADD CONSTRAINT "editorial_source_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_entity_reference" ADD CONSTRAINT "editorial_entity_reference_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "editorial_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_entity_reference" ADD CONSTRAINT "editorial_entity_reference_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_theme" ADD CONSTRAINT "site_theme_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_presentation" ADD CONSTRAINT "site_presentation_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "site_theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_assignment" ADD CONSTRAINT "template_assignment_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "site_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_audit" ADD CONSTRAINT "cms_audit_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE editorial_revision ADD CONSTRAINT editorial_reviewer_separate CHECK (reviewer_id IS NULL OR reviewer_id<>author_id),
 ADD CONSTRAINT editorial_approved_review CHECK (status NOT IN ('APPROVED','PUBLISHED') OR (reviewer_id IS NOT NULL AND last_verified IS NOT NULL)),
 ADD CONSTRAINT editorial_blocks_array CHECK (jsonb_typeof(blocks)='array');
ALTER TABLE media_asset ADD CONSTRAINT media_dimensions CHECK (width>0 AND height>0),
 ADD CONSTRAINT media_storage_key CHECK (storage_key ~ '^[0-9a-f-]{36}\.webp$'),
 ADD CONSTRAINT media_webp CHECK (mime='image/webp');
ALTER TABLE staff_account ADD CONSTRAINT staff_roles CHECK (cardinality(roles)>0),
 ADD CONSTRAINT staff_email CHECK (email=lower(email));
CREATE FUNCTION cms_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.last_verified>clock_timestamp() THEN RAISE EXCEPTION 'Verification cannot be in future' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW.document_id<>OLD.document_id OR NEW.number<>OLD.number OR NEW.author_id<>OLD.author_id THEN RAISE EXCEPTION 'Revision identity is immutable' USING ERRCODE='23514'; END IF;
  IF OLD.status<>'DRAFT' AND (NEW.title IS DISTINCT FROM OLD.title OR NEW.summary IS DISTINCT FROM OLD.summary OR NEW.seo_title IS DISTINCT FROM OLD.seo_title OR NEW.meta_description IS DISTINCT FROM OLD.meta_description OR NEW.blocks IS DISTINCT FROM OLD.blocks OR NEW.hero_media_id IS DISTINCT FROM OLD.hero_media_id OR NEW.last_verified IS DISTINCT FROM OLD.last_verified) THEN RAISE EXCEPTION 'Submitted snapshots are immutable' USING ERRCODE='23514'; END IF;
  IF OLD.status='PUBLISHED' THEN RAISE EXCEPTION 'Published revisions are immutable' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.updated_at:=clock_timestamp(); RETURN NEW;
END $$;
CREATE TRIGGER cms_revision_guard BEFORE INSERT OR UPDATE ON editorial_revision FOR EACH ROW EXECUTE FUNCTION cms_revision_guard();
CREATE FUNCTION cms_pointer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r editorial_revision;
BEGIN
 IF NEW.current_revision_id IS NOT NULL THEN SELECT * INTO r FROM editorial_revision WHERE id=NEW.current_revision_id; IF r.document_id<>NEW.id THEN RAISE EXCEPTION 'Revision belongs to another document' USING ERRCODE='23514'; END IF; END IF;
 IF NEW.published_revision_id IS NOT NULL THEN SELECT * INTO r FROM editorial_revision WHERE id=NEW.published_revision_id; IF r.document_id<>NEW.id OR r.status<>'PUBLISHED' THEN RAISE EXCEPTION 'Published pointer requires own published revision' USING ERRCODE='23514'; END IF; END IF;
 IF TG_OP='UPDATE' AND OLD.first_published_at IS NOT NULL AND NEW.first_published_at IS DISTINCT FROM OLD.first_published_at THEN RAISE EXCEPTION 'First publication is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cms_pointer_guard BEFORE INSERT OR UPDATE ON editorial_document FOR EACH ROW EXECUTE FUNCTION cms_pointer_guard();
CREATE FUNCTION cms_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid uuid; state "EditorialStatus";
BEGIN
 IF TG_OP='DELETE' THEN rid:=OLD.revision_id; ELSE rid:=NEW.revision_id; END IF;
 SELECT status INTO state FROM editorial_revision WHERE id=rid;
 IF state<>'DRAFT' THEN RAISE EXCEPTION 'Submitted revision evidence is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER cms_source_guard BEFORE INSERT OR UPDATE OR DELETE ON editorial_source FOR EACH ROW EXECUTE FUNCTION cms_evidence_guard();
CREATE TRIGGER cms_reference_guard BEFORE INSERT OR UPDATE OR DELETE ON editorial_entity_reference FOR EACH ROW EXECUTE FUNCTION cms_evidence_guard();
CREATE FUNCTION cms_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit records are append-only' USING ERRCODE='23514'; END $$;
CREATE TRIGGER cms_audit_immutable BEFORE UPDATE OR DELETE ON cms_audit FOR EACH ROW EXECUTE FUNCTION cms_audit_immutable();

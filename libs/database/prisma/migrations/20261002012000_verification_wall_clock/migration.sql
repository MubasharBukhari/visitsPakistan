BEGIN;
-- Verification can happen after transaction start; now() is transaction time.
CREATE OR REPLACE FUNCTION graph_registry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE src source_record;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.kind <> OLD.kind) THEN
    RAISE EXCEPTION 'Registry identity and kind are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.last_verified > clock_timestamp() THEN
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

CREATE OR REPLACE FUNCTION graph_relation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF NEW.last_verified > clock_timestamp() THEN RAISE EXCEPTION 'Verification cannot be in the future' USING ERRCODE='23514'; END IF;
  IF NEW.status = 'PUBLISHED' THEN
    SELECT * INTO src FROM source_record WHERE id=NEW.source_record_id;
    IF src.id IS NULL OR src.source_type = 'DEVELOPMENT_FIXTURE' OR src.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'Publication requires an active non-fixture source' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;

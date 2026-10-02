BEGIN;
-- Owner identities cannot move away from their registry, even in direct SQL.
CREATE FUNCTION graph_owner_update_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.kind <> OLD.kind THEN
    RAISE EXCEPTION 'Canonical owner identity is immutable' USING ERRCODE='23514';
  END IF;
  UPDATE entity_registry SET updated_at=clock_timestamp() WHERE id=NEW.id;
  RETURN NEW;
END;
$$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['geo_entity','place','experience','content_item'] LOOP
    EXECUTE format('CREATE TRIGGER graph_owner_update BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION graph_owner_update_guard()',t);
  END LOOP;
END $$;
ALTER TABLE entity_registry ADD CONSTRAINT registry_provenance_object CHECK (jsonb_typeof(provenance)='object');
ALTER TABLE entity_relation ADD CONSTRAINT relation_metadata_object CHECK (jsonb_typeof(metadata)='object');
ALTER TABLE source_record ADD CONSTRAINT source_metadata_object CHECK (jsonb_typeof(metadata)='object');
ALTER TABLE place ADD CONSTRAINT place_facts_object CHECK (jsonb_typeof(facts)='object');
ALTER TABLE experience ADD CONSTRAINT experience_facts_object CHECK (jsonb_typeof(facts)='object');
ALTER TABLE content_item ADD CONSTRAINT content_metadata_object CHECK (jsonb_typeof(metadata)='object');
COMMIT;

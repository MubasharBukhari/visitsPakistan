CREATE TABLE search_state (id TEXT PRIMARY KEY, generation BIGINT NOT NULL DEFAULT 1, indexed_generation BIGINT NOT NULL DEFAULT 0, indexed_at TIMESTAMPTZ);
INSERT INTO search_state(id) VALUES ('public_v1');
CREATE TABLE search_manifest (id UUID PRIMARY KEY, type TEXT NOT NULL, hash TEXT NOT NULL);
CREATE FUNCTION mark_search_dirty() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN UPDATE search_state SET generation=generation+1 WHERE id='public_v1'; RETURN NULL; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['entity_registry','geo_entity','place','experience','destination_profile','entity_relation','source_record','entity_source','content_item','editorial_document','editorial_revision','editorial_entity_reference','editorial_source','media_asset'] LOOP
  IF to_regclass(t) IS NOT NULL THEN
   EXECUTE format('CREATE TRIGGER search_dirty AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION mark_search_dirty()',t);
  END IF;
 END LOOP;
END $$;

ALTER TABLE geo_entity ADD COLUMN summary VARCHAR(1000);
ALTER TABLE editorial_revision ADD COLUMN destination JSONB;
ALTER TABLE editorial_revision ADD CONSTRAINT destination_presentation_object CHECK (destination IS NULL OR jsonb_typeof(destination)='object');
CREATE FUNCTION cms_destination_presentation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status<>'DRAFT' AND NEW.destination IS DISTINCT FROM OLD.destination THEN
  RAISE EXCEPTION 'Submitted destination presentation is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cms_destination_presentation_guard BEFORE UPDATE ON editorial_revision FOR EACH ROW EXECUTE FUNCTION cms_destination_presentation_guard();

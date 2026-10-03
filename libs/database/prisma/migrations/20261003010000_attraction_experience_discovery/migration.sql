ALTER TYPE "PlaceType" ADD VALUE 'LANDMARK';
ALTER TYPE "PlaceType" ADD VALUE 'NATURAL_ATTRACTION';
ALTER TYPE "ContentType" ADD VALUE 'EXPERIENCE_EDITORIAL';
ALTER TABLE place ADD COLUMN alt_names TEXT[] NOT NULL DEFAULT '{}', ADD COLUMN summary VARCHAR(1000), ADD COLUMN category VARCHAR(80), ADD COLUMN opening_information VARCHAR(3000), ADD COLUMN admission_information VARCHAR(3000), ADD COLUMN duration_minutes INTEGER, ADD COLUMN best_time VARCHAR(3000), ADD COLUMN seasons TEXT[] NOT NULL DEFAULT '{}', ADD COLUMN family_suitable BOOLEAN, ADD COLUMN accessibility VARCHAR(3000), ADD COLUMN facilities TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE experience ADD COLUMN alt_names TEXT[] NOT NULL DEFAULT '{}', ADD COLUMN summary VARCHAR(1000), ADD COLUMN family_suitable BOOLEAN;
ALTER TABLE place ADD CONSTRAINT place_duration_bounds CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 10080), ADD CONSTRAINT place_seasons CHECK (seasons <@ ARRAY['spring','summer','autumn','winter','all-year']::text[]);
-- Existing season vocabularies remain readable; new commands validate the supported discovery tags.
CREATE INDEX place_category_family_suitable_duration_minutes_idx ON place(category,family_suitable,duration_minutes);
CREATE INDEX place_seasons_idx ON place USING GIN(seasons);
DROP INDEX experience_category_idx;
CREATE INDEX experience_category_family_suitable_duration_minutes_idx ON experience(category,family_suitable,duration_minutes);
CREATE INDEX experience_seasons_idx ON experience USING GIN(seasons);

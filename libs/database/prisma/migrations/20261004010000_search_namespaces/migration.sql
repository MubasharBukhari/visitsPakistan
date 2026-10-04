ALTER TABLE search_manifest ADD COLUMN namespace TEXT NOT NULL DEFAULT '';
ALTER TABLE search_manifest DROP CONSTRAINT search_manifest_pkey;
ALTER TABLE search_manifest ADD PRIMARY KEY(namespace,id);

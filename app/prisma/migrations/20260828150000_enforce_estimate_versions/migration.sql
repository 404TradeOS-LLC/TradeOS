-- Serialize estimate version allocation at the project boundary and preserve
-- a database invariant against duplicate revisions.
create unique index if not exists estimates_project_id_version_key
  on estimates (project_id, version);

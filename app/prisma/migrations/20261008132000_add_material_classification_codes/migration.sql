-- Universal product classification codes on canonical materials.
-- Both columns are nullable: codes are assigned progressively per canonical
-- material (verified codes only — never invented). No backfill; existing rows
-- and import paths are unaffected. No NOT NULL constraint until legacy data,
-- supplier imports, and classification exceptions are accounted for.

alter table materials
    add column omniclass_23 text,
    add column unspsc text;

create index idx_materials_omniclass23 on materials (omniclass_23);

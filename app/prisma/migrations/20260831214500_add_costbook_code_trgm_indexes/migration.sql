-- Complete the trigram coverage for the live Costbook substring-search contract.
-- CostItem and Assembly search both use case-insensitive `contains` against
-- `code` as well as `name`; the existing pg_trgm migration only indexed name.
-- These additive indexes preserve query semantics while allowing PostgreSQL to
-- use GIN trigram access paths for `ILIKE '%query%'` code predicates.

create index if not exists idx_cost_items_code_trgm
  on cost_items using gin (code gin_trgm_ops);

create index if not exists idx_assemblies_code_trgm
  on assemblies using gin (code gin_trgm_ops);

-- Validate the replacement constraint separately from its installation so
-- PostgreSQL can use the lower-lock VALIDATE CONSTRAINT path for the scan.
alter table proposals validate constraint proposals_status_check;

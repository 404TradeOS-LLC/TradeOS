-- S009: persist the canonical proposal decline status for new writes while
-- continuing to accept historical `rejected` rows during compatibility.
alter table proposals drop constraint if exists proposals_status_check;

alter table proposals add constraint proposals_status_check
  check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'rejected'));

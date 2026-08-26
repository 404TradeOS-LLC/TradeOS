alter table customers add column deleted_at timestamptz;
create index idx_customers_org_deleted on customers(org_id, deleted_at);

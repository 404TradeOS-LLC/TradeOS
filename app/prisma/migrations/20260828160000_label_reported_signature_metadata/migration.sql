-- Signature metadata arrives through a proxied web action and cannot be
-- independently attested by the API. Rename the columns so their provenance
-- is explicit in the database and every downstream contract.
alter table contracts rename column signature_ip to signature_ip_reported;
alter table contracts rename column signature_user_agent to signature_user_agent_reported;

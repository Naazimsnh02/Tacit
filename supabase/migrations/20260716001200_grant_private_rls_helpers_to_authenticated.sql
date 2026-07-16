-- RLS expressions execute as the querying role. The private schema is not
-- PostgREST-exposed, so authenticated execution permits policy evaluation
-- without publishing helper RPCs.
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

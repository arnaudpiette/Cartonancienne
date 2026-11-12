-- Compatibility bridge: existing deployed callers still use this public RPC.
-- The retry-safe create_public_booking_once wrapper from 009 remains the new entry point.
-- Keep the existing availability checks and PostgreSQL overlap constraint unchanged.
-- When updating a live database, apply 009 and this bridge in ONE transaction.
-- Revoke legacy access only after all callers have migrated in an authorized release.
grant execute on function public.create_public_booking(text,timestamptz,text,text) to anon, authenticated;

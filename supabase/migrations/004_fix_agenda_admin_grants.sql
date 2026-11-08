-- Restores the SQL privileges required by the existing admin RLS policies.
-- Policies still restrict these rows to app_metadata.role = 'admin'.
grant select on table public.availability_windows, public.appointments, public.booking_notifications to authenticated;
grant update on table public.booking_notifications to authenticated;

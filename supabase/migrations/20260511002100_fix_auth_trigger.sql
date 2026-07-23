-- Fix handle_new_auth_user: only insert profile when a valid organisation_id is
-- supplied in raw_user_meta_data. Creating a user from the Supabase dashboard
-- without metadata must not fail — the profile is created later by the invite flow.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  v_org_id := (NEW.raw_user_meta_data ->> 'organisation_id')::uuid;

  -- Only create profile if organisation exists; otherwise the invite flow handles it
  IF v_org_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organisations WHERE id = v_org_id) THEN
    INSERT INTO public.users (id, tenant_id, organisation_id, email, name, status)
    VALUES (
      NEW.id,
      v_org_id,
      v_org_id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
      'active'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

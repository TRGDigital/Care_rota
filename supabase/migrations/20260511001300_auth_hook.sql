-- ============================================================
-- AUTH HOOK — custom_access_token
-- Embeds organisation_id, home_ids, active_home_id, and roles
-- into every JWT at issue time.
-- Configured in supabase/config.toml:
--   [auth.hook.custom_access_token]
--   enabled = true
--   uri = "pg-functions://postgres/public/custom_access_token_hook"
-- NOTE: hook functions must live in 'public' (or another app-owned
-- schema), NOT in 'auth' — migrations don't have permission to
-- create objects in the auth schema.
-- ============================================================

-- Stores the user's currently-selected home.
-- Updated by set_active_home(); client calls refreshSession() after.
CREATE TABLE public.user_preferences (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_home_id uuid REFERENCES public.homes(id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_own ON public.user_preferences
  USING (user_id = auth.uid());

-- ============================================================
-- JWT hook: called by Supabase Auth before issuing every token.
-- Lives in public schema; granted to supabase_auth_admin.
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims          jsonb;
  uid             uuid;
  org_id          uuid;
  home_id_arr     uuid[];
  preferred_home  uuid;
  active_home     uuid;
  roles_obj       jsonb;
BEGIN
  uid    := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';

  -- Organisation the user belongs to
  SELECT u.organisation_id INTO org_id
  FROM public.users u
  WHERE u.id = uid;

  IF org_id IS NULL THEN
    -- User profile not yet created; return unmodified claims
    RETURN event;
  END IF;

  -- All homes the user can access (non-revoked roles)
  SELECT array_agg(DISTINCT uhr.home_id) FILTER (WHERE uhr.home_id IS NOT NULL)
  INTO home_id_arr
  FROM public.user_home_roles uhr
  WHERE uhr.user_id = uid AND uhr.revoked_at IS NULL;

  -- Role map: { "home-uuid": ["registered_manager", ...], "org": ["owner"] }
  SELECT jsonb_object_agg(
    COALESCE(uhr.home_id::text, 'org'),
    jsonb_agg(uhr.role_code::text)
  )
  INTO roles_obj
  FROM public.user_home_roles uhr
  WHERE uhr.user_id = uid AND uhr.revoked_at IS NULL;

  -- Preferred active home (set via set_active_home())
  SELECT up.active_home_id INTO preferred_home
  FROM public.user_preferences up
  WHERE up.user_id = uid;

  -- Resolve active_home_id: prefer stored preference if still valid
  IF preferred_home IS NOT NULL AND home_id_arr IS NOT NULL
     AND preferred_home = ANY(home_id_arr) THEN
    active_home := preferred_home;
  ELSE
    -- Fall back to first accessible home
    active_home := home_id_arr[1];
  END IF;

  claims := claims || jsonb_build_object(
    'organisation_id', org_id,
    'home_ids',        COALESCE(to_jsonb(home_id_arr), '[]'::jsonb),
    'active_home_id',  active_home,
    'roles',           COALESCE(roles_obj, '{}'::jsonb)
  );

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute to supabase_auth_admin (the role Supabase uses to call hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- ============================================================
-- Home switching: call this then refreshSession() on the client.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_active_home(p_home_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller has access to this home
  IF NOT EXISTS (
    SELECT 1 FROM public.user_home_roles
    WHERE user_id = auth.uid()
      AND home_id  = p_home_id
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'access_denied: user does not have access to home %', p_home_id;
  END IF;

  INSERT INTO public.user_preferences (user_id, active_home_id, updated_at)
  VALUES (auth.uid(), p_home_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET active_home_id = EXCLUDED.active_home_id,
        updated_at     = EXCLUDED.updated_at;
END;
$$;

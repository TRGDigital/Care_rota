-- Supplementary RLS policies using auth.uid() directly.
-- These work without the custom_access_token JWT hook.

-- user_home_roles: a user can always see their own role rows
CREATE POLICY user_home_roles_own ON user_home_roles
  USING (user_id = auth.uid());

-- homes: a user can see any home they have a (non-revoked) role in
CREATE POLICY homes_via_role ON homes
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.home_id = homes.id
        AND uhr.user_id = auth.uid()
        AND uhr.revoked_at IS NULL
    )
  );

-- Replace users_same_org JWT policy with a UID-based subquery version
DROP POLICY IF EXISTS users_same_org ON users;

CREATE POLICY users_same_org ON users
  USING (
    organisation_id = (
      SELECT organisation_id FROM users WHERE id = auth.uid()
    )
  );

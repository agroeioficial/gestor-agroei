ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrative';

DROP POLICY "Users can read their own profile or HR can read team profiles" ON public.profiles;
CREATE FUNCTION public.can_read_agroei_profile(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() = _target_user_id
    OR public.has_role(auth.uid(), 'partner')
    OR (
      (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'hr'))
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _target_user_id AND role = 'partner'
      )
    );
$$;
REVOKE ALL ON FUNCTION public.can_read_agroei_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_agroei_profile(uuid) TO authenticated;
CREATE POLICY "Users can read their own profile and authorized team profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.can_read_agroei_profile(user_id));

DROP POLICY "Partners and managers manage staff invitations" ON public.account_invitations;
CREATE UNIQUE INDEX account_invitations_email_lower_idx ON public.account_invitations (lower(email));
CREATE POLICY "Partners and managers read staff invitations"
ON public.account_invitations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'partner')
  OR public.has_role(auth.uid(), 'manager')
);
CREATE POLICY "Partners and managers create authorized staff invitations"
ON public.account_invitations FOR INSERT TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'partner')
    OR (
      public.has_role(auth.uid(), 'manager')
      AND role NOT IN ('partner', 'manager')
    )
  )
);
CREATE POLICY "Partners and managers update staff invitations"
ON public.account_invitations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'partner')
  OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'partner')
  OR (
    public.has_role(auth.uid(), 'manager')
    AND role NOT IN ('partner', 'manager')
  )
);
CREATE POLICY "Partners and managers delete staff invitations"
ON public.account_invitations FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'partner')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE FUNCTION public.can_access_agroei_file(_name text, _operation text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  folder text := split_part(_name, '/', 1);
  owner_id text := split_part(_name, '/', 2);
  owner_is_partner boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id::text = split_part(_name, '/', 2)
      AND role = 'partner'
  );
  current_is_partner boolean := public.has_role(auth.uid(), 'partner');
  current_is_hr boolean := public.has_role(auth.uid(), 'hr');
  current_is_admin boolean := public.has_role(auth.uid(), 'administrative');
BEGIN
  IF auth.uid() IS NULL OR _operation NOT IN ('select', 'insert', 'update', 'delete') THEN
    RETURN false;
  END IF;

  IF current_is_partner THEN
    RETURN true;
  END IF;

  IF _operation = 'select' AND folder = 'payslips' AND owner_id = auth.uid()::text AND NOT owner_is_partner THEN
    RETURN true;
  END IF;

  IF current_is_hr AND folder IN ('employee-documents', 'payslips') AND NOT owner_is_partner THEN
    RETURN true;
  END IF;

  IF current_is_admin AND folder = 'finance' THEN
    RETURN true;
  END IF;

  IF current_is_admin AND folder = 'payslips' AND NOT owner_is_partner THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.can_access_agroei_file(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_agroei_file(text, text) TO authenticated;

DROP POLICY "AgroEI private files are visible by authorized role or owner" ON storage.objects;
DROP POLICY "Authorized departments can upload private AgroEI files" ON storage.objects;
DROP POLICY "Authorized departments can update private AgroEI files" ON storage.objects;
DROP POLICY "Authorized departments can remove private AgroEI files" ON storage.objects;
CREATE POLICY "Authorized AgroEI users read private files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agroei-private-records'
  AND public.can_access_agroei_file(name, 'select')
);
CREATE POLICY "Authorized AgroEI roles upload private files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agroei-private-records'
  AND public.can_access_agroei_file(name, 'insert')
);
CREATE POLICY "Authorized AgroEI roles update private files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'agroei-private-records'
  AND public.can_access_agroei_file(name, 'update')
)
WITH CHECK (
  bucket_id = 'agroei-private-records'
  AND public.can_access_agroei_file(name, 'update')
);
CREATE POLICY "Authorized AgroEI roles delete private files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'agroei-private-records'
  AND public.can_access_agroei_file(name, 'delete')
);

CREATE OR REPLACE FUNCTION public.guard_agroei_auth_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF lower(COALESCE(NEW.email, '')) = 'abdullahbalanca@gmail.com'
       AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'partner') THEN
      RETURN NEW;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.account_invitations
      WHERE lower(email) = lower(COALESCE(NEW.email, ''))
        AND accepted_at IS NULL
        AND expires_at > now()
    ) THEN
      RAISE EXCEPTION 'An active AgroEI invitation is required';
    END IF;
  ELSIF OLD.email IS DISTINCT FROM NEW.email
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = OLD.id AND role = 'partner'
        )
        AND lower(COALESCE(NEW.email, '')) <> 'abdullahbalanca@gmail.com' THEN
    RAISE EXCEPTION 'The initial partner account email cannot be changed through account settings';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_agroei_auth_registration() FROM PUBLIC;
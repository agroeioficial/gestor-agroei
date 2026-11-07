CREATE TABLE public.account_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  UNIQUE (email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_invitations TO authenticated;
GRANT ALL ON public.account_invitations TO service_role;
ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners and managers manage staff invitations"
ON public.account_invitations FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'partner')
  OR public.has_role(auth.uid(), 'manager')
  OR (invited_by = auth.uid() AND accepted_at IS NULL)
)
WITH CHECK (
  public.has_role(auth.uid(), 'partner')
  OR public.has_role(auth.uid(), 'manager')
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
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_agroei_auth_registration() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_agroei_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  invited_role public.app_role;
  invitation_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  IF NEW.email_confirmed_at IS NOT NULL THEN
    IF lower(COALESCE(NEW.email, '')) = 'abdullahbalanca@gmail.com'
       AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'partner') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'partner')
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      SELECT id, role INTO invitation_id, invited_role
      FROM public.account_invitations
      WHERE lower(email) = lower(COALESCE(NEW.email, ''))
        AND accepted_at IS NULL
        AND expires_at > now()
      FOR UPDATE;

      IF invitation_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, invited_role)
        ON CONFLICT (user_id, role) DO NOTHING;
        UPDATE public.account_invitations SET accepted_at = now() WHERE id = invitation_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_agroei_auth_user() FROM PUBLIC;
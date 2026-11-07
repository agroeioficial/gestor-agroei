CREATE TYPE public.app_role AS ENUM ('partner', 'manager', 'hr', 'finance', 'marketing', 'employee');

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  marital_status text,
  birth_date date,
  document_type text,
  document_number text,
  document_issue_date date,
  naturality text,
  residence text,
  phone text,
  education text,
  languages text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY "Users can read their own profile or HR can read team profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'partner')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'hr')
);
CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read only their own access roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE FUNCTION public.handle_agroei_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(COALESCE(NEW.email, '')) = 'abdullahbalanca@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'partner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_agroei_auth_user() FROM PUBLIC;
CREATE TRIGGER agroei_auth_user_profile_and_bootstrap
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_agroei_auth_user();

CREATE POLICY "AgroEI private files are visible by authorized role or owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agroei-private-records'
  AND (
    public.has_role(auth.uid(), 'partner')
    OR public.has_role(auth.uid(), 'hr')
    OR (
      public.has_role(auth.uid(), 'finance')
      AND (storage.foldername(name))[1] IN ('payslips', 'finance')
    )
    OR (
      (storage.foldername(name))[1] = 'payslips'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);
CREATE POLICY "Authorized departments can upload private AgroEI files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agroei-private-records'
  AND (
    public.has_role(auth.uid(), 'partner')
    OR public.has_role(auth.uid(), 'hr')
    OR (
      public.has_role(auth.uid(), 'finance')
      AND (storage.foldername(name))[1] IN ('payslips', 'finance')
    )
  )
);
CREATE POLICY "Authorized departments can update private AgroEI files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'agroei-private-records'
  AND (
    public.has_role(auth.uid(), 'partner')
    OR public.has_role(auth.uid(), 'hr')
    OR (
      public.has_role(auth.uid(), 'finance')
      AND (storage.foldername(name))[1] IN ('payslips', 'finance')
    )
  )
)
WITH CHECK (
  bucket_id = 'agroei-private-records'
  AND (
    public.has_role(auth.uid(), 'partner')
    OR public.has_role(auth.uid(), 'hr')
    OR (
      public.has_role(auth.uid(), 'finance')
      AND (storage.foldername(name))[1] IN ('payslips', 'finance')
    )
  )
);
CREATE POLICY "Authorized departments can remove private AgroEI files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'agroei-private-records'
  AND (
    public.has_role(auth.uid(), 'partner')
    OR public.has_role(auth.uid(), 'hr')
    OR (
      public.has_role(auth.uid(), 'finance')
      AND (storage.foldername(name))[1] IN ('payslips', 'finance')
    )
  )
);
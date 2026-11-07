CREATE FUNCTION public.guard_agroei_auth_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'partner') THEN
      RAISE EXCEPTION 'AgroEI account registration is closed';
    END IF;
    IF lower(COALESCE(NEW.email, '')) <> 'abdullahbalanca@gmail.com' THEN
      RAISE EXCEPTION 'Only the pre-authorized first partner account may be created';
    END IF;
  ELSIF OLD.email IS DISTINCT FROM NEW.email
        AND public.has_role(OLD.id, 'partner')
        AND lower(COALESCE(NEW.email, '')) <> 'abdullahbalanca@gmail.com' THEN
    RAISE EXCEPTION 'The initial partner account email cannot be changed through account settings';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_agroei_auth_registration() FROM PUBLIC;
CREATE TRIGGER agroei_restrict_initial_account
BEFORE INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.guard_agroei_auth_registration();
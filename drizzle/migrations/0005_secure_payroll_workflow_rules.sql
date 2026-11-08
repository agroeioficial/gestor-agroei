CREATE POLICY "Partners and HR read non-partner role directory" ON public.user_roles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)) AND NOT public.has_role(user_id, 'partner'::public.app_role));

ALTER TABLE public.payroll_runs ADD COLUMN payment_proof_path text;

CREATE OR REPLACE FUNCTION public.calculate_agroei_payroll_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  run_record public.payroll_runs%ROWTYPE;
BEGIN
  SELECT * INTO run_record FROM public.payroll_runs WHERE id = NEW.payroll_run_id;
  IF NOT FOUND OR run_record.status <> 'draft' THEN
    RAISE EXCEPTION 'Payroll items can only be created for a draft payroll';
  END IF;
  NEW.period_month := run_record.period_month;
  NEW.period_year := run_record.period_year;
  NEW.payment_status := run_record.status;
  NEW.employee_inss := round(NEW.base_salary * 0.03, 2);
  NEW.employer_inss := round(NEW.base_salary * 0.04, 2);
  NEW.absence_deduction := round((NEW.base_salary / 30) * NEW.unexcused_absence_days, 2);
  NEW.gross_pay := round(NEW.base_salary + NEW.bonus_amount + NEW.position_compensation, 2);
  NEW.net_pay := greatest(0, round(NEW.gross_pay - NEW.employee_inss - NEW.absence_deduction, 2));
  RETURN NEW;
END;
$$;
CREATE TRIGGER calculate_agroei_payroll_item BEFORE INSERT OR UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION public.calculate_agroei_payroll_item();

CREATE OR REPLACE FUNCTION public.protect_agroei_payroll_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'payroll_runs' THEN
    IF public.has_role(auth.uid(), 'partner'::public.app_role) THEN
      RETURN NEW;
    ELSIF public.has_role(auth.uid(), 'hr'::public.app_role) THEN
      IF OLD.status <> 'draft' OR NEW.status NOT IN ('draft', 'sent_to_finance')
         OR NEW.id IS DISTINCT FROM OLD.id
         OR NEW.period_month IS DISTINCT FROM OLD.period_month
         OR NEW.period_year IS DISTINCT FROM OLD.period_year
         OR NEW.scheduled_payment_date IS DISTINCT FROM OLD.scheduled_payment_date
         OR NEW.created_by IS DISTINCT FROM OLD.created_by
         OR NEW.created_at IS DISTINCT FROM OLD.created_at
         OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
         OR NEW.payment_proof_path IS DISTINCT FROM OLD.payment_proof_path THEN
        RAISE EXCEPTION 'HR can only submit a draft payroll to finance';
      END IF;
    ELSIF public.has_role(auth.uid(), 'finance'::public.app_role) THEN
      IF OLD.status <> 'sent_to_finance' OR NEW.status <> 'paid'
         OR NEW.id IS DISTINCT FROM OLD.id
         OR NEW.period_month IS DISTINCT FROM OLD.period_month
         OR NEW.period_year IS DISTINCT FROM OLD.period_year
         OR NEW.scheduled_payment_date IS DISTINCT FROM OLD.scheduled_payment_date
         OR NEW.created_by IS DISTINCT FROM OLD.created_by
         OR NEW.created_at IS DISTINCT FROM OLD.created_at
         OR NEW.processed_at IS DISTINCT FROM OLD.processed_at
         OR NEW.sent_to_finance_at IS DISTINCT FROM OLD.sent_to_finance_at
         OR NEW.payment_proof_path IS NULL OR length(trim(NEW.payment_proof_path)) = 0 THEN
        RAISE EXCEPTION 'Finance can only pay a submitted payroll with a payment proof';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'partner'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'finance'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'hr'::public.app_role) THEN
    IF OLD.payment_status <> 'draft'
       OR NOT EXISTS (SELECT 1 FROM public.payroll_runs r WHERE r.id = OLD.payroll_run_id AND r.status = 'draft') THEN
      RAISE EXCEPTION 'HR can only edit payroll items in a draft run';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.employee_id IS DISTINCT FROM auth.uid()
     OR OLD.payment_status <> 'paid'
     OR OLD.employee_confirmed_at IS NOT NULL
     OR NEW.employee_confirmed_at IS NULL
     OR NEW.employee_signature IS NULL
     OR length(trim(NEW.employee_signature)) NOT BETWEEN 2 AND 120
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.payroll_run_id IS DISTINCT FROM OLD.payroll_run_id
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.period_month IS DISTINCT FROM OLD.period_month
     OR NEW.period_year IS DISTINCT FROM OLD.period_year
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.base_salary IS DISTINCT FROM OLD.base_salary
     OR NEW.bonus_amount IS DISTINCT FROM OLD.bonus_amount
     OR NEW.position_compensation IS DISTINCT FROM OLD.position_compensation
     OR NEW.unexcused_absence_days IS DISTINCT FROM OLD.unexcused_absence_days
     OR NEW.employee_inss IS DISTINCT FROM OLD.employee_inss
     OR NEW.employer_inss IS DISTINCT FROM OLD.employer_inss
     OR NEW.absence_deduction IS DISTINCT FROM OLD.absence_deduction
     OR NEW.gross_pay IS DISTINCT FROM OLD.gross_pay
     OR NEW.net_pay IS DISTINCT FROM OLD.net_pay
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Employees can only confirm receipt of their own paid payroll';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_agroei_file(_name text, _operation text)
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
    WHERE user_id::text = split_part(_name, '/', 2) AND role = 'partner'
  );
  current_is_partner boolean := public.has_role(auth.uid(), 'partner');
  current_is_hr boolean := public.has_role(auth.uid(), 'hr');
  current_is_admin boolean := public.has_role(auth.uid(), 'administrative');
  current_is_finance boolean := public.has_role(auth.uid(), 'finance');
BEGIN
  IF auth.uid() IS NULL OR _operation NOT IN ('select', 'insert', 'update', 'delete') THEN
    RETURN false;
  END IF;
  IF current_is_partner THEN RETURN true; END IF;
  IF _operation = 'select' AND folder = 'payslips' AND owner_id = auth.uid()::text AND NOT owner_is_partner THEN
    RETURN true;
  END IF;
  IF current_is_hr AND folder IN ('employee-documents', 'payslips') AND NOT owner_is_partner THEN
    RETURN true;
  END IF;
  IF current_is_admin AND folder = 'finance' THEN RETURN true; END IF;
  IF current_is_finance AND folder = 'finance-payroll' THEN RETURN true; END IF;
  IF current_is_admin AND folder = 'payslips' AND NOT owner_is_partner THEN RETURN true; END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_agroei_payroll_item_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.payroll_items
    SET payment_status = NEW.status,
        paid_at = CASE WHEN NEW.status = 'paid' THEN COALESCE(NEW.paid_at, now()) ELSE NULL END
    WHERE payroll_run_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

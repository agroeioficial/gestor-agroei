CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent_to_finance', 'paid')),
  scheduled_payment_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  sent_to_finance_at timestamptz,
  paid_at timestamptz,
  UNIQUE (period_month, period_year)
);
GRANT SELECT, INSERT, UPDATE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners and HR manage payroll runs" ON public.payroll_runs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));
CREATE POLICY "Finance reads submitted payroll runs" ON public.payroll_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'finance'::public.app_role) AND status IN ('sent_to_finance', 'paid'));
CREATE POLICY "Finance pays submitted payroll runs" ON public.payroll_runs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'finance'::public.app_role) AND status = 'sent_to_finance') WITH CHECK (public.has_role(auth.uid(), 'finance'::public.app_role) AND status = 'paid');

CREATE TABLE public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(user_id),
  period_month smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  payment_status text NOT NULL DEFAULT 'draft' CHECK (payment_status IN ('draft', 'sent_to_finance', 'paid')),
  base_salary numeric(12,2) NOT NULL CHECK (base_salary >= 0),
  bonus_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (bonus_amount >= 0),
  position_compensation numeric(12,2) NOT NULL DEFAULT 0 CHECK (position_compensation >= 0),
  unexcused_absence_days numeric(5,2) NOT NULL DEFAULT 0 CHECK (unexcused_absence_days BETWEEN 0 AND 30),
  employee_inss numeric(12,2) NOT NULL CHECK (employee_inss >= 0),
  employer_inss numeric(12,2) NOT NULL CHECK (employer_inss >= 0),
  absence_deduction numeric(12,2) NOT NULL CHECK (absence_deduction >= 0),
  gross_pay numeric(12,2) NOT NULL CHECK (gross_pay >= 0),
  net_pay numeric(12,2) NOT NULL CHECK (net_pay >= 0),
  paid_at timestamptz,
  employee_signature text,
  employee_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE ON public.payroll_items TO authenticated;
GRANT ALL ON public.payroll_items TO service_role;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners and HR read payroll details" ON public.payroll_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));
CREATE POLICY "Finance reads submitted payroll details" ON public.payroll_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'finance'::public.app_role) AND payment_status IN ('sent_to_finance', 'paid'));
CREATE POLICY "Employees read only their paid payroll details" ON public.payroll_items FOR SELECT TO authenticated USING (employee_id = auth.uid() AND payment_status = 'paid');
CREATE POLICY "Partners and HR create payroll details" ON public.payroll_items FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)) AND EXISTS (SELECT 1 FROM public.payroll_runs r WHERE r.id = payroll_run_id AND r.status = 'draft'));
CREATE POLICY "Partners and HR update payroll details" ON public.payroll_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));
CREATE POLICY "Employees confirm their own paid payroll" ON public.payroll_items FOR UPDATE TO authenticated USING (employee_id = auth.uid() AND payment_status = 'paid' AND employee_confirmed_at IS NULL) WITH CHECK (employee_id = auth.uid() AND payment_status = 'paid');

CREATE OR REPLACE FUNCTION public.protect_agroei_payroll_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'payroll_runs' AND public.has_role(auth.uid(), 'finance'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'partner'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'hr'::public.app_role) THEN
    IF OLD.status <> 'sent_to_finance' OR NEW.status <> 'paid'
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.period_month IS DISTINCT FROM OLD.period_month
       OR NEW.period_year IS DISTINCT FROM OLD.period_year
       OR NEW.scheduled_payment_date IS DISTINCT FROM OLD.scheduled_payment_date
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.processed_at IS DISTINCT FROM OLD.processed_at
       OR NEW.sent_to_finance_at IS DISTINCT FROM OLD.sent_to_finance_at THEN
      RAISE EXCEPTION 'Finance can only mark a submitted payroll as paid';
    END IF;
  ELSIF TG_TABLE_NAME = 'payroll_items'
     AND NOT public.has_role(auth.uid(), 'partner'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'hr'::public.app_role) THEN
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
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_agroei_payroll_runs BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.protect_agroei_payroll_updates();
CREATE TRIGGER protect_agroei_payroll_items BEFORE UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION public.protect_agroei_payroll_updates();

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
CREATE TRIGGER sync_agroei_payroll_items AFTER UPDATE OF status ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.sync_agroei_payroll_item_status();

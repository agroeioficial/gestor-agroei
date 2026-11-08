ALTER TABLE public.payroll_items ADD COLUMN hr_signature text;
ALTER TABLE public.payroll_items ADD COLUMN hr_signed_by uuid;
ALTER TABLE public.payroll_items ADD COLUMN hr_signed_at timestamptz;

DROP POLICY "Partners and HR manage payroll runs" ON public.payroll_runs;
CREATE POLICY "Partners and HR read all payroll runs" ON public.payroll_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));
CREATE POLICY "Partners and HR create payroll runs" ON public.payroll_runs FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)) AND created_by = auth.uid() AND status = 'draft');
CREATE POLICY "Partners and HR update draft payroll runs" ON public.payroll_runs FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)) AND status = 'draft') WITH CHECK ((public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)) AND status IN ('draft', 'sent_to_finance'));
REVOKE DELETE ON public.payroll_runs FROM authenticated;

DROP POLICY "Partners and HR create payroll details" ON public.payroll_items;
DROP POLICY "Partners and HR update payroll details" ON public.payroll_items;
CREATE POLICY "Partners and HR create draft payroll details" ON public.payroll_items FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)) AND EXISTS (SELECT 1 FROM public.payroll_runs r WHERE r.id = payroll_run_id AND r.status = 'draft'));
CREATE POLICY "Partners and HR update draft payroll details" ON public.payroll_items FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)) AND payment_status = 'draft') WITH CHECK ((public.has_role(auth.uid(), 'partner'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)));
REVOKE DELETE ON public.payroll_items FROM authenticated;

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
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run was not found'; END IF;
  IF run_record.status = 'draft' THEN
    NEW.period_month := run_record.period_month;
    NEW.period_year := run_record.period_year;
    NEW.payment_status := 'draft';
    NEW.employee_inss := round(NEW.base_salary * 0.03, 2);
    NEW.employer_inss := round(NEW.base_salary * 0.04, 2);
    NEW.absence_deduction := round((NEW.base_salary / 30) * NEW.unexcused_absence_days, 2);
    NEW.gross_pay := round(NEW.base_salary + NEW.bonus_amount + NEW.position_compensation, 2);
    NEW.net_pay := greatest(0, round(NEW.gross_pay - NEW.employee_inss - NEW.absence_deduction, 2));
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.payment_status = run_record.status
     AND NEW.period_month IS NOT DISTINCT FROM OLD.period_month
     AND NEW.period_year IS NOT DISTINCT FROM OLD.period_year
     AND NEW.base_salary IS NOT DISTINCT FROM OLD.base_salary
     AND NEW.bonus_amount IS NOT DISTINCT FROM OLD.bonus_amount
     AND NEW.position_compensation IS NOT DISTINCT FROM OLD.position_compensation
     AND NEW.unexcused_absence_days IS NOT DISTINCT FROM OLD.unexcused_absence_days
     AND NEW.employee_inss IS NOT DISTINCT FROM OLD.employee_inss
     AND NEW.employer_inss IS NOT DISTINCT FROM OLD.employer_inss
     AND NEW.absence_deduction IS NOT DISTINCT FROM OLD.absence_deduction
     AND NEW.gross_pay IS NOT DISTINCT FROM OLD.gross_pay
     AND NEW.net_pay IS NOT DISTINCT FROM OLD.net_pay THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Payroll details are locked after submission';
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_agroei_payroll_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'payroll_runs' THEN
    IF public.has_role(auth.uid(), 'partner'::public.app_role) THEN RETURN NEW; END IF;
    IF public.has_role(auth.uid(), 'hr'::public.app_role) THEN
      IF OLD.status <> 'draft' OR NEW.status NOT IN ('draft', 'sent_to_finance')
         OR NEW.id IS DISTINCT FROM OLD.id
         OR NEW.period_month IS DISTINCT FROM OLD.period_month
         OR NEW.period_year IS DISTINCT FROM OLD.period_year
         OR NEW.scheduled_payment_date IS DISTINCT FROM OLD.scheduled_payment_date
         OR NEW.created_by IS DISTINCT FROM OLD.created_by
         OR NEW.created_at IS DISTINCT FROM OLD.created_at
         OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
         OR NEW.payment_proof_path IS DISTINCT FROM OLD.payment_proof_path
         OR (NEW.status = 'sent_to_finance' AND NOT EXISTS (
           SELECT 1 FROM public.payroll_items i WHERE i.payroll_run_id = OLD.id
             AND i.hr_signature IS NOT NULL AND length(trim(i.hr_signature)) BETWEEN 2 AND 120
             AND i.hr_signed_by = auth.uid() AND i.hr_signed_at IS NOT NULL
         )) THEN
        RAISE EXCEPTION 'HR can only submit a draft payroll after signing its items';
      END IF;
      RETURN NEW;
    END IF;
    IF public.has_role(auth.uid(), 'finance'::public.app_role)
       AND OLD.status = 'sent_to_finance' AND NEW.status = 'paid'
       AND NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.period_month IS NOT DISTINCT FROM OLD.period_month
       AND NEW.period_year IS NOT DISTINCT FROM OLD.period_year
       AND NEW.scheduled_payment_date IS NOT DISTINCT FROM OLD.scheduled_payment_date
       AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND NEW.processed_at IS NOT DISTINCT FROM OLD.processed_at
       AND NEW.sent_to_finance_at IS NOT DISTINCT FROM OLD.sent_to_finance_at
       AND NEW.payment_proof_path IS NOT NULL AND length(trim(NEW.payment_proof_path)) > 0 THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Payroll status change is not allowed';
  END IF;

  IF public.has_role(auth.uid(), 'partner'::public.app_role) THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'finance'::public.app_role) THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'hr'::public.app_role) THEN
    IF OLD.payment_status <> 'draft' OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.payroll_run_id IS DISTINCT FROM OLD.payroll_run_id THEN
      RAISE EXCEPTION 'HR can only edit draft payroll details';
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
     OR NEW.hr_signature IS DISTINCT FROM OLD.hr_signature
     OR NEW.hr_signed_by IS DISTINCT FROM OLD.hr_signed_by
     OR NEW.hr_signed_at IS DISTINCT FROM OLD.hr_signed_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Employees can only confirm receipt of their own paid payroll';
  END IF;
  RETURN NEW;
END;
$$;

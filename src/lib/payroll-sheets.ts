import type { Tables } from "@/integrations/supabase/types";

export type PayrollItemRow = Tables<"payroll_items">;
export type PayrollRunRow = Tables<"payroll_runs">;

export type PayrollSheetWrite = {
  rowNumber: number;
  values: string[];
};

export type PayrollSheetPlan = {
  updates: PayrollSheetWrite[];
  appends: string[][];
};

const SHEET_WIDTH = 21;

export function payrollItemToSheetRow(
  item: PayrollItemRow,
  run: Pick<PayrollRunRow, "scheduled_payment_date">,
  employeeName: string,
): string[] {
  return [
    "Gestor AgroEI",
    `${item.period_month}/${item.period_year}`,
    String(item.period_year),
    employeeName,
    item.id,
    item.payment_status,
    String(item.base_salary),
    String(item.bonus_amount),
    String(item.position_compensation),
    String(item.unexcused_absence_days),
    String(item.employee_inss),
    String(item.absence_deduction),
    String(item.gross_pay),
    String(item.net_pay),
    String(item.employer_inss),
    run.scheduled_payment_date,
    item.paid_at ?? "",
    item.hr_signature ?? "",
    item.hr_signed_at ?? "",
    item.employee_signature ?? "",
    item.employee_confirmed_at ?? "",
  ];
}

export function planPayrollSheetWrites(
  items: PayrollItemRow[],
  run: Pick<PayrollRunRow, "scheduled_payment_date">,
  existingItemIds: string[],
  namesByEmployeeId: ReadonlyMap<string, string>,
  canAppend: boolean,
): PayrollSheetPlan {
  const rowByItemId = new Map<string, { rowNumber: number; values: string[] }>();
  existingItemIds.forEach((itemId, index) => {
    if (itemId) rowByItemId.set(itemId, { rowNumber: index + 3, values: [] });
  });

  const updates: PayrollSheetWrite[] = [];
  const appends: string[][] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    const existing = rowByItemId.get(item.id);
    const employeeName = namesByEmployeeId.get(item.employee_id) ?? "";
    if (!employeeName && !existing) {
      throw new Error("Não foi possível identificar o funcionário desta folha.");
    }

    const values = payrollItemToSheetRow(item, run, employeeName);
    if (existing) {
      updates.push({ rowNumber: existing.rowNumber, values: values.slice(5) });
    } else if (canAppend) {
      appends.push(values);
    } else {
      throw new Error("A folha ainda não existe na planilha. Peça ao RH para sincronizá-la.");
    }
  }

  return { updates, appends };
}

export function payrollSheetHeaders(): string[] {
  return [
    "Empresa",
    "Mês",
    "Ano",
    "Nome do funcionário",
    "Identificador da folha",
    "Estado",
    "Salário base (MZN)",
    "Bónus (MZN)",
    "Remuneração de cargo (MZN)",
    "Faltas injustificadas (dias)",
    "INSS do funcionário (MZN)",
    "Desconto por faltas (MZN)",
    "Salário bruto (MZN)",
    "Salário líquido (MZN)",
    "INSS patronal (MZN)",
    "Pagamento previsto",
    "Pagamento registado",
    "Assinatura RH",
    "Data da assinatura RH",
    "Assinatura do funcionário",
    "Data da confirmação",
  ];
}

export function payrollSheetTitleRow(): string[] {
  return ["Gestor AgroEI — Folha de Salário", ...Array.from({ length: SHEET_WIDTH - 1 }, () => "")];
}

export function padPayrollSheetRow(values: string[]): string[] {
  return Array.from({ length: SHEET_WIDTH }, (_, index) => values[index] ?? "");
}
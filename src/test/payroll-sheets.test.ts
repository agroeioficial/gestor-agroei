import { describe, expect, it } from "vitest";
import { calculatePayroll } from "@/lib/payroll-calculation";
import { createPayslipPdf } from "@/lib/payroll-payslip";
import { padPayrollSheetRow, planPayrollSheetWrites, type PayrollItemRow, type PayrollRunRow } from "@/lib/payroll-sheets";

const run = { scheduled_payment_date: "2026-11-20" } as Pick<PayrollRunRow, "scheduled_payment_date">;

function item(id: string, employeeId = "employee-1"): PayrollItemRow {
  return {
    id,
    payroll_run_id: "run-1",
    employee_id: employeeId,
    period_month: 11,
    period_year: 2026,
    payment_status: "paid",
    base_salary: 10000,
    bonus_amount: 250,
    position_compensation: 500,
    unexcused_absence_days: 1,
    employee_inss: 300,
    employer_inss: 400,
    absence_deduction: 333.33,
    gross_pay: 10750,
    net_pay: 10116.67,
    paid_at: "2026-11-20T08:00:00.000Z",
    employee_signature: "Funcionário de Teste",
    employee_confirmed_at: "2026-11-20T10:00:00.000Z",
    hr_signature: "RH de Teste",
    hr_signed_at: "2026-11-15T10:00:00.000Z",
    created_at: "2026-11-15T10:00:00.000Z",
  };
}

describe("payroll sheet synchronization planning", () => {
  it("creates one complete spreadsheet row with the exact payroll fields", () => {
    const plan = planPayrollSheetWrites([item("item-1")], run, [], new Map([["employee-1", "Funcionário de Teste"]]), true);
    expect(plan.appends).toHaveLength(1);
    expect(padPayrollSheetRow(plan.appends[0] ?? [])).toHaveLength(21);
    expect(plan.appends[0]?.[4]).toBe("item-1");
    expect(plan.appends[0]?.[13]).toBe("10116.67");
  });

  it("updates an existing row instead of appending a second copy", () => {
    const plan = planPayrollSheetWrites([item("item-1")], run, ["item-1"], new Map(), false);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]?.rowNumber).toBe(3);
    expect(plan.appends).toHaveLength(0);
    expect(plan.updates[0]?.values[5]).toBe("paid");
  });

  it("does not append an unrecognized salary row for finance-only or employee accounts", () => {
    expect(() => planPayrollSheetWrites([item("new-item")], run, [], new Map(), false))
      .toThrow("A folha ainda não existe na planilha. Peça ao RH para sincronizá-la.");
  });

  it("deduplicates repeated records in one sync operation", () => {
    const plan = planPayrollSheetWrites([item("item-1"), item("item-1")], run, [], new Map([["employee-1", "Teste"]]), true);
    expect(plan.appends).toHaveLength(1);
  });
});

describe("individual payslip PDF", () => {
  it("creates a single-page PDF with paid and signed salary details", async () => {
    const amounts = calculatePayroll(10000, 250, 500, 1);
    const pdf = await createPayslipPdf({
      ...item("item-1"),
      ...amounts,
      ...run,
      employeeName: "Funcionário de Teste",
      hr_signature: "RH de Teste",
      hr_signed_at: "2026-11-15T10:00:00.000Z",
      employee_signature: "Funcionário de Teste",
      employee_confirmed_at: "2026-11-20T10:00:00.000Z",
      paid_at: "2026-11-20T08:00:00.000Z",
    });
    const header = new TextDecoder().decode(pdf.slice(0, 8));
    expect(header).toContain("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(1);
    expect(parsed.getPage(0)?.getSize().height).toBeGreaterThan(800);
  });

  it("refuses an invalid pay period", async () => {
    await expect(createPayslipPdf({ ...item("item-1"), ...run, employeeName: "Teste", period_month: 13 }))
      .rejects.toThrow("Mês inválido.");
  });
});
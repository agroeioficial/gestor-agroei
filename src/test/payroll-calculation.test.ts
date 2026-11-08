import { describe, expect, it } from "vitest";
import { calculatePayroll, scheduledPaymentDate } from "@/lib/payroll-calculation";

describe("confirmed payroll rules", () => {
  it("deducts employee INSS at 3% of base salary", () => {
    expect(calculatePayroll(10000, 0, 0, 0).employeeInss).toBe(300);
  });

  it("calculates employer INSS at 4% of base salary without reducing take-home pay", () => {
    expect(calculatePayroll(10000, 0, 0, 0)).toMatchObject({ employerInss: 400, netPay: 9700 });
  });

  it("calculates absence deductions using a 30-day month", () => {
    expect(calculatePayroll(9000, 0, 0, 2).absenceDeduction).toBe(600);
  });

  it("moves a Saturday payment date to the previous Friday", () => {
    expect(scheduledPaymentDate(2026, 6)).toBe("2026-06-19");
  });

  it("moves a Sunday payment date to the following Monday", () => {
    expect(scheduledPaymentDate(2026, 9)).toBe("2026-09-21");
  });
});
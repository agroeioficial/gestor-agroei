export type PayrollAmounts = {
  employeeInss: number;
  employerInss: number;
  absenceDeduction: number;
  grossPay: number;
  netPay: number;
};

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculatePayroll(
  baseSalary: number,
  bonusAmount: number,
  positionCompensation: number,
  absenceDays: number,
): PayrollAmounts {
  const employeeInss = roundMoney(baseSalary * 0.03);
  const employerInss = roundMoney(baseSalary * 0.04);
  const absenceDeduction = roundMoney((baseSalary / 30) * absenceDays);
  const grossPay = roundMoney(baseSalary + bonusAmount + positionCompensation);

  return {
    employeeInss,
    employerInss,
    absenceDeduction,
    grossPay,
    netPay: roundMoney(Math.max(0, grossPay - employeeInss - absenceDeduction)),
  };
}

export function scheduledPaymentDate(year: number, month: number): string {
  const dueDate = new Date(Date.UTC(year, month - 1, 20));
  const dayOfWeek = dueDate.getUTCDay();
  if (dayOfWeek === 6) dueDate.setUTCDate(19);
  if (dayOfWeek === 0) dueDate.setUTCDate(21);
  return dueDate.toISOString().slice(0, 10);
}
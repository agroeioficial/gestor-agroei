import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PayrollItemRow, PayrollRunRow } from "@/lib/payroll-sheets";

export type PayslipDetails = Pick<
  PayrollItemRow,
  | "period_month"
  | "period_year"
  | "base_salary"
  | "bonus_amount"
  | "position_compensation"
  | "unexcused_absence_days"
  | "employee_inss"
  | "employer_inss"
  | "absence_deduction"
  | "gross_pay"
  | "net_pay"
  | "paid_at"
  | "hr_signature"
  | "hr_signed_at"
  | "employee_signature"
  | "employee_confirmed_at"
> & Pick<PayrollRunRow, "scheduled_payment_date"> & { employeeName: string };

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const green = rgb(0.11, 0.35, 0.22);
const muted = rgb(0.36, 0.42, 0.38);
const line = rgb(0.83, 0.87, 0.84);
const paleGreen = rgb(0.93, 0.96, 0.93);

function money(value: number): string {
  return `${new Intl.NumberFormat("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} MZN`;
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-MZ", { dateStyle: "long", timeZone: "Africa/Maputo" }).format(new Date(value));
}

export async function createPayslipPdf(details: PayslipDetails): Promise<Uint8Array> {
  if (details.period_month < 1 || details.period_month > 12) throw new Error("Mês inválido.");

  const document = await PDFDocument.create();
  document.setTitle(`Folha de Salário - ${months[details.period_month - 1]} ${details.period_year}`);
  document.setAuthor("AgroEI");
  document.setSubject("Folha salarial individual");
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const left = 48;
  const right = width - 48;

  page.drawText("AgroEI", { x: left, y: height - 65, size: 22, font: bold, color: green });
  page.drawText("Agropecuária e Empreendedorismo Inovadores", { x: left, y: height - 84, size: 9, font: regular, color: muted });
  page.drawText("FOLHA DE SALÁRIO", { x: left, y: height - 132, size: 17, font: bold, color: green });
  page.drawText(`${months[details.period_month - 1]} de ${details.period_year}`, { x: left, y: height - 154, size: 11, font: regular, color: muted });
  page.drawLine({ start: { x: left, y: height - 174 }, end: { x: right, y: height - 174 }, thickness: 1, color: line });

  page.drawText("Funcionário", { x: left, y: height - 204, size: 9, font: regular, color: muted });
  page.drawText(details.employeeName || "Funcionário", { x: left, y: height - 222, size: 12, font: bold, color: rgb(0.12, 0.15, 0.13) });
  page.drawText("Pagamento previsto", { x: 340, y: height - 204, size: 9, font: regular, color: muted });
  page.drawText(dateLabel(details.scheduled_payment_date), { x: 340, y: height - 222, size: 11, font: bold, color: rgb(0.12, 0.15, 0.13) });

  const tableTop = height - 258;
  page.drawRectangle({ x: left, y: tableTop - 26, width: right - left, height: 26, color: green });
  page.drawText("DESCRIÇÃO", { x: left + 10, y: tableTop - 18, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("VALOR", { x: right - 98, y: tableTop - 18, size: 9, font: bold, color: rgb(1, 1, 1) });

  const rows: Array<[string, string, boolean]> = [
    ["Salário base", money(Number(details.base_salary)), false],
    ["Bónus", money(Number(details.bonus_amount)), false],
    ["Remuneração de cargo", money(Number(details.position_compensation)), false],
    ["Salário bruto", money(Number(details.gross_pay)), true],
    ["INSS do funcionário", `- ${money(Number(details.employee_inss))}`, false],
    [`Faltas injustificadas (${Number(details.unexcused_absence_days)} dias)`, `- ${money(Number(details.absence_deduction))}`, false],
    ["Salário líquido recebido", money(Number(details.net_pay)), true],
  ];

  let y = tableTop - 48;
  for (const [label, amount, emphasized] of rows) {
    if (emphasized) page.drawRectangle({ x: left, y: y - 10, width: right - left, height: 28, color: paleGreen });
    const font = emphasized ? bold : regular;
    const color = emphasized ? green : rgb(0.12, 0.15, 0.13);
    page.drawText(label, { x: left + 10, y, size: 10, font, color, maxWidth: 340 });
    page.drawText(amount, { x: right - 185, y, size: 10, font, color, maxWidth: 175 });
    y -= 35;
  }

  page.drawText(`Contribuição patronal INSS (informativa): ${money(Number(details.employer_inss))}`, { x: left, y: y - 8, size: 9, font: regular, color: muted });
  page.drawText(`Data do processamento: ${dateLabel(details.hr_signed_at)}`, { x: left, y: y - 30, size: 9, font: regular, color: muted });
  page.drawText(`Data do pagamento: ${dateLabel(details.paid_at)}`, { x: left, y: y - 48, size: 9, font: regular, color: muted });

  const signatureY = 112;
  page.drawLine({ start: { x: left, y: signatureY + 24 }, end: { x: 270, y: signatureY + 24 }, thickness: 0.8, color: line });
  page.drawLine({ start: { x: 325, y: signatureY + 24 }, end: { x: right, y: signatureY + 24 }, thickness: 0.8, color: line });
  page.drawText("Assinatura do RH", { x: left, y: signatureY + 8, size: 8, font: bold, color: muted });
  page.drawText("Assinatura do funcionário", { x: 325, y: signatureY + 8, size: 8, font: bold, color: muted });
  page.drawText(details.hr_signature || "—", { x: left, y: signatureY + 40, size: 10, font: regular, color: rgb(0.12, 0.15, 0.13), maxWidth: 205 });
  page.drawText(details.employee_signature || "—", { x: 325, y: signatureY + 40, size: 10, font: regular, color: rgb(0.12, 0.15, 0.13), maxWidth: 205 });
  page.drawText(dateLabel(details.hr_signed_at), { x: left, y: signatureY - 6, size: 8, font: regular, color: muted });
  page.drawText(dateLabel(details.employee_confirmed_at), { x: 325, y: signatureY - 6, size: 8, font: regular, color: muted });

  page.drawLine({ start: { x: left, y: 61 }, end: { x: right, y: 61 }, thickness: 0.7, color: line });
  page.drawText("Documento individual — acesso reservado", { x: left, y: 44, size: 8, font: regular, color: muted });
  page.drawText("IRPS e indemnizações não calculados", { x: right - 190, y: 44, size: 8, font: regular, color: muted });

  return document.save();
}
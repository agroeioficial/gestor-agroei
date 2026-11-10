import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { createPayslipPdf } from "@/lib/payroll-payslip";
import { padPayrollSheetRow, payrollSheetHeaders, payrollSheetTitleRow, planPayrollSheetWrites } from "@/lib/payroll-sheets";

const SHEETS_API = "https://connector-gateway.lovable.dev/google_sheets/v4";
const PAYROLL_SPREADSHEET_ID = "1n1kknheTFX1RtEa57m_nuaBU5qZI3f6y22FkyykpUGw";

const syncInput = z.object({ runId: z.string().uuid() });
const payslipInput = z.object({ itemId: z.string().uuid() });

type AuthenticatedSupabase = SupabaseClient<Database>;

async function hasRole(supabase: AuthenticatedSupabase, userId: string, role: "partner" | "hr" | "finance" | "employee") {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
  if (error) throw new Error("Não foi possível confirmar as permissões da conta.");
  return data === true;
}

function sheetsHeaders(): Headers {
  const gatewayKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!gatewayKey || !connectionKey) throw new Error("A ligação segura ao Google Sheets não está disponível.");
  return new Headers({
    Authorization: `Bearer ${gatewayKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
  });
}

async function gatewayRequest(path: string, method: "GET" | "POST" | "PUT", body?: unknown) {
  const response = await fetch(`${SHEETS_API}${path}`, {
    method,
    headers: sheetsHeaders(),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Google Sheets request failed [${response.status}]: ${errorBody}`);
    throw new Error(`Google Sheets respondeu com erro ${response.status}.`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

async function syncRunToSheets(supabase: AuthenticatedSupabase, userId: string, runId: string) {
  const [partner, hr, finance] = await Promise.all([
    hasRole(supabase, userId, "partner"),
    hasRole(supabase, userId, "hr"),
    hasRole(supabase, userId, "finance"),
  ]);
  if (!partner && !hr && !finance) return { ok: false as const, message: "A sincronização da folha está disponível apenas para RH, Finanças e Sócios." };

  const [{ data: run, error: runError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("payroll_runs").select("id, scheduled_payment_date").eq("id", runId).maybeSingle(),
    supabase.from("payroll_items").select("*").eq("payroll_run_id", runId),
  ]);
  if (runError || itemsError || !run || !items?.length) {
    return { ok: false as const, message: "Não há folhas autorizadas para sincronizar neste período." };
  }
  if (finance && !partner && !hr && items.some((item) => item.payment_status === "draft")) {
    return { ok: false as const, message: "Finanças só pode sincronizar folhas já enviadas para pagamento." };
  }

  const { values: rawRows } = await gatewayRequest(`/spreadsheets/${PAYROLL_SPREADSHEET_ID}/values/Folhas!A3:U`, "GET") as { values?: string[][] };
  const existingRowsByItemId = new Map<string, { rowNumber: number; employeeName: string }>();
  (rawRows ?? []).forEach((row, index) => {
    const itemId = row[4];
    if (itemId) existingRowsByItemId.set(itemId, { rowNumber: index + 3, employeeName: row[3] ?? "" });
  });
  const names = new Map<string, string>();

  if (partner || hr) {
    const employeeIds = [...new Set(items.map((item) => item.employee_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", employeeIds);
    for (const profile of profiles ?? []) {
      if (profile.full_name) names.set(profile.user_id, profile.full_name);
    }
  }

  let plan;
  try {
    plan = planPayrollSheetWrites(items, run, existingRowsByItemId, names, partner || hr);
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Não foi possível preparar a sincronização." };
  }

  const data = plan.updates.map(({ rowNumber, values }) => ({
    range: `Folhas!A${rowNumber}:U${rowNumber}`,
    majorDimension: "ROWS",
    values: [padPayrollSheetRow(values)],
  }));
  if (plan.appends.length) {
    await gatewayRequest(`/spreadsheets/${PAYROLL_SPREADSHEET_ID}/values/Folhas!A:U:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, "POST", {
      majorDimension: "ROWS",
      values: plan.appends.map(padPayrollSheetRow),
    });
  }
  if (!existingRowsByItemId.size && !plan.appends.length) {
    await gatewayRequest(`/spreadsheets/${PAYROLL_SPREADSHEET_ID}/values/Folhas!A1:U2?valueInputOption=RAW`, "PUT", {
      majorDimension: "ROWS",
      values: [payrollSheetTitleRow(), payrollSheetHeaders()],
    });
  }
  if (data.length) {
    await gatewayRequest(`/spreadsheets/${PAYROLL_SPREADSHEET_ID}/values:batchUpdate`, "POST", {
      valueInputOption: "RAW",
      data,
    });
  }

  return { ok: true as const, updated: data.length, added: plan.appends.length };
}

export const syncPayrollToSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => syncInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      return await syncRunToSheets(context.supabase, context.userId, data.runId);
    } catch (error) {
      console.error("Salary sheet synchronization failed", error);
      return { ok: false as const, message: error instanceof Error ? error.message : "Não foi possível sincronizar a planilha salarial." };
    }
  });

export const syncEmployeeConfirmationToSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => payslipInput.parse(input))
  .handler(async ({ data, context }) => {
    const isEmployee = await hasRole(context.supabase, context.userId, "employee");
    if (!isEmployee) return { ok: false as const, message: "Esta confirmação só pode ser sincronizada pela conta do funcionário." };

    const { data: item, error } = await context.supabase.from("payroll_items").select("id, employee_signature, employee_confirmed_at")
      .eq("id", data.itemId)
      .eq("employee_id", context.userId)
      .eq("payment_status", "paid")
      .not("employee_confirmed_at", "is", null)
      .maybeSingle();
    if (error || !item?.employee_signature || !item.employee_confirmed_at) {
      return { ok: false as const, message: "A confirmação pessoal ainda não está registada." };
    }

    try {
  const { values: rawRows } = await gatewayRequest(`/spreadsheets/${PAYROLL_SPREADSHEET_ID}/values/Folhas!A3:U`, "GET") as { values?: string[][] };
      const rowOffset = (rawRows ?? []).findIndex((row) => row[4] === item.id);
      if (rowOffset < 0) return { ok: false as const, message: "O RH ainda não sincronizou esta folha com a planilha." };
      const rowNumber = rowOffset + 3;
      await gatewayRequest(`/spreadsheets/${PAYROLL_SPREADSHEET_ID}/values/Folhas!T${rowNumber}:U${rowNumber}?valueInputOption=RAW`, "PUT", {
        majorDimension: "ROWS",
        values: [[item.employee_signature, item.employee_confirmed_at]],
      });
      return { ok: true as const, message: "A confirmação também foi atualizada na planilha salarial." };
    } catch (caught) {
      console.error("Employee payslip confirmation sync failed", caught);
      return { ok: false as const, message: "A confirmação foi guardada, mas não foi possível atualizar a planilha." };
    }
  });

export const downloadConfirmedPayslip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => payslipInput.parse(input))
  .handler(async ({ data, context }) => {
    const isEmployee = await hasRole(context.supabase, context.userId, "employee");
    if (!isEmployee) throw new Error("A folha individual só pode ser descarregada pelo funcionário autenticado.");

    const { data: item, error } = await context.supabase.from("payroll_items").select("*")
      .eq("id", data.itemId)
      .eq("employee_id", context.userId)
      .eq("payment_status", "paid")
      .not("employee_confirmed_at", "is", null)
      .maybeSingle();
    if (error || !item) throw new Error("A folha não está disponível para esta conta.");

    const [{ data: profile }, { data: run }] = await Promise.all([
      context.supabase.from("profiles").select("full_name").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("payroll_runs").select("scheduled_payment_date").eq("id", item.payroll_run_id).maybeSingle(),
    ]);
    if (!run || !item.hr_signature || !item.employee_signature || !item.hr_signed_at || !item.employee_confirmed_at) {
      throw new Error("A folha ainda não contém todas as assinaturas necessárias.");
    }

    const pdf = await createPayslipPdf({ ...item, ...run, employeeName: profile?.full_name ?? "Funcionário" });
    let binary = "";
    for (const byte of pdf) binary += String.fromCharCode(byte);
    return {
      fileName: `folha-${item.period_year}-${String(item.period_month).padStart(2, "0")}.pdf`,
      pdfBase64: btoa(binary),
    };
  });
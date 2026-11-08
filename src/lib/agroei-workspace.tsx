import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Banknote, BriefcaseBusiness, CalendarDays, CircleAlert, FileCheck2, LayoutDashboard, LockKeyhole, ReceiptText, RefreshCw, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { calculatePayroll, scheduledPaymentDate } from "@/lib/payroll-calculation";

type Role = "partner" | "manager" | "hr" | "finance" | "administrative" | "marketing" | "employee";
type Staff = { user_id: string; full_name: string | null; email: string | null };
type PayrollRun = {
  id: string;
  period_month: number;
  period_year: number;
  status: "draft" | "sent_to_finance" | "paid";
  scheduled_payment_date: string;
  created_at: string;
  payment_proof_path: string | null;
};
type PayrollItem = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  period_month: number;
  period_year: number;
  payment_status: "draft" | "sent_to_finance" | "paid";
  base_salary: number;
  bonus_amount: number;
  position_compensation: number;
  unexcused_absence_days: number;
  employee_inss: number;
  employer_inss: number;
  absence_deduction: number;
  gross_pay: number;
  net_pay: number;
  paid_at: string | null;
  employee_signature: string | null;
  employee_confirmed_at: string | null;
  hr_signature: string | null;
  hr_signed_at: string | null;
};
type DraftStaff = { selected: boolean; base: string; bonus: string; position: string; absences: string };
type Props = { userId: string; fullName: string; roles: Role[] };

const roleNames: Record<Role, string> = {
  partner: "Sócio", manager: "Gerente", hr: "Recursos Humanos", finance: "Finanças",
  administrative: "Administrativo", marketing: "Marketing", employee: "Funcionário",
};
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const money = new Intl.NumberFormat("pt-MZ", { style: "currency", currency: "MZN", maximumFractionDigits: 2 });

export function AgroEiWorkspace({ userId, fullName, roles }: Props) {
  const [view, setView] = useState<"overview" | "payroll">("overview");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftStaff>>({});
  const [signature, setSignature] = useState(fullName);
  const [proofs, setProofs] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  const partner = roles.includes("partner");
  const manager = roles.includes("manager");
  const hr = roles.includes("hr");
  const financeRole = roles.includes("finance");
  const employeeRole = roles.includes("employee");
  const canManagePayroll = partner || hr;
  const canViewPayroll = canManagePayroll || financeRole;
  const primaryRole = roles[0] ?? "employee";

  async function refresh() {
    setError("");
    const requests: PromiseLike<unknown>[] = [];
    if (canViewPayroll) {
      requests.push(Promise.all([
        supabase.from("payroll_runs").select("*").order("created_at", { ascending: false }),
        supabase.from("payroll_items").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false }),
      ]));
    } else if (employeeRole) {
      requests.push(supabase.from("payroll_items").select("*").eq("employee_id", userId).eq("payment_status", "paid").order("period_year", { ascending: false }).order("period_month", { ascending: false }));
    }
    if (canManagePayroll) {
      requests.push(supabase.from("profiles").select("user_id, full_name, email").order("full_name"));
    }
    const results = await Promise.all(requests);
    let position = 0;
    if (canViewPayroll) {
      const result = results[position++] as [{ data: PayrollRun[] | null; error: { message: string } | null }, { data: PayrollItem[] | null; error: { message: string } | null }];
      if (result[0].error || result[1].error) setError("Não foi possível carregar os dados da folha salarial.");
      else { setRuns(result[0].data ?? []); setItems(result[1].data ?? []); }
    } else if (employeeRole) {
      const result = results[position++] as { data: PayrollItem[] | null; error: { message: string } | null };
      if (result.error) setError("Não foi possível carregar as suas folhas salariais.");
      else setItems(result.data ?? []);
    }
    if (canManagePayroll) {
      const result = results[position] as { data: Staff[] | null; error: { message: string } | null };
      if (result.error) setError("Não foi possível carregar a lista autorizada da equipa.");
      else {
        const employees = result.data ?? [];
        setStaff(employees);
        setDrafts((previous) => Object.fromEntries(employees.map((person) => [person.user_id, previous[person.user_id] ?? { selected: false, base: "", bonus: "0", position: "0", absences: "0" }])));
      }
    }
  }

  useEffect(() => { void refresh(); }, [userId, roles.join(",")]);

  const pageTitle = useMemo(() => {
    if (view === "payroll") return canManagePayroll ? "Processamento salarial" : financeRole ? "Pagamentos salariais" : "As minhas folhas salariais";
    if (partner || manager) return "Painel de gestão";
    return `Painel de ${roleNames[primaryRole]}`;
  }, [view, canManagePayroll, financeRole, partner, manager, primaryRole]);

  async function createPayroll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const included = staff.filter((person) => drafts[person.user_id]?.selected);
    if (included.length === 0) { setError("Seleccione pelo menos um funcionário."); return; }
    if (!signature.trim()) { setError("Indique o nome completo para a assinatura digital do RH."); return; }
    if (runs.some((run) => run.period_month === period.month && run.period_year === period.year)) {
      setError("Já existe uma folha para esse mês. Não é possível duplicar o período."); return;
    }
    const payrollRows = included.map((person) => {
      const draft = drafts[person.user_id];
      if (!draft) return null;
      const base = Number(draft.base);
      const bonus = Number(draft.bonus || 0);
      const position = Number(draft.position || 0);
      const absences = Number(draft.absences || 0);
      if (![base, bonus, position, absences].every(Number.isFinite) || base <= 0 || bonus < 0 || position < 0 || absences < 0 || absences > 30) return null;
      const computed = calculatePayroll(base, bonus, position, absences);
      return {
        payroll_run_id: "",
        employee_id: person.user_id,
        period_month: period.month,
        period_year: period.year,
        base_salary: base,
        bonus_amount: bonus,
        position_compensation: position,
        unexcused_absence_days: absences,
        employee_inss: computed.employeeInss,
        employer_inss: computed.employerInss,
        absence_deduction: computed.absenceDeduction,
        gross_pay: computed.grossPay,
        net_pay: computed.netPay,
        hr_signature: signature.trim(),
        hr_signed_by: userId,
        hr_signed_at: new Date().toISOString(),
      };
    });
    if (payrollRows.some((row) => row === null)) {
      setError("Revise os salários: valores devem ser positivos e as faltas não podem exceder 30 dias.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    const now = new Date().toISOString();
    const { data: run, error: runError } = await supabase.from("payroll_runs").insert({
      period_month: period.month, period_year: period.year, scheduled_payment_date: scheduledPaymentDate(period.year, period.month),
      created_by: userId, processed_at: now,
    }).select("id").single();
    if (runError || !run) { setError("Não foi possível criar a folha. Confirme as permissões e o período selecionado."); setBusy(false); return; }
    const validPayrollRows = payrollRows.filter((row): row is NonNullable<typeof row> => row !== null).map((row) => ({ ...row, payroll_run_id: run.id }));
    const { error: itemError } = await supabase.from("payroll_items").insert(validPayrollRows);
    if (itemError) {
      setError("A folha não pôde ser concluída; confirme os valores e tente novamente.");
      setNotice("O rascunho foi preservado para não perder os dados; corrija a folha ou peça a um Sócio para a remover.");
    } else {
      setNotice("Folha criada e assinada pelo RH. Reveja os valores antes de enviar às Finanças.");
      await refresh();
    }
    setBusy(false);
  }

  async function submitToFinance(run: PayrollRun) {
    setBusy(true); setError("");
    const { error: updateError } = await supabase.from("payroll_runs").update({ status: "sent_to_finance", sent_to_finance_at: new Date().toISOString() }).eq("id", run.id);
    if (updateError) setError("A folha precisa de pelo menos uma assinatura válida do RH para seguir às Finanças.");
    else { setNotice("Folha enviada às Finanças."); await refresh(); }
    setBusy(false);
  }

  async function payPayroll(run: PayrollRun) {
    const file = proofs[run.id];
    if (!file) { setError("Carregue o comprovativo antes de confirmar o pagamento."); return; }
    if (file.size > 50 * 1024 * 1024) { setError("O comprovativo deve ter até 50 MB."); return; }
    setBusy(true); setError("");
    const path = `finance-payroll/${run.id}/${crypto.randomUUID()}-${file.name.replace(/[^\p{L}\p{N}._-]/gu, "_")}`;
    const { error: uploadError } = await supabase.storage.from("agroei-private-records").upload(path, file, { upsert: false });
    if (uploadError) { setError("Não foi possível guardar o comprovativo com acesso restrito."); setBusy(false); return; }
    const { error: updateError } = await supabase.from("payroll_runs").update({ status: "paid", paid_at: new Date().toISOString(), payment_proof_path: path }).eq("id", run.id);
    if (updateError) setError("O comprovativo foi guardado, mas o pagamento não foi confirmado.");
    else { setNotice("Pagamento registado. As folhas pessoais já estão disponíveis para a equipa."); await refresh(); }
    setBusy(false);
  }

  async function confirmReceipt(item: PayrollItem) {
    if (!signature.trim()) { setError("Digite o seu nome para confirmar o recebimento."); return; }
    setBusy(true); setError("");
    const { error: confirmError } = await supabase.from("payroll_items").update({ employee_signature: signature.trim(), employee_confirmed_at: new Date().toISOString() }).eq("id", item.id);
    if (confirmError) setError("A confirmação não foi guardada. Verifique se essa folha já foi confirmada.");
    else { setNotice("Recebimento confirmado e registado na sua folha."); await refresh(); }
    setBusy(false);
  }

  async function printPayslip(item: PayrollItem) {
    const { data, error: downloadError } = await supabase.storage.from("agroei-private-records").download(`payslips/${item.employee_id}/${item.period_year}-${String(item.period_month).padStart(2, "0")}.pdf`);
    if (downloadError || !data) { setError("O PDF desta folha ainda não foi disponibilizado. O registo de pagamento está disponível nesta página."); return; }
    const url = URL.createObjectURL(data);
    const link = document.createElement("a"); link.href = url; link.download = `folha-${item.period_year}-${String(item.period_month).padStart(2, "0")}.pdf`; link.click();
    URL.revokeObjectURL(url);
  }

  const outstandingRuns = runs.filter((run) => run.status === "sent_to_finance");
  const employeeItems = items.filter((item) => item.payment_status === "paid");
  const runEmployees = (runId: string) => items.filter((item) => item.payroll_run_id === runId);

  return (
    <section className="space-y-6" aria-label="Área de trabalho da AgroEI">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div><p className="flex items-center gap-2 text-sm font-medium text-primary"><BadgeCheck size={16}/>{roles.map((role) => roleNames[role]).join(" · ")}</p><h2 className="mt-2 text-2xl font-semibold tracking-normal">{pageTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{fullName || "Conta autorizada"} · dados conforme as permissões da sua conta</p></div>
        <div className="flex gap-2"><Button size="sm" variant={view === "overview" ? "default" : "outline"} onClick={() => setView("overview")}><LayoutDashboard/>Painel</Button>{(canViewPayroll || employeeRole) && <Button size="sm" variant={view === "payroll" ? "default" : "outline"} onClick={() => setView("payroll")}><ReceiptText/>Folha salarial</Button>}</div>
      </header>

      {error && <p role="alert" className="border-l-2 border-destructive px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="border-l-2 border-primary px-3 py-2 text-sm text-primary">{notice}</p>}

      {view === "overview" ? (
        <>
          <div className="grid gap-4 border-b border-border pb-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <img src="/branding/icon-agroei.webp" alt="Logótipo AgroEI" className="h-14 w-14 rounded-md" />
            <div><h3 className="text-lg font-semibold">Gestor AgroEI</h3><p className="mt-1 text-sm text-muted-foreground">Agropecuária e Empreendedorismo Inovadores</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(partner || manager) && <Metric icon={<BriefcaseBusiness/>} title="Visão geral" value="Sem lançamentos" note="Os totais aparecerão após registar dados reais."/>}
            {partner && <Metric icon={<Banknote/>} title="Capital social e lucros" value="Acesso reservado" note="Os valores serão apresentados quando existirem registos confirmados."/>}
            {hr && <Metric icon={<UsersRound/>} title="Equipa e folha salarial" value={`${staff.length} perfis acessíveis`} note="O processamento salarial está disponível na folha salarial."/>}
            {financeRole && <Metric icon={<Banknote/>} title="Folhas para pagamento" value={`${outstandingRuns.length} pendentes`} note="Inclui apenas folhas enviadas pelo RH."/>}
            {employeeRole && <Metric icon={<ReceiptText/>} title="Folhas pagas" value={`${employeeItems.length} disponíveis`} note="Só são visíveis as folhas pagas da sua própria conta."/>}
            {!partner && !manager && !hr && !financeRole && !employeeRole && <Metric icon={<LockKeyhole/>} title={roleNames[primaryRole]} value="Área individual" note="Informações restritas à sua função; tarefas serão acrescentadas na próxima etapa."/>}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="border-t border-border pt-5"><div className="flex items-center gap-2"><CalendarDays size={18} className="text-primary"/><h3 className="font-semibold">Tarefas</h3></div><p className="mt-3 text-sm text-muted-foreground">Ainda não há tarefas registadas para esta conta.</p></section>
            <section className="border-t border-border pt-5"><div className="flex items-center gap-2"><CircleAlert size={18} className="text-primary"/><h3 className="font-semibold">Acompanhamento</h3></div><p className="mt-3 text-sm text-muted-foreground">Os indicadores financeiros serão mostrados após o registo dos dados oficiais, sem números demonstrativos.</p></section>
          </div>
        </>
      ) : (
        <PayrollWorkspace
          canManagePayroll={canManagePayroll} financeRole={financeRole} employeeRole={employeeRole}
          staff={staff} runs={runs} items={items} drafts={drafts} setDrafts={setDrafts}
          period={period} setPeriod={setPeriod} signature={signature} setSignature={setSignature}
          proofs={proofs} setProofs={setProofs} busy={busy} onCreate={createPayroll}
          onSubmit={submitToFinance} onPay={payPayroll} onConfirm={confirmReceipt} onPrint={printPayslip}
          runEmployees={runEmployees}
        />
      )}
    </section>
  );
}

function Metric({ icon, title, value, note }: { icon: React.ReactNode; title: string; value: string; note: string }) {
  return <article className="border-l-2 border-primary/40 pl-4 py-2"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{title}</div><p className="mt-2 text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></article>;
}

function PayrollWorkspace({ canManagePayroll, financeRole, employeeRole, staff, runs, items, drafts, setDrafts, period, setPeriod, signature, setSignature, proofs, setProofs, busy, onCreate, onSubmit, onPay, onConfirm, onPrint, runEmployees }: {
  canManagePayroll: boolean; financeRole: boolean; employeeRole: boolean; staff: Staff[]; runs: PayrollRun[]; items: PayrollItem[];
  drafts: Record<string, DraftStaff>; setDrafts: React.Dispatch<React.SetStateAction<Record<string, DraftStaff>>>;
  period: { month: number; year: number }; setPeriod: React.Dispatch<React.SetStateAction<{ month: number; year: number }>>;
  signature: string; setSignature: (value: string) => void; proofs: Record<string, File | null>; setProofs: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
  busy: boolean; onCreate: (event: React.FormEvent<HTMLFormElement>) => void; onSubmit: (run: PayrollRun) => void; onPay: (run: PayrollRun) => void;
  onConfirm: (item: PayrollItem) => void; onPrint: (item: PayrollItem) => void; runEmployees: (runId: string) => PayrollItem[];
}) {
  return <div className="space-y-7">
    {canManagePayroll && <form onSubmit={onCreate} className="space-y-5 border-b border-border pb-7">
      <div><h3 className="font-semibold">Preparar folha mensal</h3><p className="mt-1 text-sm text-muted-foreground">A folha será assinada pelo RH antes do envio às Finanças. IRPS e indemnizações não são calculados.</p></div>
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm">Mês<select value={period.month} onChange={(event) => setPeriod((value) => ({ ...value, month: Number(event.target.value) }))} className="form-control mt-1">{monthNames.map((month, index) => <option value={index + 1} key={month}>{month}</option>)}</select></label><label className="text-sm">Ano<input type="number" min="2020" max="2100" value={period.year} onChange={(event) => setPeriod((value) => ({ ...value, year: Number(event.target.value) }))} className="form-control mt-1"/></label><label className="text-sm">Pagamento previsto<input readOnly value={scheduledPaymentDate(period.year, period.month)} className="form-control mt-1"/></label></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="p-2">Incluir</th><th className="p-2">Funcionário</th><th className="p-2">Base (MZN)</th><th className="p-2">Bónus</th><th className="p-2">Cargo</th><th className="p-2">Faltas (dias)</th></tr></thead><tbody>{staff.map((person) => { const row = drafts[person.user_id] ?? { selected: false, base: "", bonus: "0", position: "0", absences: "0" }; return <tr key={person.user_id} className="border-b border-border/60"><td className="p-2"><input aria-label={`Incluir ${person.full_name ?? person.email ?? "funcionário"}`} type="checkbox" checked={row.selected} onChange={(event) => setDrafts((current) => ({ ...current, [person.user_id]: { ...row, selected: event.target.checked } }))}/></td><td className="p-2">{person.full_name ?? person.email ?? "Sem nome"}</td>{([["base", "Salário base"], ["bonus", "Bónus"], ["position", "Remuneração de cargo"], ["absences", "Faltas injustificadas"]] as const).map(([key, label]) => <td className="p-2" key={key}><input aria-label={`${label}: ${person.full_name ?? person.email ?? "funcionário"}`} type="number" min="0" step="0.01" max={key === "absences" ? "30" : undefined} value={row[key]} onChange={(event) => setDrafts((current) => ({ ...current, [person.user_id]: { ...row, [key]: event.target.value } }))} className="form-control min-w-24"/></td>)}</tr>; })}</tbody></table></div>
      <label className="block max-w-md text-sm">Assinatura digital do RH<input required value={signature} onChange={(event) => setSignature(event.target.value)} className="form-control mt-1" maxLength={120}/></label>
      <Button type="submit" disabled={busy}><FileCheck2/>{busy ? "A preparar…" : "Criar folha assinada"}</Button>
    </form>}

    {canManagePayroll && <section className="space-y-4"><h3 className="font-semibold">Folhas preparadas</h3>{runs.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há folhas processadas.</p> : runs.map((run) => <article key={run.id} className="border-b border-border py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{monthNames[run.period_month - 1]} de {run.period_year}</p><p className="text-sm text-muted-foreground">Pagamento previsto: {run.scheduled_payment_date} · {statusName(run.status)}</p></div>{run.status === "draft" && <Button size="sm" disabled={busy} onClick={() => onSubmit(run)}>Enviar às Finanças</Button>}</div><PayrollTable items={runEmployees(run.id)}/></article>)}</section>}

    {financeRole && <section className="space-y-4"><div><h3 className="font-semibold">Folhas enviadas para pagamento</h3><p className="mt-1 text-sm text-muted-foreground">Anexe o comprovativo antes de confirmar o pagamento.</p></div>{runs.filter((run) => run.status === "sent_to_finance").length === 0 ? <p className="text-sm text-muted-foreground">Não há folhas pendentes de pagamento.</p> : runs.filter((run) => run.status === "sent_to_finance").map((run) => <article key={run.id} className="space-y-3 border-b border-border py-4"><p className="font-medium">{monthNames[run.period_month - 1]} de {run.period_year} · {money.format(runEmployees(run.id).reduce((total, item) => total + Number(item.net_pay), 0))}</p><PayrollTable items={runEmployees(run.id)}/><label className="block text-sm">Comprovativo de pagamento<input type="file" accept="image/*,application/pdf" onChange={(event) => setProofs((current) => ({ ...current, [run.id]: event.target.files?.[0] ?? null }))} className="form-control mt-1 pt-2"/></label><Button disabled={busy} size="sm" onClick={() => onPay(run)}><Banknote/>Confirmar pagamento</Button></article>)}</section>}

    {employeeRole && <section className="space-y-4"><div><h3 className="font-semibold">As suas folhas pagas</h3><p className="mt-1 text-sm text-muted-foreground">A confirmação fica registada antes de a folha ser descarregada.</p></div>{items.filter((item) => item.payment_status === "paid").length === 0 ? <p className="text-sm text-muted-foreground">Não há folhas pagas disponíveis.</p> : items.filter((item) => item.payment_status === "paid").map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"><div><p className="font-medium">{monthNames[item.period_month - 1]} de {item.period_year}</p><p className="mt-1 text-sm text-muted-foreground">Líquido: {money.format(Number(item.net_pay))} · INSS: {money.format(Number(item.employee_inss))} · Faltas: {money.format(Number(item.absence_deduction))}</p>{item.employee_confirmed_at && <p className="mt-1 text-xs text-muted-foreground">Recebimento confirmado em {new Date(item.employee_confirmed_at).toLocaleDateString("pt-MZ")} por {item.employee_signature}</p>}</div>{item.employee_confirmed_at ? <Button size="sm" variant="outline" onClick={() => onPrint(item)}><ReceiptText/>Descarregar folha</Button> : <Button size="sm" disabled={busy} onClick={() => onConfirm(item)}><BadgeCheck/>Confirmar recebimento</Button>}</article>)}</section>}
    <p className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><LockKeyhole size={14} className="mt-0.5 shrink-0"/>O IRPS, férias, horas extras e indemnizações continuam fora do cálculo até validação das regras aplicáveis.</p>
  </div>;
}

function PayrollTable({ items }: { items: PayrollItem[] }) {
  return <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground"><th className="p-2">Período</th><th className="p-2">Base</th><th className="p-2">Bónus</th><th className="p-2">INSS</th><th className="p-2">Faltas</th><th className="p-2">Líquido</th><th className="p-2">Assinatura RH</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-border/60"><td className="p-2">{monthNames[item.period_month - 1]} {item.period_year}</td><td className="p-2">{money.format(Number(item.base_salary))}</td><td className="p-2">{money.format(Number(item.bonus_amount) + Number(item.position_compensation))}</td><td className="p-2">{money.format(Number(item.employee_inss))}</td><td className="p-2">{money.format(Number(item.absence_deduction))}</td><td className="p-2 font-medium">{money.format(Number(item.net_pay))}</td><td className="p-2">{item.hr_signature ?? "—"}</td></tr>)}</tbody></table></div>;
}

function statusName(status: PayrollRun["status"]): string {
  return status === "draft" ? "Rascunho" : status === "sent_to_finance" ? "Aguardando pagamento" : "Pago";
}
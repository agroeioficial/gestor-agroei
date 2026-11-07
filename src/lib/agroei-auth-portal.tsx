import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Building2, Check, ChevronDown, CircleUserRound, FileText, KeyRound, Languages, LockKeyhole, LogOut, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "partner" | "manager" | "hr" | "finance" | "administrative" | "marketing" | "employee";
type Profile = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  marital_status: string | null;
  birth_date: string | null;
  document_type: string | null;
  document_number: string | null;
  document_issue_date: string | null;
  naturality: string | null;
  residence: string | null;
  phone: string | null;
  education: string | null;
  languages: string[];
};

type ProfileForm = {
  full_name: string;
  marital_status: string;
  birth_date: string;
  document_type: string;
  document_number: string;
  document_issue_date: string;
  naturality: string;
  residence: string;
  phone: string;
  education: string;
  languages: string;
};

const roleLabels: Record<AppRole, string> = {
  partner: "Sócio",
  manager: "Gerente",
  hr: "Recursos Humanos",
  finance: "Finanças",
  administrative: "Administrativo",
  marketing: "Marketing",
  employee: "Funcionário",
};

const emptyProfile: ProfileForm = {
  full_name: "",
  marital_status: "",
  birth_date: "",
  document_type: "",
  document_number: "",
  document_issue_date: "",
  naturality: "",
  residence: "",
  phone: "",
  education: "",
  languages: "",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Acesso e Perfil | Gestor AgroEI" },
      { name: "description", content: "Acesso seguro e perfil pessoal no sistema de gestão da AgroEI." },
      { property: "og:title", content: "Acesso e Perfil | Gestor AgroEI" },
      { property: "og:description", content: "Acesse o sistema de gestão da AgroEI com sua conta autorizada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgroEiAuthPortal,
});

export function AgroEiAuthPortal() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authForm, setAuthForm] = useState({ email: "", password: "", fullName: "" });
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "employee" as AppRole });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      setUser(authError ? null : data.user);
      setLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setProfile(null);
      setRoles([]);
      setProfileLoading(false);
      return () => { active = false; };
    }
    setProfileLoading(true);
    void Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]).then(([profileResult, roleResult]) => {
      if (!active) return;
      if (profileResult.error || roleResult.error) {
        setError("Não foi possível carregar o seu perfil. Tente novamente.");
      } else {
        const loadedProfile = profileResult.data as Profile | null;
        setProfile(loadedProfile);
        setProfileForm({
          full_name: loadedProfile?.full_name ?? "",
          marital_status: loadedProfile?.marital_status ?? "",
          birth_date: loadedProfile?.birth_date ?? "",
          document_type: loadedProfile?.document_type ?? "",
          document_number: loadedProfile?.document_number ?? "",
          document_issue_date: loadedProfile?.document_issue_date ?? "",
          naturality: loadedProfile?.naturality ?? "",
          residence: loadedProfile?.residence ?? "",
          phone: loadedProfile?.phone ?? "",
          education: loadedProfile?.education ?? "",
          languages: loadedProfile?.languages?.join(", ") ?? "",
        });
        setRoles((roleResult.data ?? []).map((row) => row.role as AppRole));
      }
      setProfileLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const isPartner = roles.includes("partner");
  const canInvite = isPartner || roles.includes("manager");

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (authMode === "sign-up") {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email: authForm.email.trim(),
          password: authForm.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: authForm.fullName.trim() },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Conta criada. Confirme o endereço de e-mail recebido para ativar o acesso.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: authForm.email.trim(),
          password: authForm.password,
        });
        if (signInError) throw signInError;
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.toLowerCase() : "";
      setError(message.includes("invitation")
        ? "Este endereço ainda não tem convite ativo da AgroEI. Peça autorização a um Sócio ou Gerente."
        : "Não foi possível concluir o acesso. Verifique o e-mail, a senha e a confirmação da conta.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    const { error: oauthError } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (oauthError) setError("Não foi possível entrar com Google. Tente novamente ou use e-mail e senha.");
    setBusy(false);
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    setNotice("");
    const languageList = profileForm.languages.split(",").map((item) => item.trim()).filter(Boolean);
    const { data, error: saveError } = await supabase.from("profiles").upsert({
      user_id: user.id,
      email: user.email ?? null,
      full_name: profileForm.full_name.trim(),
      marital_status: profileForm.marital_status || null,
      birth_date: profileForm.birth_date || null,
      document_type: profileForm.document_type || null,
      document_number: profileForm.document_number.trim() || null,
      document_issue_date: profileForm.document_issue_date || null,
      naturality: profileForm.naturality.trim() || null,
      residence: profileForm.residence.trim() || null,
      phone: profileForm.phone.trim() || null,
      education: profileForm.education.trim() || null,
      languages: languageList,
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (saveError) {
      setError("O perfil não foi guardado. Confirme os campos e tente novamente.");
    } else {
      setProfile(data as Profile);
      setNotice("Perfil guardado.");
    }
    setBusy(false);
  }

  async function createInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canInvite) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: inviteError } = await supabase.from("account_invitations").insert({
      email: inviteForm.email.trim().toLowerCase(),
      role: inviteForm.role,
      invited_by: user.id,
    });
    if (inviteError) {
      setError(inviteError.code === "23505"
        ? "Já existe um convite pendente para este e-mail."
        : "Não foi possível criar o convite. Verifique se tem autorização e tente novamente.");
    } else {
      setNotice(`Convite autorizado para ${inviteForm.email.trim()}. Envie-lhe o endereço desta página para concluir o cadastro.`);
      setInviteForm({ email: "", role: "employee" });
    }
    setBusy(false);
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setNotice("");
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-foreground"><p className="text-sm text-muted-foreground">A verificar o acesso…</p></div>;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex flex-col justify-between border-b border-border px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-12">
          <a className="inline-flex w-fit items-center gap-3" href="/" aria-label="Gestor AgroEI">
            <img src="/branding/icon-agroei.webp" alt="Logótipo AgroEI" className="h-11 w-11 rounded-md object-cover" />
            <span><strong className="block text-lg font-bold">AgroEI</strong><span className="text-xs text-muted-foreground">Gestão integrada</span></span>
          </a>
          <div className="max-w-lg py-10 lg:py-16">
            <span className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck size={17} /> Espaço reservado da empresa</span>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Gestor AgroEI</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">Acesso individual para a equipa, com dados pessoais e documentos protegidos.</p>
            <div className="mt-10 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
              <div className="flex items-start gap-3"><Building2 size={19} className="mt-0.5 text-primary"/><div><strong className="text-sm">Agropecuária e Empreendedorismo Inovadores</strong><p className="mt-1 text-xs text-muted-foreground">Ambiente de trabalho centralizado</p></div></div>
              <div className="flex items-start gap-3"><LockKeyhole size={19} className="mt-0.5 text-primary"/><div><strong className="text-sm">Acesso por autorização</strong><p className="mt-1 text-xs text-muted-foreground">O cargo não pode ser escolhido na tela</p></div></div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 AgroEI · Acesso reservado</p>
        </section>

        <section className="px-5 py-8 sm:px-10 lg:px-16 lg:py-12">
          {!user ? (
            <div className="mx-auto max-w-lg py-4 lg:py-12">
              <div className="mb-8">
                <p className="text-sm font-medium text-primary">Conta de acesso</p>
                <h2 className="mt-2 text-2xl font-semibold">{authMode === "sign-in" ? "Entrar no Gestor AgroEI" : "Criar conta autorizada"}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{authMode === "sign-in" ? "Use o e-mail confirmado para a sua conta." : "Novas contas só são aceites com convite ativo da empresa."}</p>
              </div>
              <form onSubmit={submitAuth} className="space-y-4">
                {authMode === "sign-up" && <Field label="Nome completo" icon={CircleUserRound}><input required autoComplete="name" value={authForm.fullName} onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })} className="form-control" /></Field>}
                <Field label="E-mail" icon={Mail}><input required type="email" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} className="form-control" /></Field>
                <Field label="Palavra-passe" icon={KeyRound}><input required type="password" minLength={8} autoComplete={authMode === "sign-in" ? "current-password" : "new-password"} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} className="form-control" /></Field>
                {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
                {notice && <p role="status" className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{notice}</p>}
                <Button type="submit" disabled={busy} className="w-full"><span>{busy ? "A processar…" : authMode === "sign-in" ? "Entrar" : "Criar conta"}</span><ArrowRight size={16}/></Button>
              </form>
              <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-border"/><span className="text-xs text-muted-foreground">ou</span><span className="h-px flex-1 bg-border"/></div>
              <Button type="button" variant="outline" disabled={busy} onClick={signInWithGoogle} className="w-full">Continuar com Google</Button>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {authMode === "sign-in" ? "Ainda não tem acesso?" : "Já tem uma conta?"}{" "}
                <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => { setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in"); setError(""); setNotice(""); }}>
                  {authMode === "sign-in" ? "Criar conta com convite" : "Voltar ao acesso"}
                </button>
              </p>
              <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole size={14} className="mt-0.5 shrink-0"/>A conta só recebe permissões depois da confirmação do e-mail e da autorização da AgroEI.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-7">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                <div><p className="text-sm font-medium text-primary">Conta verificada</p><h2 className="mt-1 text-2xl font-semibold">O seu perfil</h2><p className="mt-1 text-sm text-muted-foreground">{user.email}</p></div>
                <Button type="button" variant="outline" size="sm" onClick={signOut}><LogOut size={15}/> Sair</Button>
              </header>
              {roles.length > 0 ? <div className="flex flex-wrap gap-2">{roles.map((role) => <span key={role} className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-primary"><BadgeCheck size={15}/>{roleLabels[role]}</span>)}</div> : <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">O acesso está confirmado. A sua função será atribuída por um Sócio ou Gerente autorizado.</p>}
              {profileLoading ? <p className="text-sm text-muted-foreground">A carregar o perfil…</p> : <form onSubmit={saveProfile} className="space-y-5">
                <div className="flex items-center gap-2"><FileText size={17} className="text-primary"/><h3 className="font-semibold">Dados pessoais</h3></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileInput label="Nome completo" required value={profileForm.full_name} onChange={(value) => setProfileForm({ ...profileForm, full_name: value })}/>
                  <ProfileSelect label="Estado civil" value={profileForm.marital_status} onChange={(value) => setProfileForm({ ...profileForm, marital_status: value })} options={["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)"]}/>
                  <ProfileInput label="Data de nascimento" type="date" value={profileForm.birth_date} onChange={(value) => setProfileForm({ ...profileForm, birth_date: value })}/>
                  <ProfileSelect label="Tipo de documento" value={profileForm.document_type} onChange={(value) => setProfileForm({ ...profileForm, document_type: value })} options={["Bilhete de Identidade", "Passaporte", "DIRE", "Outro"]}/>
                  <ProfileInput label="Número do documento" value={profileForm.document_number} onChange={(value) => setProfileForm({ ...profileForm, document_number: value })}/>
                  <ProfileInput label="Data de emissão" type="date" value={profileForm.document_issue_date} onChange={(value) => setProfileForm({ ...profileForm, document_issue_date: value })}/>
                  <ProfileInput label="Naturalidade" value={profileForm.naturality} onChange={(value) => setProfileForm({ ...profileForm, naturality: value })}/>
                  <ProfileInput label="Residência" value={profileForm.residence} onChange={(value) => setProfileForm({ ...profileForm, residence: value })}/>
                  <ProfileInput label="Contacto telefónico" type="tel" value={profileForm.phone} onChange={(value) => setProfileForm({ ...profileForm, phone: value })}/>
                  <ProfileInput label="Formação" value={profileForm.education} onChange={(value) => setProfileForm({ ...profileForm, education: value })}/>
                  <div className="sm:col-span-2"><Field label="Línguas faladas" icon={Languages}><input value={profileForm.languages} onChange={(e) => setProfileForm({ ...profileForm, languages: e.target.value })} className="form-control" placeholder="Separadas por vírgula" /></Field></div>
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
                <Button type="submit" disabled={busy}><Check size={16}/>{busy ? "A guardar…" : "Guardar perfil"}</Button>
              </form>}
              {canInvite && <section className="border-t border-border pt-6">
                <div className="mb-4 flex items-center gap-2"><UserPlus size={17} className="text-primary"/><h3 className="font-semibold">Autorizar acesso à equipa</h3></div>
                <form onSubmit={createInvitation} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                  <input required type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="E-mail da pessoa" className="form-control" />
                  <label className="sr-only" htmlFor="invite-role">Função de acesso</label>
                  <div className="relative"><select id="invite-role" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as AppRole })} className="form-control appearance-none pr-8">{(Object.keys(roleLabels) as AppRole[]).filter((role) => isPartner || !["partner", "manager"].includes(role)).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-muted-foreground"/></div>
                  <Button type="submit" disabled={busy}><UserPlus size={15}/>Autorizar</Button>
                </form>
                <p className="mt-2 text-xs text-muted-foreground">O convite não envia e-mail automaticamente. Partilhe o endereço desta página com a pessoa autorizada.</p>
              </section>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Mail; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-2 text-sm font-medium"><Icon size={15} className="text-muted-foreground"/>{label}</span>{children}</label>;
}

function ProfileInput({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="form-control" /></label>;
}

function ProfileSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="form-control"><option value="">Seleccionar</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
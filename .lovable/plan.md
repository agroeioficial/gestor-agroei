# Gestor AgroEI — implementação faseada

## Resultado esperado
Transformar a interface demonstrativa num sistema operacional da AgroEI, com acesso individual por função, dados centralizados, workflows de gestão e trilha de auditoria. O trabalho será feito por etapas verificáveis; não serão usados dados fictícios como dados reais.

## Fases
1. **Base segura** — Ativar Lovable Cloud; implementar contas de acesso, perfis completos, papéis e permissões validados no servidor, armazenamento privado de documentos e auditoria. Separar cargos profissionais de papéis de acesso.
2. **Acesso e fluxos centrais** — Substituir o seletor de perfil demonstrativo por identidade autenticada. Criar painéis apropriados a sócios/gerência e a cada área; implementar tarefas, pedidos e aprovações com visibilidade e limitação conforme função.
3. **Sociedade, equipa e projetos** — Portais de sócios, quotas, entrada e transferência de participações, promoções, suspensões, desligamentos e projetos com propostas de aprovação e registo de decisão.
4. **RH e folha** — Cadastro e documentos privados, assiduidade e justificações, férias, processamento e envio selectivo de salários, confirmações de pagamento, recibos e acerto final.
5. **Finanças** — Orçamentos, movimentos categorizados, reservas, dívidas, comprovativos, pagamentos e indicadores financeiros com acesso restrito.
6. **Drive, Sheets e notificações** — Conectar Drive/Sheets da conta central AgroEI; organizar documentos e folhas por função e pessoa; sincronizar projectos e relatórios. Configurar notificações por e-mail depois de existir um domínio de envio da empresa.
7. **Relatórios e validação** — Resumo executivo por permissão, dashboards, testes de regras e verificação de fluxos completos e privacidade.

## Regras já confirmadas
- Perfis completos de usuário; cargos listados pela AgroEI; papéis/permissões devem ser verificáveis de forma segura, nunca selecionáveis como identidade pelo próprio usuário.
- Drive e Sheets: conta central da empresa, não contas individuais.
- INSS do funcionário: 3% do salário-base; contribuição patronal: 4%; total 7%.
- Férias pela Lei moçambicana n.º 13/2023: 12 dias no primeiro ano de trabalho efectivo e 30 dias nos anos seguintes.
- Calendário indicado: fechar a efectividade no dia 10, enviar salários às finanças até ao dia 15 e pagar no dia 20; antecipar pagamentos que cairiam no sábado para a sexta-feira anterior e adiar pagamentos de domingo para o primeiro dia laboral seguinte, sujeito a revisão de conformidade antes de activar pagamentos.
- Acesso a folhas e documentos será restrito por permissões individuais no Drive e na aplicação. O Google Sheets não oferece bloqueio do ficheiro por uma senha partilhada; não gravar a senha em código nem usá-la como controlo de acesso.
- Indemnização: tratar cada caso por iniciativa, motivo e tipo de contrato, com aprovação/revisão jurídica onde a lei ou o enquadramento forem ambíguos.
- Casos cobertos para cálculo: Lei 13/2023, art. 141, n.º 3, rescisão pelo empregador por motivos estruturais/tecnológicos/de mercado (30/15/5 dias por ano de acordo com o salário face ao mínimo sectorial); art. 139, n.os 1–3, rescisão com justa causa pelo trabalhador (45 dias por ano no contrato indeterminado e remunerações até ao termo no prazo certo); art. 142, n.º 4, cessação antecipada de contrato a prazo pelo procedimento do empregador (remunerações até ao termo). Exigir tipo de contrato, motivo, datas, salário e mínimo sectorial legalmente confirmado; quando faltar dado ou existir ambiguidade/remissão legal, encaminhar para revisão humana e não estimar automaticamente.
- Sem e-mail de lembrete após cinco horas.
- E-mails enviados pelo aplicativo dependem de domínio real da empresa; nenhum domínio está configurado.

## Pendências antes dos cálculos/fluxos afetados
- Tabela oficial e actualizada de IRPS por escalão e dependentes; até validação, coletar dependentes mas não calcular/retirar IRPS automaticamente.
- Identificação de sector/subsector e salário mínimo oficial aplicável na data de cessação; dados contratuais e procedimentais necessários para cada indemnização.
- Detalhes ainda não confirmados: tabela oficial e actualizada de IRPS; enquadramento sectorial e mínimo salarial oficial de cada trabalhador; tratamento de faltas após 48 horas; regras societárias e de veto no contrato; fórmula de reservas/dividendos e calendário do exercício; campos definitivos para perfil e documentos.
- Uma pessoa jurídica deve validar os cálculos de indemnização antes de automatizar pagamentos. A Lei 13/2023 distingue várias situações; não assumir uma fórmula única.

## Fora da primeira entrega
Não migrar ou reutilizar localStorage como fonte oficial; não enviar senhas por e-mail; não tratar um selector de função como segurança; não calcular IRPS sem tabela validada; não expor capital, salários ou arquivos privados a usuários não autorizados. Não configurar as integrações de e-mail sem domínio verificado.

## Detalhes técnicos
- Aplicação TanStack Start existente; frontend por área, funções de servidor para lógica sensível.
- Lovable Cloud para persistência/autenticação; RLS e permissões no servidor; papéis em tabela separada de perfis.
- Armazenamento privado e autorização por usuário/área; contas App User Connectors só seriam adequadas se cada pessoa usasse o Drive dela, cenário rejeitado em favor da conta central.
- Google Drive/Sheets usarão conexão da conta corporativa central, vinculada ao projeto por Connector, nunca as contas pessoais dos usuários.
- INSS: valores concretos de cálculo serão testados; fórmulas legais e acessos sensíveis terão testes junto das regras implementadas.
- Google Sheets não suporta proteger a folha com uma senha única de ficheiro; a alternativa será autorização por usuário no Drive e na aplicação, sem partilhar a folha de salários para além dos destinatários autorizados.

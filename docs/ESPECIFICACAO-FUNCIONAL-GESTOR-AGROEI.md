# Especificação funcional — Gestor AgroEI

**Repositório:** agroeioficial/gestor-agroei  
**Estado:** requisitos consolidados; implementação funcional por fases  
**Moeda:** MZN (metical)  
**Idioma:** Português  
**Conta documental prevista:** agroeioficial@gmail.com

> Este documento consolida as instruções fornecidas pela AgroEI. Não significa que as integrações, cálculos legais ou fluxos descritos já estejam implementados. A aplicação actual é um protótipo de interface com dados em localStorage; não deve receber dados pessoais, salariais ou financeiros reais até existir backend, autenticação e controlo de acesso no servidor.

## 1. Princípios de arquitectura

1. Uma base de dados central é a fonte oficial dos dados. Google Drive e Google Sheets são repositórios/documentos e integrações, não substitutos da base de dados.
2. As permissões são verificadas no servidor em cada leitura e escrita. Ocultar botões ou páginas no frontend não é segurança.
3. Separar **perfil de acesso**, **cargo**, **área**, **responsabilidades** e **alçadas de aprovação**.
4. Todas as operações sensíveis mantêm trilho de auditoria: autor, data/hora, valor anterior, valor novo, motivo, aprovador e comprovativo.
5. Registos financeiros não são apagados fisicamente: correcções são feitas por estorno/arquivamento, com motivo obrigatório e histórico.
6. Valores monetários são armazenados como números decimais exactos (não ponto flutuante binário) e apresentados em MZN, com símbolo menor que o número.
7. Datas operacionais usam o fuso Africa/Maputo.
8. Nenhum salário, INSS, férias, retenção salarial, assinatura, transmissão de quotas ou deliberação societária será considerado juridicamente validado sem revisão profissional e parametrização legal.
9. Não enviar palavras-passe por e-mail. Enviar convite/ligação segura para definição inicial e recuperação de credenciais.
10. A regra de lembrete automático após cinco horas foi expressamente retirada e não deve ser implementada.

## 2. Perfis, cargos e áreas

### 2.1 Perfis de acesso iniciais
- Sócio
- Gerente
- RH
- Administrativo
- Gestor de Marketing Digital
- Funcionário

Os perfis são modelos de permissões, não cargos. As permissões podem ser complementadas por atribuições específicas.

### 2.2 Cargos iniciais
- Gerente e CEO
- Director de RH
- Director Administrativo e Financeiro
- Director Comercial e de Marketing Geral
- Director Geral
- Secretário Executivo
- Gestor de Projectos
- Director de Empreendedorismo
- Director de Agropecuária
- Director Técnico
- Outros cargos configuráveis

### 2.3 Áreas
- Agropecuária
- Empreendedorismo
- Comercial e Marketing
- Recursos Humanos
- Administração e Finanças
- Projectos
- Direcção Geral

Um sócio pode acumular um cargo operacional. O sistema mantém os direitos de sócio e, separadamente, as permissões operacionais do cargo que exerce.

## 3. Navegação e módulos

1. Painel personalizado
2. Portal do Sócio
3. Gerência
4. Recursos Humanos
5. Comercial e Marketing
6. Finanças
7. Projectos
8. Resumo Executivo
9. Portal do Funcionário
10. Gestão de Tarefas
11. Aprovações e notificações
12. Documentos e integrações (Drive/Sheets)

## 4. Painéis por perfil

### 4.1 Sócios
Painel global com:
- Lucro distribuível, em destaque e verde se positivo/vermelho se negativo.
- Lucro bruto, lucro líquido, faturamento, saídas, orçamento anual, orçamento gasto e saldo orçamental.
- Saldo orçamental verde quando confortável, amarelo quando <=20% do orçamento inicial e vermelho quando <=10% (vermelho tem prioridade).
- Entradas, saídas e faturamento por projecto.
- Comparação de rendimentos entre projectos.
- Capital social e notificações de matérias pendentes de aprovação.
- Tarefas atribuídas/gerais.

### 4.2 Gerente
Painel visualmente equivalente ao dos sócios, mas com dados e operações limitados à sua alçada. A semelhança visual não concede acesso aos dados reservados aos sócios.

### 4.3 Outros utilizadores
Painel específico da área/cargo, mostrando apenas indicadores permitidos, tarefas, pedidos, notificações, contactos institucionais e o próprio cargo.

## 5. Governação societária e alçadas

### 5.1 Regras de deliberação configuráveis
O motor de aprovação deverá suportar:
- Aprovação do Gerente dentro da sua alçada;
- Aprovação por percentagem de representação do capital social (incluindo 70%);
- Unanimidade;
- Veto de sócio fundador para matérias expressamente configuradas;
- Aprovação simples ou sequência de aprovações.

Matérias indicadas para limiar de 70% do capital social:
a) empréstimos extraordinários; b) garantias a terceiros; c) despesas não orçamentadas; d) projectos com risco relevante; e) abertura/encerramento de estabelecimentos; f) distribuição de lucros; g) alienação de bens essenciais; h) divisão de quotas; i) entrada de novo investidor; j) meio tecnológico para assembleias; k) afectação de reservas; l) destituição sem justa causa; m) uso de reserva de reinvestimento fora do orçamento anual.

A regra concreta deve ser validada face ao contrato de sociedade e ao Código Comercial aplicável. O sistema não deve permitir que o proponente escolha livremente uma alçada inferior à exigida: a matéria, valor, contexto e regras societárias determinam o fluxo.

### 5.2 Portal do Sócio
Cada sócio consulta os seus ganhos, bónus, remuneração quando aplicável, investimentos, quota, dividendos e histórico de alterações societárias. Informações gerais de sócios ficam reservadas aos sócios.

### 5.3 Entrada e transmissão de quotas
Apenas sócio autorizado inicia o processo de admissão. Formulário: nome completo, estado civil, nascimento se exigido, tipo/número de documento, emissão, naturalidade, residência, valor/tipo de entrada, data, indicador de fundador e modalidade (aumento de capital ou transmissão de quota existente).
- Aumento de capital: calcular participação com base na estrutura de capital aprovada após a operação.
- Transmissão: seleccionar sócio cedente, percentagem, preço e condições; calcular redução da quota do cedente e atribuição ao adquirente.
- Guardar histórico de entradas, aumentos, divisões, cessões e datas.
- Exigir consentimentos, preferência, formalização e registos que forem legalmente aplicáveis.

### 5.4 Promoções, contratação, suspensão e exoneração
Sócios e Gerente podem propor promoções para cargos. O sistema verifica se a matéria exige aprovação.
- Promoção: cargo, área, remuneração fixa ou percentagem, data de início e condições.
- Contratação pelo Gerente: sem aprovação societária adicional apenas quando prevista no plano e orçamento aprovados e dentro da alçada.
- Suspensão: período, fundamento, funcionalidades temporariamente disponíveis; preservar acesso mínimo a pedidos/reclamações conforme política.
- Bónus: valor ou percentagem, base de cálculo (salário ou lucro líquido de projecto), período e aprovação.
- Exoneração: com/sem justa causa; fundamento obrigatório quando aplicável.
- “Expulsão” não apaga a pessoa nem o histórico: encerra ou suspende vínculo e revoga acessos de acordo com o procedimento aplicável.

### 5.5 Bónus por projecto apresentado
Projecto apresentado por sócio ou Gerente, aprovado e elegível:
- 10% do lucro líquido do projecto quando elaborado sem recursos da empresa;
- 8% quando utiliza recursos da empresa;
- duração máxima de um ano.
Guardar autor(es), critério, aprovação, período e cálculo sobre lucro efectivamente apurado. A regra de partilha entre co-autores e a definição de recursos utilizados carecem de política aprovada.

### 5.6 Projecto de negócio
Campos: nome, objecto, descrição, orçamento, lucro bruto previsto, lucro líquido previsto, início/período de implementação, duração determinada ou indeterminada. Projectos só passam a activos após as aprovações exigidas.

## 6. Recursos Humanos

### 6.1 Cadastro e arquivo
Dados de identificação: nome completo, estado civil, data de nascimento, tipo/número de documento, emissão, naturalidade e residência. Anexos: identificação, CV, candidatura e documentos adicionais. Criar perfil do funcionário e pasta privada individual.

### 6.2 Efetividade e calendário salarial
- Fecho da efectividade: dia 10 de cada mês.
- RH submete salários às Finanças até dia 15.
- Pagamento previsto: dia 20.
- Se dia 20 for sábado, antecipar para sexta-feira; se domingo, pagar no primeiro dia útil seguinte.
- Falta antes do fecho afecta o ciclo corrente; falta depois do fecho transita para o ciclo seguinte.
- Falta injustificada: fluxo de justificação de 48 horas a partir da notificação, com anexo PDF/fotografia; director hierárquico decide a justificação.
- O botão de justificação só aparece após RH submeter a ocorrência ao funcionário.

### 6.3 Remuneração
Folha discriminada:
- Salário-base;
- Bónus;
- Horas extras;
- Bónus de turno;
- Remuneração por cargo;
- INSS e demais descontos legalmente aplicáveis;
- Faltas injustificadas;
- Total líquido.

A referência interna indicada é 30 dias por mês: valor diário = salário-base / 30; desconto = valor diário × dias descontáveis. A fórmula, limites e incidências devem ser validados com legislação laboral/fiscal e convenções aplicáveis antes de produção. Horas extras requerem quantidade, período, aprovação e regra de cálculo parametrizada; não assumir automaticamente que 100% é a taxa legal.

### 6.4 Bónus e sindicatos
RH regista bónus e respectivas bases. RH/Director podem propor sindicatos com nome, contribuição, benefícios e critérios; Gerente aprova criação. Funcionário solicita adesão/saída no perfil; RH aprova; saída exige motivo.

### 6.5 Férias
Regra interna fornecida: 15 dias no primeiro ano, 24 no segundo, 30 do terceiro em diante, acumulados mensalmente a partir do mês/data de admissão. Parametrizar por ano de serviço e validar com legislação laboral e contrato.

### 6.6 Documentos expirados
Avisar por e-mail 10 dias antes e no dia do vencimento. A instrução de reter salário até regularização requer revisão jurídica prévia; por segurança, o sistema deve sinalizar documento expirado e encaminhar para RH, sem bloquear automaticamente salário devido até existir validação legal documentada.

### 6.7 Folha salarial e confirmação
RH prepara, assina e encaminha a folha; funcionário confirma recebimento e assina com data/hora; só depois fica disponível para download individual. Arquivo PDF não editável, acesso privado por funcionário, pesquisa por mês/ano. Não usar senha partilhada simples como única protecção. A assinatura deve ter evidência de identidade, consentimento, data/hora e trilho de auditoria.

### 6.8 Avaliação e indicadores
Classificação 0–10: 0–4 desempenho baixo; 5–8 satisfatório; 9–10 excelente. Mostrar no painel individual. RH consulta totais de funcionários, distribuição por género, activos, férias e suspensos, com acesso restrito.

## 7. Finanças

### 7.1 Orçamentos, despesas e pedidos
Receber, analisar, aprovar/reprovar pedidos de orçamento; registar despesas fixas/variáveis; analisar pedidos financeiros de outras áreas; solicitar/sugerir fundos; emitir avisos e tarefas. Pagamentos integrais/parciais exigem motivo quando parciais e comprovativo. Recusa por indisponibilidade exige motivo.

### 7.2 Execução orçamental
Cada pagamento reduz a rubrica correspondente (salários, transporte, materiais, marketing etc.). Impedir pagamentos acima do saldo disponível sem alçada excepcional aprovada. Todas as entradas/saídas exigem origem, categoria, data, responsável e comprovativo quando aplicável.

### 7.3 Reservas
Criadores: sócios e Gerente; Director Administrativo não sócio propõe e sócios aprovam. Campos: nome, finalidade, percentagem, tipo recorrente/não recorrente/semirrecorrente, meta quando aplicável, data de criação, saldo, reforços e utilizações.
- Recorrente: reforço em cada ano financeiro.
- Não recorrente: reforçar até atingir meta; parar ao atingir.
- Semirrecorrente: atingir meta; após utilização pode ser reposta; se não usada no novo ano, não reforçar.
Sócios aprovam toda criação e definem quais reservas cada director pode ver. O ano financeiro é definido pelos sócios. Base de cálculo indicada: faturamento total do ano, acumulado mensalmente. Separar contabilisticamente constituição, reforço, utilização e saldo da reserva.

### 7.4 Resultados e relatórios
Mostrar ganhos/perdas gerais e por projecto em períodos diário, mensal e anual; faturamento diário/mensal/anual; saldo por reserva e total de reservas. Lucro distribuível só após despesas, salários, reservas e demais obrigações consideradas, segundo política contabilística aprovada.

### 7.5 Dívidas
Dois registos: (1) credores a quem a empresa deve; (2) devedores que devem à empresa. Campos: contraparte, valor, data, prazo, previsão, finalidade, comprovativos e pagamentos. Permitir liquidação parcial/total, manter saldo e arquivar como paga quando liquidada. Dívidas em bens: item, quantidade, preço unitário, total por item e total agrupado. Empréstimos recebidos aumentam saldo de caixa/banco e simultaneamente passivo de dívida; não classificar como receita operacional.

### 7.6 Correcções
Editar/eliminar visualmente exige motivo e registo de auditoria. Operações financeiras devem ser estornadas ou arquivadas, nunca apagadas sem rasto.

## 8. Projectos
Cada projecto tem ficha, área, responsáveis, orçamento, investimento, gastos, faturamento, lucro, estado, datas, equipa e histórico. Permitir submissão, análise, aprovação/reprovação, activação/desactivação e consulta de activos. Projectos podem ligar uma planilha de origem para sincronizar apenas faturamento total, saídas totais e lucro, com botão de sincronização manual e prevenção de duplicados.

## 9. Tarefas
Campos: título, área, responsável/destinatário, data de criação, prazo, prioridade, estado e histórico. Marcar concluída, editar, adiar ou cancelar com motivo. Prazos próximos ficam destacados a vermelho. Visibilidade: geral, área ou utilizador específico. Chefias podem criar tarefas para colaboradores e homólogos conforme hierarquia.

## 10. Resumo Executivo
Dashboards e gráficos comparativos mensais/anuais, receitas, despesas, lucros, reservas e desempenho de projectos. Sócios vêem o consolidado; directores vêem a sua área e indicadores autorizados.

## 11. Google Drive e Google Sheets

Conta central prevista: agroeioficial@gmail.com. Estrutura por áreas, comprovativos, relatórios, projectos e pastas privadas individuais. Cada funcionário terá pasta de documentos e subpasta de folhas salariais, inacessíveis a outros funcionários. Criar/actualizar Perfil do Funcionário com dados, formação, línguas e avaliação.

Sheets:
- Planilha geral por ano financeiro e relatórios por área.
- Título “Gestor AgroEI”; subtítulo “Relatório da Área X”.
- Tabelas com cabeçalhos coloridos por área, fonte profissional, tamanho 12, quebra de texto e espaçamento.
- Separação mensal, total mensal e acumulado anual.
- Novo ciclo anual cria estrutura limpa e transporta apenas saldos, tarefas adiadas/não concluídas, dívidas pendentes, reservas, projectos e resultados aprovados.
- Projecto pode ligar uma planilha; importar apenas os campos explicitamente mapeados (faturamento, saídas, lucro) e período. Botão de sincronização manual e registo da última sincronização.

A ligação ao Drive/Sheets exige OAuth/connector autorizado e permissões por pasta/ficheiro. Não expor credenciais no frontend nem usar a conta central sem autorização explícita do titular.

## 12. Notificações por e-mail
- Sócios recebem aviso automático quando uma proposta aguarda a sua aprovação.
- Funcionário recebe e-mail formal de cadastro com convite seguro para definir palavra-passe (não enviar a palavra-passe em texto).
- Modelos personalizados por tipo de evento: submissão, aprovação, reprovação, cadastro, falta, vencimento de documento, folha salarial e pagamento.
- Não implementar lembrete após cinco horas (regra retirada).

## 13. Contactos e transparência
Em todos os painéis de funcionários, apresentar contacto institucional (e-mail) do Gerente, RH e Director Administrativo, conforme configuração aprovada. Cada utilizador vê o próprio cargo.

## 14. Pontos que exigem decisão/validação antes de produção
1. Regra exacta de aprovação de promoção quando há mais de um sócio.
2. Matérias sujeitas a unanimidade e matérias sujeitas a veto fundador, conforme contrato.
3. Compatibilidade entre limiar de 70%, quórum de presença e veto fundador.
4. Partilha do bónus de 8%/10% entre co-autores.
5. Definição formal de “recursos da empresa” no cálculo do bónus.
6. Taxas/limites legais de INSS, horas extras, férias, faltas e demais descontos.
7. Legalidade e procedimento para salário de trabalhador com documento expirado.
8. Ano financeiro/lectivo e regra de transição entre ciclos.
9. Fórmula de cálculo do lucro distribuível e ordem de reservas/obrigações.
10. Integrações e permissões efectivas de Google Drive, Sheets e e-mail.

## 15. Plano de implementação recomendado

### Fase 1 — Fundamentos
- Backend e base de dados central;
- Autenticação e recuperação segura;
- Perfis, cargos, áreas e permissões por servidor;
- Auditoria e anexos privados;
- Configuração de empresa, moeda, fuso e ano financeiro.

### Fase 2 — Fluxos essenciais
- Painéis por perfil;
- Tarefas e aprovações;
- Projectos e orçamentos;
- Movimentos financeiros, comprovativos, reservas e dívidas.

### Fase 3 — RH e salários
- Cadastro, documentos, faltas, férias, sindicatos;
- Processamento salarial parametrizado e validado;
- Aprovação, pagamento, assinaturas e folhas individuais.

### Fase 4 — Governação societária
- Sócios, quotas, deliberações, limiares, veto e histórico.

### Fase 5 — Integrações e relatórios
- Google Drive/Sheets;
- E-mails;
- Sincronização de projectos;
- Relatórios anuais e dashboards.

### Fase 6 — Validação e produção
- Testes de permissões e isolamento de dados;
- Testes de cálculos;
- Testes de auditoria, cópias de segurança e recuperação;
- Revisão jurídica/contabilística;
- Testes de aceitação com utilizadores reais.

## 16. Critérios mínimos de aceitação
- Um funcionário não consegue consultar dados de outro funcionário, mesmo manipulando URL/API.
- Um director não consegue obter dados reservados aos sócios via API.
- O Gerente só aprova matérias dentro da alçada configurada.
- Votações calculam percentagem sobre capital social e respeitam regras aplicáveis.
- Nenhum pagamento sem autorização, orçamento ou excepção aprovada e comprovativo.
- Nenhuma edição/remoção financeira sem motivo e auditoria.
- Cálculos salariais e de férias cobertos por testes e parâmetros validados.
- Folha salarial privada e acessível apenas ao funcionário correspondente e RH/autoridades autorizadas.
- Sincronização Sheets idempotente, mapeada e auditável.
- E-mails não contêm palavras-passe em texto.

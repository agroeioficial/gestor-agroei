# Folha salarial: Sheets, PDF e validação

## Resultado
Sincronizar os dados oficiais da folha salarial com o Google Sheets central, disponibilizar um PDF individual após pagamento e confirmação do funcionário e validar o fluxo por função sem expor dados entre contas.

## Implementação
1. Criar uma planilha exclusiva para folhas salariais, com separação por período e campos de salário, descontos, datas e assinaturas disponíveis no sistema.
2. Adicionar sincronização idempotente no servidor, protegida por sessão e permissões de RH/Finanças; manter as credenciais fora do navegador e apresentar um resultado claro quando a sincronização falhar.
3. Gerar o PDF individual apenas para o funcionário autenticado, depois da confirmação de recebimento, incluindo a marca AgroEI e os dados/assinaturas existentes.
4. Acrescentar testes para a sincronização e a folha; testar a composição do PDF com dados fictícios e revisar visualmente todas as páginas.
5. Executar a validação ponta a ponta com contas reais de RH, Finanças e Funcionário quando existirem; até lá, validar os testes automatizados sem criar contas ou dados salariais fictícios na base real.

## Fora do escopo
Não calcular IRPS nem indemnizações. Não inventar contas, salários, dados pessoais ou regras legais pendentes.

## Detalhes técnicos
- Usar funções de servidor autenticadas e a conexão central já ligada ao Sheets; aplicar acesso de menor privilégio e não chamar o gateway no navegador.
- Usar a persistência salarial existente, sem duplicar salários como outra fonte de verdade.
- A confirmação atual é registada por nome digitado e data; o PDF reproduzirá essa assinatura textual até existir um método de assinatura gráfica aprovado.
- A validação real aguarda as contas e papéis de RH, Finanças e Funcionário, ainda ausentes.
# Gestor AgroEI

Aplicação de gestão integrada para a Agropecuária e Empreendedorismo Inovadores, estruturada a partir do Manual Mestre.

## Primeira versão funcional
- Painel com indicadores, tarefas, aprovações e gráficos.
- Áreas de Finanças, Projectos, Recursos Humanos, Tarefas, Aprovações e Resumo Executivo.
- Vistas por perfil: Sócio, Gerente, RH, Administrativo, Marketing e Funcionário.
- Registo local de tarefas, projectos, movimentos financeiros, colaboradores e pedidos.
- Interface responsiva e base de instalação PWA em Android, tablet e desktop.

## Executar
```bash
bun install
bun run dev
```

## Importante — estado e segurança
Esta entrega é a primeira versão de interface e fluxo operacional. Os registos são guardados no armazenamento local do navegador (localStorage), não numa base de dados central. Os perfis servem para demonstração visual e ainda não constituem autenticação nem controlo de acesso seguro. Não inserir dados pessoais, documentos, salários ou informação financeira real até serem implementados e testados o backend, autenticação, permissões por função, auditoria e armazenamento privado.

As integrações do Manual Mestre com Google Drive/Sheets, e-mail, processamento legal de salários, INSS, comprovativos, assinaturas digitais, reservas e regras societárias exigem configuração de serviços e validação antes de produção.

Fonte funcional: Manual Mestre.pdf fornecido pela AgroEI.

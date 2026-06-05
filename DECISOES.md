# 📋 Decisões e Alinhamentos do Projeto

> Registre aqui tudo que for decidido nas sessões de trabalho com o AIOX.
> Assim, mesmo que o chat feche, o contexto fica salvo.

---

## 🗂️ Informações Gerais do Projeto

- **Nome do projeto:** Plataforma de Comissões — Martins BPO Financeiro
- **Repositório GitHub:** https://github.com/martinsbpo/plataforma-comissoes
- **Pasta local:** `C:\Projetos\plataforma-comissoes`
- **Supabase:** https://uruwruczmeharxnlitcc.supabase.co
- **Deploy (Vercel):** https://plataforma-comissoes.vercel.app
- **Início do projeto:** 2026-05-22

---

## ✅ Decisões Técnicas

| Data | Decisão | Motivo |
|------|----------|--------|
| 2026-05-22 | Stack: Next.js 16 + TypeScript + shadcn/ui + Tailwind + Supabase + Vercel | Velocidade de desenvolvimento, integração nativa |
| 2026-05-22 | Login via SSO Microsoft (Azure) | Usuários já usam Microsoft 365 |
| 2026-05-22 | Multi-tenant com tabela `tenants` + `user_tenant_links` | Suportar múltiplas corretoras com um único banco |
| 2026-05-22 | RLS habilitado em todas as tabelas | Isolamento de dados por tenant na camada do banco |
| 2026-05-22 | Chave de vinculação: `seguradora_id + referencia` (campos separados, não concatenados) | Evitar colisões e facilitar filtros individuais |
| 2026-05-22 | Repositório GitHub público temporariamente | Contornar limitação do Vercel Hobby com orgs privadas — tornar privado antes de dados reais |
| 2026-05-22 | Dois projetos Supabase (dev + prod): **adiado** | Fase 1 usa único projeto com dados de teste; separar só quando houver dados reais de clientes — gatilho: E1.S5 ou primeiro cliente real |
| 2026-05-22 | Upgrade Supabase Pro (backup): **adiado** | Plano gratuito suficiente sem dados de produção reais; fazer upgrade antes de cadastrar primeiros clientes |
| 2026-05-22 | Seletor de corretora pós-login: implementado na E1.S4 | Parceiro com múltiplos tenants vê seletor após login; sessão isolada por cookie `tenant_id` (8h) |
| 2026-05-22 | Sempre ler o arquivo existente antes de qualquer story | Evitar sobrescrever trabalho já feito |

---

## 📌 Regras de Negócio Definidas

| Data | Regra | Observação |
|------|-------|------------|
| 2026-05-22 | Exportação respeita filtros ativos | O que se vê na tela é o que se exporta |
| 2026-05-22 | Filtros da tela de fechamento: intervalo de meses, seguradora, parceiro, segurado (nome/CPF), status vinculação | Definido na E4 |

---

## 🔄 Status das Etapas

| Etapa | Status | Observação |
|-------|--------|------------|
| E1.S1 — Setup repositório | ✅ Concluído | GitHub, Vercel, Supabase, Next.js |
| E1.S2 — Autenticação SSO Microsoft | ✅ Concluído | Login com @martinsbpo.com.br funcionando |
| E1.S3 — Multi-tenant estrutura de dados | ✅ Concluído | Migration aplicada, tabelas criadas, seed inserido |
| E1.S4 — Perfis e Permissões | ✅ Concluído | Middleware, matriz de permissões, seletor de corretora, tela de usuários |
| E1.S5 — Layout Base da Interface | ✅ Concluído | Sidebar, header, dashboard, componentes reutilizáveis, tema de cores, deploy em produção |
| E2.S1 — Cadastro de Corretoras | ✅ Concluído | Listagem, cadastro, edição, upload de logo, white-label, dados bancários, migration 003 |
| E2.S2 — Cadastro de Seguradoras | ✅ Concluído | Listagem, cadastro, edição, regras de retenção por regime, migration 004 |
| E2.S4 — Grupos, Produtos e De-Para | ✅ Concluído | Abas Grupos/Produtos/De-Para em /admin/produtos, seed de partida, migration 005 |
| E2.S5 — Cadastro de Parceiros | ✅ Concluído | Listagem, cadastro, edição, dados bancários, percentuais sugeridos, migration 006 |
| E2.S6 — Alíquotas Mensais | ✅ Concluído | Registro por corretora/competência, preview de cálculo, histórico, migration 007 |
| E2.S3 — Layouts de Importação | ✅ Concluído | Migration 008, /admin/layouts, form com mapeamento de colunas |
| E3 — Engine de Importação | ✅ Concluído | Parser TXT/CSV/XLSX/PDF, Route Handler /api/importacoes/processar, de-para automático |
| E3 — Tela de Importação | ✅ Concluído | /seguradoras (upload + histórico), /seguradoras/[id] (detalhe + resolução + confirmação) |
| E4 | ⏳ Em andamento | Stories aprovadas, aguardando implementação |

> Status sugeridos: ⏳ Em andamento · ✅ Concluído · ⚠️ Pendente revisão

---

## 💬 Alinhamentos Informais (chat)

> Cole aqui trechos importantes de conversas que não viraram documento formal.

### [Data] — Assunto
- Ponto alinhado:
- Ponto alinhado:

---

## ⚠️ Pontos em Aberto

- [ ] **GitHub público → privado:** fazer antes de cadastrar qualquer dado real de cliente (ou migrar para Vercel Pro para liberar orgs privadas no Hobby)
- [ ] **Supabase Pro (backup):** ativar antes do primeiro cliente real
- [ ] **Segundo projeto Supabase (dev):** criar quando houver necessidade de separar ambientes — gatilho: E1.S5 ou primeiro cliente

---

## 📝 Histórico de Sessões

| Data | O que foi feito | Arquivo gerado |
|------|-----------------|----------------|
| 2026-05-22 | Setup do projeto, deploy Vercel, SSO Microsoft | — |
| 2026-05-22 | Migration multi-tenant aplicada no Supabase | `supabase/migrations/001_multi_tenant_base.sql` |
| 2026-05-22 | E1.S4 — Perfis e permissões implementados | `middleware.ts`, `lib/permissions.ts`, `lib/auth.ts`, `supabase/migrations/002_permissions.sql` |
| 2026-05-22 | E1.S5 — Layout base implementado e deployado | `components/layout/`, `lib/nav.ts`, `components/ui/data-table.tsx` |
| 2026-06-04 | E2.S1 — Cadastro de Corretoras implementado | `app/admin/corretoras/`, `supabase/migrations/003_corretoras.sql` |
| 2026-06-04 | E2.S2 — Cadastro de Seguradoras implementado | `app/admin/seguradoras/`, `supabase/migrations/004_seguradoras.sql` |

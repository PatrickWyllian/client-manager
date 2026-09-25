# Agent Guidelines for Client Manager CRM

## Essential Commands
- **Install dependencies**: `npm install`
- **Start development server**: `npm start` or `npm run dev`
- **Application runs on**: http://localhost:3400 (or PORT from .env)
- **Build Docker image**: `docker build -t client-manager .`

## Project Structure
- **Entrypoint**: `server.js` (Express + Socket.io server)
- **Frontend**: `public/` (HTML/CSS/JS - no framework, vanilla JS)
- **Backend services**: `services/` (WhatsApp, message queue, scheduler)
- **API routes**: `routes/` (REST endpoints)
- **Database**: SQLite in `data/iptv-crm.db`
- **WhatsApp session**: `data/wa-auth/` (Baileys authentication state)

## Key Technical Details
- **WhatsApp integration**: Uses `@whiskeysockets/baileys` v6.7.9` with QR code generation
- **Real-time communication**: Socket.io for WhatsApp status updates
- **Authentication**: JWT-based with `/api/auth` routes
- **Database**: SQLite with schema in `db/schema.sql`
- **Environment variables**: 
  - `PORT` (default: 3400)
  - `HOST` (default: 0.0.0.0)
  - `CORS_ORIGIN` (MUST match production domain)
  - `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASS`

## Common Issues & Fixes
**QR Code Not Appearing in Production**: 
- CORS misconfiguration - ensure `CORS_ORIGIN` in `.env` matches your domain
- Socket.IO needs explicit CORS config: `new Server(server, { cors: { origin: process.env.CORS_ORIGIN } })`

## Development Notes
- Frontend uses vanilla JS with ES6 modules (no build step)
- All API calls are prefixed with `/api`
- Static files served from `public/` directory
- Socket.IO events: `wa:status` for WhatsApp connection status
- Baileys stores session data in `data/wa-auth/` - DO NOT commit this directory

## Database
- SQLite file: `data/iptv-crm.db`
- Schema: `db/schema.sql`
- Seed data: `db/seed.js`
- Migrations: `db/migrations.js`

<!-- specsfy:framework:start -->
## Framework Specsfy

Leia e siga integralmente `.specsfy/Spec.md` antes de trabalhar com
backlogs, refinamentos do backlog, especificações, tarefas, testes ou implementação. Esse
arquivo contém o fluxo, os caminhos canônicos e os gates do framework.

- Preserve as instruções próprias deste projeto.
- Leia `PROJECT.md`, `.specsfy/STACK.md`, `.specsfy/RULES.md`,
  `.specsfy/DATABASE.md` e `.specsfy/PACKAGES.md` como contexto persistente
  antes de planejar mudanças.
- Execute `$specsfy-setup` quando `PROJECT.md`, `STACK.md`, `RULES.md` ou
  `DATABASE.md` estiver ausente. Execute `$specsfy-documentator` quando
  `PACKAGES.md` estiver ausente ou desatualizado.
- Execute o monitor de contexto no início, após cada tarefa e antes de concluir
  a entrega; resolva todo resultado `PENDING`.
- Use as skills `specsfy-aux-*` para manter stack, regras e banco sem apagar
  conteúdo humano.
- Execute `$specsfy-documentator` depois de cada implementação para reconstruir
  a documentação técnica completa em `docs/` e o inventário de dependências em
  `.specsfy/PACKAGES.md`.
- Use `specs/inbox/` para capturas imediatas ainda não refinadas.
- Use `specs/backlog/` para itens refináveis ainda não promovidos.
- Use `specs/<estado>/<NNNN>-<slug>/spec.md` como fonte normativa de cada
  fatia, em uma única pasta de estado.
- Não crie `plan.md`, `tasks.md`, `research.md` ou outra fonte normativa
  paralela.
<!-- specsfy:framework:end -->

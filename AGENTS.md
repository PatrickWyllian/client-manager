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
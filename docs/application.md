# Aplicação e implementações

<!-- specsfy:documentator:start -->
## Superfícies

Categorias: Serviços, Rotas e APIs, Páginas, Componentes, Testes e Outras fontes.

Relação: relaciona cada arquivo observado à sua superfície.

| Categoria | Arquivo | Símbolos |
| --- | --- | --- |
| Outras fontes | .eslintrc.js | — |
| Testes | __tests__/crypto.test.js | — |
| Testes | __tests__/dateHelpers.test.js | — |
| Testes | __tests__/integration.test.js | MessageQueue, createMockWaService, createMockIo |
| Testes | __tests__/messageQueue.test.js | EventEmitter, createMockWaService, createMockIo |
| Testes | __tests__/parseSpintax.test.js | — |
| Testes | __tests__/validators.test.js | — |
| Outras fontes | backup.js | DB_PATH, BACKUP_DIR, ensureBackupDir, runBackup, cleanOldBackups, startAutoBackup |
| Outras fontes | crypto.js | ALGORITHM, resetCrypto, initCrypto, ENCRYPTION_SECRET, JWT_SECRET, getKey, encryptText, decryptText |
| Testes | crypto.test.js | — |
| Outras fontes | db/connection.js | Database |
| Outras fontes | db/database.js | — |
| Outras fontes | db/migrations.js | runMigrations |
| Outras fontes | db/queries/dashboard.js | getActiveClientsCount, getActiveServersCount, getMonthlyRecurringRevenue, getChurnLast30Days, getMonthlyServerCost, getMonthlyServerCostByMonth, getAllActiveClients, getExpiredClients |
| Outras fontes | db/seed.js | runSeed |
| Outras fontes | jest.global-setup.js | — |
| Outras fontes | jest.setup.js | — |
| Outras fontes | lib/crypto.js | ALGORITHM, resetCrypto, initCrypto, ENCRYPTION_SECRET, JWT_SECRET, getKey, encryptText, decryptText |
| Outras fontes | lib/dateHelpers.js | daysUntil, daysSince, formatDate, formatMonth, addMonthsPreservingDay |
| Outras fontes | lib/errors.js | NotFoundError, ValidationError, UnauthorizedError |
| Outras fontes | lib/logger.js | createChildLogger |
| Outras fontes | lib/validators.js | normalizePhone, validateClient, validateServer, validatePlan |
| Outras fontes | logger.js | createChildLogger |
| Outras fontes | messageQueue.js | MAX_ATTEMPTS, STALE_MS, parseSpintax, isBusinessHours, MessageQueue |
| Outras fontes | middleware/auth.js | JWT_SECRET, authMiddleware, generateToken |
| Outras fontes | public/app.js | animateValue, update, animateMoneyValue, staggerItems, toast, api, money, brDateKey |
| Outras fontes | public/styles.css | — |
| Outras fontes | public/tokens.css | — |
| Outras fontes | routes/auth.js | — |
| Outras fontes | routes/clients.js | — |
| Outras fontes | routes/dashboard.js | parseMonthParam, monthEndStrFrom, currentMonthStr |
| Outras fontes | routes/export.js | escapeCsvField |
| Outras fontes | routes/plans.js | — |
| Outras fontes | routes/resellers.js | notFound, badReq |
| Outras fontes | routes/sales.js | — |
| Outras fontes | routes/servers.js | — |
| Outras fontes | routes/settings.js | — |
| Outras fontes | routes/whatsapp.js | — |
| Outras fontes | scheduler.js | setMessageQueue, getSetting, getSchedulesFromDB, startScheduledJobs, restartScheduler, expireOverdueClients, recordNotification, buildReminderMessage |
| Outras fontes | scripts/rotate-encryption.js | Database, decryptWith, encryptWith |
| Outras fontes | server.js | WhatsAppService, PORT, CORS_ORIGIN |
| Outras fontes | services/backup.js | DB_PATH, BACKUP_DIR, ensureBackupDir, runBackup, cleanOldBackups, startAutoBackup |
| Outras fontes | services/messageQueue.js | MAX_ATTEMPTS, STALE_MS, parseSpintax, isBusinessHours, MessageQueue |
| Outras fontes | services/scheduler.js | setMessageQueue, getSetting, getSchedulesFromDB, startScheduledJobs, restartScheduler, expireOverdueClients, recordNotification, buildReminderMessage |
| Outras fontes | services/whatsapp.js | QRCode, AUTH_DIR, DEFAULT_ACK_TIMEOUT_MS, WhatsAppService |
<!-- specsfy:documentator:end -->

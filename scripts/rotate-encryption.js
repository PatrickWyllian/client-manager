const crypto = require("crypto");
const Database = require("better-sqlite3");

const dbPath = process.argv[2] || "/app/data/iptv-crm.db";
const oldSecret = process.env.OLD_ENCRYPTION_SECRET;
const newSecret = process.env.NEW_ENCRYPTION_SECRET;

if (!oldSecret || !newSecret) {
  console.error("Uso: OLD_ENCRYPTION_SECRET=<atual> NEW_ENCRYPTION_SECRET=<novo> node rotate-encryption.js [caminho-do-db]");
  process.exit(1);
}

function decryptWith(key, ciphertext) {
  const parts = ciphertext.split(":");
  if (parts.length !== 5) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(parts[2], "hex"));
    decipher.setAuthTag(Buffer.from(parts[3], "hex"));
    let out = decipher.update(parts[4], "hex", "utf8");
    out += decipher.final("utf8");
    return out;
  } catch (e) {
    return null;
  }
}

function encryptWith(key, text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  return `enc:v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${enc}`;
}

(async () => {
  const db = new Database(dbPath);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = dbPath.replace(/\.db$/, `-backup-rot-enc-${ts}.db`);
  await db.backup(backupFile);
  console.log("Backup:", backupFile);
  db.pragma("wal_checkpoint(PASSIVE)");

  const rows = db.prepare("SELECT id, password FROM clients WHERE password LIKE 'enc:v1:%'").all();
  console.log("Registros enc:v1:", rows.length);

  let ok = 0;
  const errs = [];
  const update = db.prepare("UPDATE clients SET password = ? WHERE id = ?");

  db.transaction(() => {
    for (const r of rows) {
      const plain = decryptWith(oldKey, r.password);
      if (plain === null) { errs.push({ id: r.id, reason: "decrypt" }); continue; }
      update.run(encryptWith(newKey, plain), r.id);
      ok++;
    }
  })();

  console.log("Reencriptados:", ok, "| falhas:", errs.length);
  if (errs.length) { console.error(errs); db.close(); process.exit(2); }

  const sample = db.prepare("SELECT password FROM clients WHERE password LIKE 'enc:v1:%' LIMIT 5").all();
  const verified = sample.every((r) => decryptWith(newKey, r.password) !== null);
  console.log("Verificacao com nova chave:", verified ? "OK" : "FALHOU");
  if (!verified) { db.close(); process.exit(3); }

  db.close();
  console.log("Migracao concluida com sucesso.");
})().catch((e) => { console.error(e); process.exit(1); });
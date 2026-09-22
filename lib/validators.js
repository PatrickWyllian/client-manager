/**
 * Normaliza o telefone para o formato JID do WhatsApp (apenas dígitos + @s.whatsapp.net).
 * Garante o DDI 55 (Brasil) quando ausente.
 * Ex.: "21972872889" -> "5521972872889"; "(21)97289-7289" -> "5521972897289".
 * Retorna string vazia se o número for inválido (tamanho incorreto após normalização).
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  // Se não começar com 55 (DDI Brasil), assume Brasil
  if (digits.length === 11 || digits.length === 10) {
    digits = '55' + digits;
  } else if (digits.length === 12 || digits.length === 13) {
    // já tem DDI: se os dois primeiros dígitos não forem 55, ajusta
    if (!digits.startsWith('55')) digits = '55' + digits;
  } else if (digits.length > 0 && !digits.startsWith('55')) {
    digits = '55' + digits;
  }
  // Validação: número brasileiro deve ter 12 ou 13 dígitos (55 + DDD + 8/9 dígitos)
  if (digits.length !== 12 && digits.length !== 13) {
    return '';
  }
  return digits;
}

function validateClient(body) {
  const { name, phone, due_date } = body;
  if (!name || !name.trim()) return { valid: false, error: 'Nome é obrigatório.' };
  if (!phone || !phone.trim()) return { valid: false, error: 'Telefone é obrigatório.' };
  if (!due_date) return { valid: false, error: 'Data de vencimento é obrigatória.' };
  return { valid: true };
}

function validateServer(body) {
  const { name } = body;
  if (!name || !name.trim()) return { valid: false, error: 'Nome do servidor é obrigatório.' };
  return { valid: true };
}

function validatePlan(body) {
  const { name } = body;
  if (!name || !name.trim()) return { valid: false, error: 'Nome do plano é obrigatório.' };
  return { valid: true };
}

module.exports = { normalizePhone, validateClient, validateServer, validatePlan };

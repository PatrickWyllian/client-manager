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

module.exports = { validateClient, validateServer, validatePlan };

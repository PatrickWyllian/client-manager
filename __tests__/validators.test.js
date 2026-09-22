const { normalizePhone, validateClient, validateServer, validatePlan } = require('../lib/validators');

describe('normalizePhone', () => {
  test('deve normalizar telefone com DDD (11 dígitos)', () => {
    expect(normalizePhone('21972872889')).toBe('5521972872889');
    expect(normalizePhone('11987654321')).toBe('5511987654321');
  });

  test('deve normalizar telefone com DDD (10 dígitos - fixo)', () => {
    expect(normalizePhone('2134567890')).toBe('552134567890');
  });

  test('deve manter DDI 55 se já presente (12 dígitos)', () => {
    expect(normalizePhone('5521972872889')).toBe('5521972872889');
  });

  test('deve manter DDI 55 se já presente (13 dígitos)', () => {
    expect(normalizePhone('5511987654321')).toBe('5511987654321');
  });

  test('deve remover formatação (parênteses, traços, espaços)', () => {
    expect(normalizePhone('(21) 97289-7289')).toBe('5521972897289');
    expect(normalizePhone('21 97289 7289')).toBe('5521972897289');
    expect(normalizePhone('+55 21 97289-7289')).toBe('5521972897289');
  });

  test('deve retornar string vazia para telefone inválido (muito curto)', () => {
    expect(normalizePhone('1234567')).toBe('');
    expect(normalizePhone('2197287')).toBe('');
  });

  test('deve retornar string vazia para telefone inválido (muito longo)', () => {
    expect(normalizePhone('55219728728890')).toBe('');
  });

  test('deve retornar string vazia para input vazio ou null', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('validateClient', () => {
  test('deve validar cliente com dados corretos', () => {
    const result = validateClient({
      name: 'João Silva',
      phone: '21972872889',
      due_date: '2026-12-31'
    });
    expect(result.valid).toBe(true);
  });

  test('deve rejeitar cliente sem nome', () => {
    const result = validateClient({
      phone: '21972872889',
      due_date: '2026-12-31'
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Nome é obrigatório.');
  });

  test('deve rejeitar cliente sem telefone', () => {
    const result = validateClient({
      name: 'João Silva',
      due_date: '2026-12-31'
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Telefone é obrigatório.');
  });

  test('deve rejeitar cliente sem data de vencimento', () => {
    const result = validateClient({
      name: 'João Silva',
      phone: '21972872889'
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Data de vencimento é obrigatória.');
  });
});

describe('validateServer', () => {
  test('deve validar servidor com nome', () => {
    expect(validateServer({ name: 'Servidor 1' })).toEqual({ valid: true });
  });

  test('deve rejeitar servidor sem nome', () => {
    expect(validateServer({ name: '' })).toEqual({ valid: false, error: 'Nome do servidor é obrigatório.' });
    expect(validateServer({})).toEqual({ valid: false, error: 'Nome do servidor é obrigatório.' });
  });
});

describe('validatePlan', () => {
  test('deve validar plano com nome', () => {
    expect(validatePlan({ name: 'Plano Mensal' })).toEqual({ valid: true });
  });

  test('deve rejeitar plano sem nome', () => {
    expect(validatePlan({ name: '' })).toEqual({ valid: false, error: 'Nome do plano é obrigatório.' });
  });
});
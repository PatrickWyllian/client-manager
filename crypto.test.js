// Crypto tests - environment variables set in beforeAll
describe('encryptText / decryptText', () => {
  let encryptText, decryptText;

  beforeAll(() => {
    jest.resetModules();
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32bytes-long!!';
    process.env.JWT_SECRET = 'test-jwt-secret-different-from-encryption';
    // Import after setting environment variables
    const crypto = require('../lib/crypto');
    crypto.resetCrypto();
    encryptText = crypto.encryptText;
    decryptText = crypto.decryptText;
  });

  const testSecrets = [
    'senha-simples',
    'senha-com-espaços-e-acentuação-çãõ',
    '1234567890',
    'senha@#$%^&*()',
    'a'.repeat(100), // string longa
    '', // string vazia
  ];

  test('deve encriptar e decriptar corretamente para vários segredos', () => {
    for (const secret of testSecrets) {
      const encrypted = encryptText(secret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      
      // Verifica formato enc:v1:iv:authTag:encrypted
      expect(encrypted.startsWith('enc:v1:')).toBe(true);
      
      const decrypted = decryptText(encrypted);
      expect(decrypted).toBe(secret);
    }
  });

  test('deve retornar string vazia/null para input vazio/null', () => {
    expect(encryptText('')).toBe('');
    expect(encryptText(null)).toBe(null);
    expect(encryptText(undefined)).toBe(undefined);
    
    expect(decryptText('')).toBe('');
    expect(decryptText(null)).toBe(null);
    expect(decryptText(undefined)).toBe(undefined);
  });

  test('deve retornar texto original se já estiver encriptado (formato enc:v1:)', () => {
    const encrypted = encryptText('teste');
    const doubleEncrypted = encryptText(encrypted);
    expect(doubleEncrypted).toBe(encrypted);
  });

  test('deve retornar texto original se não for formato encriptado', () => {
    const plainText = 'senha-sem-encriptar';
    expect(decryptText(plainText)).toBe(plainText);
    expect(decryptText('texto-qualquer')).toBe('texto-qualquer');
  });

  test('deve falhar graciosamente com authTag inválido', () => {
    // Cria um texto encriptado válido e corrompe o authTag
    const encrypted = encryptText('teste');
    const parts = encrypted.split(':');
    parts[3] = 'ffffffffffffffffffffffffffffffff'; // authTag inválido
    const corrupted = parts.join(':');
    
    const result = decryptText(corrupted);
    expect(result).toBe('***'); // fallback de erro
  });

  test('deve manter consistência entre múltiplas encriptações do mesmo texto', () => {
    const secret = 'minha-senha-secreta';
    const enc1 = encryptText(secret);
    const enc2 = encryptText(secret);
    
    // IVs devem ser diferentes (aleatórios)
    expect(enc1).not.toBe(enc2);
    
    // Mas ambos decriptam para o mesmo valor
    expect(decryptText(enc1)).toBe(secret);
    expect(decryptText(enc2)).toBe(secret);
  });
});
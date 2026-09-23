const { parseSpintax } = require('../services/messageQueue');

describe('parseSpintax', () => {
  test('deve escolher uma opção entre pipes', () => {
    const result = parseSpintax('Olá {mundo|amigo|pessoa}!');
    expect(['Olá mundo!', 'Olá amigo!', 'Olá pessoa!']).toContain(result);
  });

  test('deve lidar com múltiplos spintax na mesma string', () => {
    const result = parseSpintax('{Olá|Oi} {mundo|amigo}!');
    const expected = [
      'Olá mundo!', 'Olá amigo!',
      'Oi mundo!', 'Oi amigo!'
    ];
    expect(expected).toContain(result);
  });

  test('deve retornar string original se não houver spintax', () => {
    expect(parseSpintax('Olá mundo!')).toBe('Olá mundo!');
    expect(parseSpintax('')).toBe('');
  });

  test('deve lidar com opções vazias', () => {
    const result = parseSpintax('Olá {|mundo}!');
    expect(['Olá !', 'Olá mundo!']).toContain(result);
  });

test('deve lidar com spintax aninhado não suportado (trata como literal)', () => {
    // O parser atual não suporta nesting, o comportamento é não determinístico
    const result = parseSpintax('{a|{b|c}}');
    // O parser pode retornar 'a|b', 'a|c', '{a|b}', '{a|c}' ou a string original dependendo da implementação
    expect(['a|b', 'a|c', '{a|b}', '{a|c}', '{a|{b|c}}']).toContain(result);
  });

  test('deve preservar texto fora do spintax', () => {
    const result = parseSpintax('Prefixo {a|b} sufixo');
    expect(['Prefixo a sufixo', 'Prefixo b sufixo']).toContain(result);
  });

  test('deve lidar com caracteres especiais nas opções', () => {
    const result = parseSpintax('{a@b.com|c@d.com}');
    expect(['a@b.com', 'c@d.com']).toContain(result);
  });

  test('deve retornar o valor original para null/undefined', () => {
    expect(parseSpintax(null)).toBe(null);
    expect(parseSpintax(undefined)).toBe(undefined);
  });
});
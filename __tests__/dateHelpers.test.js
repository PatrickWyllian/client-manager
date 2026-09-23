const { daysUntil, daysSince, formatDate, formatMonth, addMonthsPreservingDay } = require('../lib/dateHelpers');

describe('daysUntil', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  test('deve retornar 0 para hoje', () => {
    const todayStr = today.toISOString().split('T')[0];
    expect(daysUntil(todayStr)).toBe(0);
  });

  test('deve retornar 1 para amanhã', () => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    expect(daysUntil(tomorrowStr)).toBe(1);
  });

  test('deve retornar -1 para ontem', () => {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    expect(daysUntil(yesterdayStr)).toBe(-1);
  });
});

describe('daysSince', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  test('deve retornar 0 para hoje', () => {
    const todayStr = today.toISOString().split('T')[0];
    expect(daysSince(todayStr)).toBe(0);
  });

  test('deve retornar 1 para ontem', () => {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    expect(daysSince(yesterdayStr)).toBe(1);
  });

  test('deve retornar -1 para amanhã', () => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    expect(daysSince(tomorrowStr)).toBe(-1);
  });
});

describe('formatDate', () => {
  test('deve formatar Date para YYYY-MM-DD', () => {
    const date = new Date(2026, 11, 31); // 31/12/2026
    expect(formatDate(date)).toBe('2026-12-31');
  });

  test('deve formatar com zero à esquerda para mês/dia < 10', () => {
    const date = new Date(2026, 0, 5); // 05/01/2026
    expect(formatDate(date)).toBe('2026-01-05');
  });
});

describe('formatMonth', () => {
  test('deve formatar Date para YYYY-MM', () => {
    const date = new Date(2026, 11, 31);
    expect(formatMonth(date)).toBe('2026-12');
  });
});

describe('addMonthsPreservingDay', () => {
  test('deve adicionar meses mantendo o dia (sem overflow)', () => {
    const date = new Date(2026, 0, 15); // 15/01/2026
    const result = addMonthsPreservingDay(date, 1);
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(1); // Fevereiro
    expect(result.getFullYear()).toBe(2026);
  });

  test('deve ajustar dia para último dia do mês se dia não existir (31/01 -> 28/02)', () => {
    const date = new Date(2026, 0, 31); // 31/01/2026
    const result = addMonthsPreservingDay(date, 1);
    expect(result.getDate()).toBe(28); // Fevereiro 2026 tem 28 dias
    expect(result.getMonth()).toBe(1);
  });

  test('deve ajustar para 29 em ano bissexto (31/01 -> 29/02)', () => {
    const date = new Date(2024, 0, 31); // 31/01/2024 (ano bissexto)
    const result = addMonthsPreservingDay(date, 1);
    expect(result.getDate()).toBe(29); // Fevereiro 2024 tem 29 dias
  });

  test('deve funcionar para múltiplos meses (31/01 + 3 meses = 30/04)', () => {
    const date = new Date(2026, 0, 31);
    const result = addMonthsPreservingDay(date, 3);
    expect(result.getDate()).toBe(30); // Abril tem 30 dias
    expect(result.getMonth()).toBe(3); // Abril
  });

  test('deve manter dia se existir no mês destino (15/01 + 1 = 15/02)', () => {
    const date = new Date(2026, 0, 15);
    const result = addMonthsPreservingDay(date, 1);
    expect(result.getDate()).toBe(15);
  });

  test('deve funcionar com ano novo (15/12 + 1 = 15/01 do ano seguinte)', () => {
    const date = new Date(2026, 11, 15); // 15/12/2026
    const result = addMonthsPreservingDay(date, 1);
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(0); // Janeiro
    expect(result.getFullYear()).toBe(2027);
  });
});
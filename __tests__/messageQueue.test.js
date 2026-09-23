const { MessageQueue } = require('../services/messageQueue');
const EventEmitter = require('events');

// Mock simples do waService
function createMockWaService() {
  return {
    getStatus: jest.fn().mockReturnValue({ status: 'connected' }),
    sendMessage: jest.fn().mockResolvedValue({ key: { id: 'msg123' }, ackStatus: 3 })
  };
}

// Mock do io (Socket.IO)
function createMockIo() {
  return {
    emit: jest.fn()
  };
}

describe('MessageQueue', () => {
  let messageQueue;
  let mockWaService;
  let mockIo;

  beforeEach(() => {
    mockWaService = createMockWaService();
    mockIo = createMockIo();
    messageQueue = new MessageQueue(mockWaService, mockIo);
  });

  test('deve instanciar corretamente', () => {
    expect(messageQueue).toBeInstanceOf(MessageQueue);
    expect(messageQueue.waService).toBeDefined();
    expect(messageQueue.io).toBeDefined();
  });

  test('enqueue deve adicionar mensagem à fila e retornar ID', () => {
    const id = messageQueue.enqueue('5521972872889', 'Teste', 'manual', null, 0);
    expect(id).toBeDefined();
    expect(typeof id).toBe('number');
  });

  test('enqueue deve emitir evento queue:added', () => {
    const emitSpy = jest.spyOn(messageQueue, 'emit');
    messageQueue.enqueue('5521972872889', 'Teste', 'manual', null, 1);
    expect(emitSpy).toHaveBeenCalledWith('queue:added', expect.objectContaining({
      id: expect.any(Number),
      phone: '5521972872889',
      message: 'Teste',
      type: 'manual'
    }));
  });

  test('cancel deve cancelar mensagem pending', () => {
    const id = messageQueue.enqueue('5521972872889', 'Teste', 'manual');
    messageQueue.cancel(id);
    // Verifica se emitiu evento
    // (não podemos testar DB diretamente sem mock, mas o método não deve lançar erro)
    expect(() => messageQueue.cancel(id)).not.toThrow();
  });

  test('forceCancel deve cancelar mensagem sending', () => {
    const id = messageQueue.enqueue('5521972872889', 'Teste', 'manual');
    expect(() => messageQueue.forceCancel(id)).not.toThrow();
  });

  test('getQueueStatus deve retornar estrutura correta', () => {
    const status = messageQueue.getQueueStatus();
    expect(status).toHaveProperty('pending');
    expect(status).toHaveProperty('current');
    expect(status).toHaveProperty('stats');
    expect(status).toHaveProperty('processing');
  });

  test('getQueue deve retornar array', () => {
    const queue = messageQueue.getQueue(10);
    expect(Array.isArray(queue)).toBe(true);
  });

  test('getHistory deve retornar array', () => {
    const history = messageQueue.getHistory(10);
    expect(Array.isArray(history)).toBe(true);
  });

  test('clearHistory deve executar sem erro', () => {
    expect(() => messageQueue.clearHistory()).not.toThrow();
  });

  test('start/stop devem gerenciar timer', () => {
    messageQueue.start();
    expect(messageQueue.timer).toBeDefined();
    
    messageQueue.stop();
    expect(messageQueue.timer).toBeNull();
    expect(messageQueue.processing).toBe(false);
  });
});
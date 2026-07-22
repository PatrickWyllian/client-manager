class NotFoundError extends Error {
  constructor(message = 'Recurso não encontrado.') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ValidationError extends Error {
  constructor(message = 'Dados inválidos.') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Não autenticado.') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

module.exports = { NotFoundError, ValidationError, UnauthorizedError };

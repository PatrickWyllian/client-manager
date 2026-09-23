// Setup file - runs in each worker process before tests
process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32bytes-long!!';
process.env.JWT_SECRET = 'test-jwt-secret-different-from-encryption';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGIN = 'http://localhost:3400';
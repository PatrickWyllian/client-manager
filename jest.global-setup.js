// Global setup - runs once before all tests
module.exports = async () => {
  console.log('[globalSetup] Setting up test environment variables...');
  // Set required environment variables before any modules are loaded
  process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32bytes-long!!';
  process.env.JWT_SECRET = 'test-jwt-secret-different-from-encryption';
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.CORS_ORIGIN = 'http://localhost:3400';
  console.log('[globalSetup] Environment variables set');
};
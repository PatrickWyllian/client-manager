const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

let transport;
if (!isProduction) {
  try {
    // Check if pino-pretty is available
    require.resolve('pino-pretty');
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  } catch (e) {
    // pino-pretty not available, use default transport
    transport = undefined;
  }
}

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      '*.password',
      '*.token',
      '*.authorization',
      '*.cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.cookies.token',
    ],
    censor: '[REDACTED]',
  },
  transport,
});

// Child logger factory for context-specific loggers
function createChildLogger(context) {
  return logger.child({ context });
}

module.exports = {
  logger,
  createChildLogger
};
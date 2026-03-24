import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});

// Convenience child loggers per domain
export const paymentLogger = logger.child({ domain: 'payment' });
export const webhookLogger = logger.child({ domain: 'webhook' });
export const authLogger = logger.child({ domain: 'auth' });
export const apiLogger = logger.child({ domain: 'api' });
export const zeroGLogger = logger.child({ domain: '0g' });

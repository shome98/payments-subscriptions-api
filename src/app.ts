import app from './server';
import { env } from './config/env';
import logger from './utils/logger';

const PORT = env.PORT;
const APP_URL = env.APP_URL;

const server = app.listen(PORT, () => {
  logger.info(`💳 Payments & Subscriptions API`);
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`🌍 Environment  : ${env.NODE_ENV}`);
  logger.info(`🩺 Health check : ${APP_URL}/healthz`);
  logger.info(`🚀 Ready check : ${APP_URL}/readyz`);
  logger.info(`📡 API prefix   : ${APP_URL}/api/v1`);
});

//  Graceful shutdown

function gracefulShutdown(signal: string): void {
  logger.info(`\n⚠️  Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('✅ HTTP server closed.');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('❌ Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('💥 Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});
export default app;

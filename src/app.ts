import app from './server';
import { env } from './config/env';
import logger from './utils/logger';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`\n💳 Payments & Subscriptions API`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`🌍 Environment  : ${env.NODE_ENV}`);
  logger.info(`🩺 Health check : http://localhost:${PORT}/health`);
  logger.info(`📡 API prefix   : http://localhost:${PORT}/api/v1`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  //
  console.log(`\n💳 Payments & Subscriptions API`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment  : ${env.NODE_ENV}`);
  console.log(`🩺 Health check : http://localhost:${PORT}/health`);
  console.log(`📡 API prefix   : http://localhost:${PORT}/api/v1`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
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

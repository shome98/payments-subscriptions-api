import winston from 'winston';
import 'winston-daily-rotate-file';
import { env } from '../config/env';
import path from 'path';

/* Custom format for development (human-readable).*/
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ timestamp, level, message, ...meta }) =>
      `${timestamp} [${level}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      }`,
  ),
);

/* Custom format for production (JSON).*/
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

/* Production-grade Winston Logger configuration.*/
const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    // 1. Console Transport (Always helpful)
    new winston.transports.Console(),

    // 2. Daily Rotate File for ERRORS
    new winston.transports.DailyRotateFile({
      level: 'error',
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),

    // 3. Daily Rotate File for ALL logs
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

// Export a stream object for integration with Morgan if needed later
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;

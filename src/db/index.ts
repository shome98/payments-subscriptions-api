import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';
import * as schema from './schema';

//  Connection

const queryClient = postgres(env.DATABASE_URL, {
  ssl: env.NODE_ENV === 'production' ? 'require' : undefined,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
});

export const db = drizzle(queryClient, { schema });

//  Re-export schema types for convenience
export * from './schema';

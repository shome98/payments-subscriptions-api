import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const migrationFolders = [
  path.resolve(process.cwd(), 'drizzle'),
  path.resolve(__dirname, '../../drizzle'),
];

function resolveMigrationsFolder(): string {
  const migrationsFolder = migrationFolders.find((folder) =>
    fs.existsSync(path.join(folder, 'meta', '_journal.json')),
  );

  if (!migrationsFolder) {
    throw new Error(
      `Drizzle migrations not found. Checked: ${migrationFolders.join(', ')}`,
    );
  }

  return migrationsFolder;
}

async function runMigrations(): Promise<void> {
  console.log('🔄 Running migrations...');

  const migrationClient = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    const migrationsFolder = resolveMigrationsFolder();
    console.log(`Using migrations from ${migrationsFolder}`);

    await migrate(db, {
      migrationsFolder,
    });
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await migrationClient.end();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

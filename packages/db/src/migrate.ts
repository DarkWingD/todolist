import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

// Dedicated single connection for migrations.
const migrationClient = postgres(connectionString, { max: 1 });

async function main() {
  const db = drizzle(migrationClient);
  console.log('Running migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');
  await migrationClient.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

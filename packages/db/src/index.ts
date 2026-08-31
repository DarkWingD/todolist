import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

// One shared connection pool per process.
const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema, casing: 'snake_case' });

export { client, schema };
export * from './schema.js';
export type DB = typeof db;

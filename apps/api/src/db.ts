import { Client, type PoolClient } from "pg";

export type DatabaseClient = Client | PoolClient;

export async function withDatabase<T>(
  env: Env,
  operation: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
  });

  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

export async function withTransaction<T>(
  client: DatabaseClient,
  operation: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    const result = await operation();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

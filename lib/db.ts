import mysql from "mysql2/promise";

const globalForDb = globalThis as unknown as {
  mysqlPool: mysql.Pool | undefined;
};

export const pool =
  globalForDb.mysqlPool ??
  mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root1234",
    database: process.env.DB_NAME || "task_management",
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.mysqlPool = pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}


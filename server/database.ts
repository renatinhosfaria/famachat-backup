/**
 * database.ts
 * Configuração e conexão com o banco de dados PostgreSQL usando Drizzle ORM
 */
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as PgPool } from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Detecta automaticamente o tipo de banco
// Como o usuário confirmou que não é Neon e não tem SSL, usar PostgreSQL nativo
const isNeonDB = false; // Forçar PostgreSQL nativo para este banco
const dbUrl = process.env.DATABASE_URL;

// Configuração SSL baseada na string de conexão
const sslConfig = dbUrl?.includes('sslmode=disable') ? false : { rejectUnauthorized: false };

let pool: any;
let db: any;

if (isNeonDB) {
  // Configuração para Neon Database
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ 
    connectionString: dbUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: sslConfig
  });
  db = drizzle(pool, { schema });
  console.log('Usando Neon Database driver');
} else {
  // Usar driver PostgreSQL nativo para bancos comuns (SEM WebSocket)
  pool = new PgPool({
    connectionString: dbUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: sslConfig
  });
  db = drizzlePg(pool, { schema });
  console.log('Usando PostgreSQL driver nativo (sem WebSocket)');
}

export { pool, db };

/**
 * Testa a conexão com o banco de dados
 */
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log(`Conexão com o banco de dados testada com sucesso: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.error(`Erro ao testar conexão com banco de dados:`, error);
    throw error;
  }
}

/**
 * Função para executar uma query SQL diretamente
 * Útil para casos onde o ORM não é adequado ou para consultas complexas específicas
 */
export async function executeSQL(sql: string, params: any[] = []): Promise<any> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error(`Erro ao executar SQL: ${error}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verificar se uma tabela existe
 */
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    const sql = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    
    const result = await executeSQL(sql, [tableName]);
    return result[0].exists;
  } catch (error) {
    console.error(`Erro ao verificar existência da tabela ${tableName}: ${error}`);
    return false;
  }
}

console.log("Database connection initialized");

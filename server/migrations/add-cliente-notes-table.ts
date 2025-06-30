import { sql } from "drizzle-orm";
import { db } from "../database";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:ClienteNotesTable");

/**
 * Adiciona tabela cliente_notes para anotações de clientes
 * Esta migração cria uma tabela para armazenar anotações dos clientes
 * @returns true se a migração foi concluída com sucesso
 */
export async function addClienteNotesTable(): Promise<boolean> {
  migrationLogger.info("Iniciando criação da tabela cliente_notes...");

  try {
    // Verificar se a tabela já existe
    const checkTableExistsQuery = sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'cliente_notes'
    `;
    
    const result = await db.execute(checkTableExistsQuery);
    
    // Verificar se há resultados
    const rows = (result as any).rows || result;
    if (rows.length === 0) {
      // A tabela não existe, então vamos criá-la
      const createTableQuery = sql`
        CREATE TABLE cliente_notes (
          id SERIAL PRIMARY KEY,
          cliente_id INTEGER REFERENCES clientes(id),
          user_id INTEGER REFERENCES users(id),
          text TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await db.execute(createTableQuery);
      migrationLogger.info("Tabela cliente_notes criada com sucesso.");
    } else {
      migrationLogger.info("A tabela cliente_notes já existe.");
    }
    
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao criar tabela cliente_notes: ${error}`);
    return false;
  }
}
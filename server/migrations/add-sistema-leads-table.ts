import { sql } from "drizzle-orm";
import { db } from "../database";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:SistemaLeadsTable");

/**
 * Adiciona tabela sistema_leads para gerenciamento de leads
 * Esta migração cria a tabela necessária para armazenar leads de diferentes fontes
 * @returns Promise<void>
 */
export async function addSistemaLeadsTable(): Promise<void> {
  migrationLogger.info("Iniciando criação da tabela sistema_leads...");
  
  try {
    // Criar tabela sistema_leads se não existir
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sistema_leads (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT NOT NULL,
        source TEXT NOT NULL,
        source_details JSONB,
        status TEXT DEFAULT 'Novo Lead',
        assigned_to INTEGER REFERENCES sistema_users(id),
        notes TEXT,
        tags JSONB,
        last_activity_date TIMESTAMP,
        is_recurring BOOLEAN DEFAULT FALSE,
        score INTEGER,
        interesse TEXT,
        budget NUMERIC(12, 2),
        cliente_id INTEGER REFERENCES clientes(id),
        meta_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    migrationLogger.info("Tabela sistema_leads criada com sucesso!");
  } catch (error) {
    migrationLogger.error(`Erro ao criar tabela sistema_leads: ${error}`);
    throw error; // Lançar erro para que o sistema de migrações possa tratá-lo adequadamente
  }
}
import { sql } from "drizzle-orm";
import { db } from "../database";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:FacebookConfigTable");

/**
 * Adiciona tabela para configuração de integrações com Facebook
 * Esta migração cria a tabela necessária para armazenar configurações de API do Facebook
 * @returns true se a migração foi concluída com sucesso
 */
export async function addFacebookConfigTable(): Promise<void> {
  migrationLogger.info("Iniciando criação da tabela para configuração de Facebook...");
  
  try {
    // Criar tabela sistema_facebook_config se não existir
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sistema_facebook_config (
        id SERIAL PRIMARY KEY,
        app_id TEXT NOT NULL,
        app_secret TEXT NOT NULL,
        access_token TEXT NOT NULL,
        user_access_token TEXT,
        verification_token TEXT,
        page_id TEXT,
        ad_account_id TEXT,
        webhook_enabled BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    migrationLogger.info("Tabela sistema_facebook_config criada com sucesso!");
  } catch (error) {
    migrationLogger.error(`Erro ao criar tabela sistema_facebook_config: ${error}`);
    throw error; // Lançar erro para que o sistema de migrações possa tratá-lo adequadamente
  }
}
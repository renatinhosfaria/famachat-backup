import { db } from "../database";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:IsPrimaryWhatsapp");

/**
 * Adiciona coluna is_primary à tabela whatsapp_instances
 * Esta migração adiciona um campo para marcar uma instância como primária
 * @returns true se a migração foi concluída com sucesso
 */
export async function addIsPrimaryToWhatsapp(): Promise<boolean> {
  migrationLogger.info("Adicionando coluna isPrimary à tabela whatsapp_instances...");

  try {
    // Verificar se a coluna is_primary já existe
    const checkColumnQuery = sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'whatsapp_instances' 
        AND column_name = 'is_primary'
      );
    `;
    
    const result = await db.execute(checkColumnQuery);
    const columnExists = result && 
                       (result as any).rows && 
                       (result as any).rows[0] && 
                       (result as any).rows[0].exists;
    
    if (!columnExists) {
      // Adicionar a coluna is_primary
      const addColumnQuery = sql`
        ALTER TABLE whatsapp_instances 
        ADD COLUMN is_primary BOOLEAN DEFAULT false;
      `;
      
      await db.execute(addColumnQuery);
      migrationLogger.info("Coluna is_primary adicionada com sucesso!");
    } else {
      migrationLogger.info("Coluna is_primary já existe na tabela whatsapp_instances.");
    }
    
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao adicionar coluna isPrimary: ${error}`);
    return false;
  }
}
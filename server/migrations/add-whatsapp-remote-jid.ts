import { db } from "../database";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:WhatsappRemoteJid");

/**
 * Adiciona a coluna remote_jid à tabela sistema_whatsapp_instances
 * Esta coluna armazena o valor do ownerJid da API Evolution
 */
export async function addWhatsappRemoteJid(): Promise<boolean> {
  try {
    migrationLogger.info("Adicionando coluna remote_jid à tabela sistema_whatsapp_instances...");
    
    // Verificar se a coluna já existe
    const columnExistsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'sistema_whatsapp_instances' 
        AND column_name = 'remote_jid'
      );
    `);
    
    const columnExists = columnExistsResult && 
                      (columnExistsResult as any).rows && 
                      (columnExistsResult as any).rows[0] && 
                      (columnExistsResult as any).rows[0].exists;
    
    if (columnExists) {
      migrationLogger.info("Coluna remote_jid já existe na tabela sistema_whatsapp_instances. Pulando...");
      return true;
    }
    
    // Adicionar a coluna
    await db.execute(sql`
      ALTER TABLE sistema_whatsapp_instances 
      ADD COLUMN remote_jid TEXT;
    `);
    
    migrationLogger.info("Coluna remote_jid adicionada com sucesso à tabela sistema_whatsapp_instances.");
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao adicionar coluna remote_jid: ${error}`);
    return false;
  }
}
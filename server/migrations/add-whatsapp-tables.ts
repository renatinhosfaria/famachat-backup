import { sql } from "drizzle-orm";
import { db } from "../database";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:WhatsappTables");

/**
 * Adiciona tabelas para integração com WhatsApp
 * Esta migração cria as tabelas necessárias para armazenar informações sobre instâncias
 * do WhatsApp e seus logs
 * @returns true se a migração foi concluída com sucesso
 */
export async function addWhatsappTables(): Promise<boolean> {
  migrationLogger.info("Iniciando criação das tabelas para WhatsApp...");

  try {
    // Verificar se a tabela whatsapp_instances já existe
    const tableExistsQuery = sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'whatsapp_instances'
      );
    `;
    
    const result = await db.execute(tableExistsQuery);
    const tableExists = result && 
                       (result as any).rows && 
                       (result as any).rows[0] && 
                       (result as any).rows[0].exists;
    
    if (!tableExists) {
      // Criar tabela de instâncias do WhatsApp
      await db.execute(sql`
        CREATE TABLE whatsapp_instances (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          instance_key TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT 'disconnected',
          qr_code TEXT,
          is_primary BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      migrationLogger.info("Tabela whatsapp_instances criada com sucesso.");
      
      // Criar tabela de logs do WhatsApp
      await db.execute(sql`
        CREATE TABLE whatsapp_logs (
          id SERIAL PRIMARY KEY,
          instance_id INTEGER REFERENCES whatsapp_instances(id),
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      migrationLogger.info("Tabela whatsapp_logs criada com sucesso.");
    } else {
      migrationLogger.info("Tabela whatsapp_instances já existe, pulando criação.");
      
      // Verificar se a tabela de logs existe
      const logsTableExistsQuery = sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'whatsapp_logs'
        );
      `;
      
      const logsResult = await db.execute(logsTableExistsQuery);
      const logsTableExists = logsResult && 
                             (logsResult as any).rows && 
                             (logsResult as any).rows[0] && 
                             (logsResult as any).rows[0].exists;
      
      if (!logsTableExists) {
        // Criar apenas a tabela de logs se ela não existir
        await db.execute(sql`
          CREATE TABLE whatsapp_logs (
            id SERIAL PRIMARY KEY,
            instance_id INTEGER REFERENCES whatsapp_instances(id),
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        migrationLogger.info("Tabela whatsapp_logs criada com sucesso.");
      } else {
        migrationLogger.info("Tabela whatsapp_logs já existe, pulando criação.");
      }
    }
    
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao criar tabelas para WhatsApp: ${error}`);
    return false;
  }
}
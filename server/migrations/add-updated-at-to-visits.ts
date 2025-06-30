import { db } from "../database";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:UpdatedAtVisits");

/**
 * Adiciona coluna updated_at à tabela de visitas
 */
export async function addUpdatedAtToVisits(): Promise<boolean | { success: boolean; message: string }> {
  try {
    migrationLogger.info("Verificando se a coluna 'updated_at' já existe na tabela de visitas...");
    
    // Verificar se a coluna já existe
    const columnExistsQuery = sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'visits' 
        AND column_name = 'updated_at'
      );
    `;
    
    const columnExistsResult = await db.execute(columnExistsQuery);
    const columnExists = (columnExistsResult as any).rows?.[0]?.exists === true;
    
    if (columnExists) {
      migrationLogger.info("Coluna 'updated_at' já existe na tabela de visitas. Migração concluída.");
      return { 
        success: true, 
        message: "Coluna 'updated_at' já existe na tabela de visitas. Migração concluída."
      };
    }
    
    // Se a coluna não existir, adicionar a coluna updated_at
    migrationLogger.info("Adicionando coluna 'updated_at' na tabela de visitas...");
    await db.execute(sql`
      ALTER TABLE visits
      ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);
    
    // Atualizar a coluna de todos os registros existentes para usar o valor de created_at
    await db.execute(sql`
      UPDATE visits
      SET updated_at = created_at
      WHERE updated_at IS NULL;
    `);
    
    migrationLogger.info("Coluna 'updated_at' adicionada com sucesso à tabela de visitas.");
    
    return { 
      success: true, 
      message: "Coluna 'updated_at' adicionada com sucesso à tabela de visitas." 
    };
  } catch (error) {
    // Se o erro for que a coluna já existe, tratar como sucesso
    if (error && (error as any).message && (error as any).message.includes("column \"updated_at\" of relation \"visits\" already exists")) {
      migrationLogger.info("Coluna 'updated_at' já existe na tabela de visitas. Migração concluída.");
      return { 
        success: true, 
        message: "Coluna 'updated_at' já existe na tabela de visitas. Migração concluída."
      };
    }
    
    migrationLogger.error(`Erro ao adicionar coluna 'updated_at': ${error}`);
    
    return { 
      success: false, 
      message: `Falha ao adicionar coluna 'updated_at': ${error}` 
    };
  }
}
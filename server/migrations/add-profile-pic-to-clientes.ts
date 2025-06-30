import { db } from "../database";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:ProfilePicClientes");

/**
 * Adiciona a coluna profilePicUrl à tabela clientes para armazenar fotos de perfil do WhatsApp
 */
export async function addProfilePicToClientes(): Promise<void | boolean | { success: boolean; message: string }> {
  try {
    migrationLogger.info("Verificando se a coluna profile_pic_url já existe na tabela clientes...");

    // Verificar primeiro se a coluna já existe
    const columnCheckResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clientes' AND column_name = 'profile_pic_url';
    `);

    const columnExists = columnCheckResult && 
                      (columnCheckResult as any).rows && 
                      (columnCheckResult as any).rows.length > 0;

    if (columnExists) {
      migrationLogger.info("Coluna profile_pic_url já existe na tabela clientes");
      return { success: true, message: "Coluna profile_pic_url já existe na tabela clientes" };
    }

    // Adicionar a coluna
    migrationLogger.info("Adicionando coluna profile_pic_url à tabela clientes...");
    
    await db.execute(sql`
      ALTER TABLE clientes 
      ADD COLUMN profile_pic_url TEXT;
    `);

    migrationLogger.info("Coluna profile_pic_url adicionada com sucesso");
    
    return { 
      success: true, 
      message: "Coluna profile_pic_url adicionada com sucesso à tabela clientes" 
    };

  } catch (error) {
    migrationLogger.error(`Erro ao adicionar coluna profile_pic_url: ${error}`);
    return { 
      success: false, 
      message: `Erro ao adicionar coluna profile_pic_url: ${error}` 
    };
  }
}
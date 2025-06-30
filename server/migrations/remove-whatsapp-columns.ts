import { db } from "../database";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:RemoveWhatsappColumns");

/**
 * Remove colunas relacionadas ao WhatsApp da tabela clientes
 * que não são mais utilizadas após a migração para instâncias WhatsApp
 * @returns true se a migração foi concluída com sucesso
 */
export async function removeWhatsappColumns(): Promise<boolean> {
  try {
    migrationLogger.info("Iniciando remoção das colunas do WhatsApp da tabela clientes...");

    // Remover coluna whatsapp_checked_at se existir
    try {
      await db.execute(sql`ALTER TABLE clientes DROP COLUMN IF EXISTS whatsapp_checked_at;`);
      migrationLogger.info("Coluna whatsapp_checked_at removida ou não existente.");
    } catch (err) {
      migrationLogger.warn(`Erro ao remover whatsapp_checked_at, continuando...: ${err}`);
    }

    // Remover coluna has_whatsapp se existir
    try {
      await db.execute(sql`ALTER TABLE clientes DROP COLUMN IF EXISTS has_whatsapp;`);
      migrationLogger.info("Coluna has_whatsapp removida ou não existente.");
    } catch (err) {
      migrationLogger.warn(`Erro ao remover has_whatsapp, continuando...: ${err}`);
    }

    // Remover coluna profile_picture se existir
    try {
      await db.execute(sql`ALTER TABLE clientes DROP COLUMN IF EXISTS profile_picture;`);
      migrationLogger.info("Coluna profile_picture removida ou não existente.");
    } catch (err) {
      migrationLogger.warn(`Erro ao remover profile_picture, continuando...: ${err}`);
    }

    migrationLogger.info("Processo de remoção das colunas concluído.");
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao remover colunas relacionadas ao WhatsApp: ${error}`);
    return false;
  }
}
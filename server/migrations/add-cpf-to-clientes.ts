import { sql } from "drizzle-orm";
import { db } from "../database";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:CpfToClientes");

/**
 * Adiciona coluna cpf à tabela clientes
 * Esta migração adiciona um campo para armazenar o CPF do cliente
 * @returns true se a migração foi concluída com sucesso
 */
export async function addCpfToClientes(): Promise<boolean> {
  migrationLogger.info("Iniciando adição da coluna cpf à tabela clientes...");

  try {
    // Verificar se a coluna já existe
    const checkColumnExistsQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clientes' AND column_name = 'cpf'
    `;
    
    const result = await db.execute(checkColumnExistsQuery);
    
    // Verificar se há resultados
    const rows = (result as any).rows || result;
    if (rows.length === 0) {
      // A coluna não existe, então vamos adicioná-la
      const addColumnQuery = sql`
        ALTER TABLE clientes 
        ADD COLUMN cpf TEXT
      `;
      
      await db.execute(addColumnQuery);
      migrationLogger.info("Coluna cpf adicionada com sucesso à tabela clientes.");
    } else {
      migrationLogger.info("A coluna cpf já existe na tabela clientes.");
    }
    
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao adicionar coluna cpf: ${error}`);
    return false;
  }
}
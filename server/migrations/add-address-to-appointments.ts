import { db } from '../database';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:AddressToAppointments");

/**
 * Adiciona coluna address à tabela appointments
 * Esta migração adiciona um campo para armazenar o endereço completo do local do agendamento
 * @returns true se a migração foi concluída com sucesso
 */
export async function addAddressToAppointments(): Promise<boolean> {
  migrationLogger.info("Iniciando adição da coluna address à tabela appointments...");

  try {
    // Verificar se a coluna já existe
    const checkColumnExistsQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'appointments' AND column_name = 'address'
    `;
    
    const result = await db.execute(checkColumnExistsQuery);
    
    // Verificar se há resultados
    const rows = (result as any).rows || result;
    if (rows.length === 0) {
      // A coluna não existe, então vamos adicioná-la
      const addColumnQuery = sql`
        ALTER TABLE appointments 
        ADD COLUMN address TEXT
      `;
      
      await db.execute(addColumnQuery);
      migrationLogger.info("Coluna address adicionada com sucesso à tabela appointments.");
    } else {
      migrationLogger.info("A coluna address já existe na tabela appointments.");
    }
    
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao adicionar coluna address: ${error}`);
    return false;
  }
}
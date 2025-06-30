import { db } from '../database';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:BrokerIdToAppointments");

/**
 * Adiciona coluna broker_id à tabela appointments
 * Esta migração adiciona um campo para associar agendamentos a corretores
 * @returns true se a migração foi concluída com sucesso
 */
export async function addBrokerIdToAppointments(): Promise<boolean> {
  migrationLogger.info("Iniciando adição da coluna broker_id à tabela appointments...");

  try {
    // Verificar se a coluna já existe
    const checkColumnExistsQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'appointments' AND column_name = 'broker_id'
    `;
    
    const result = await db.execute(checkColumnExistsQuery);
    
    // Verificar se há resultados
    const rows = (result as any).rows || result;
    if (rows.length === 0) {
      // A coluna não existe, então vamos adicioná-la
      const addColumnQuery = sql`
        ALTER TABLE appointments 
        ADD COLUMN broker_id INTEGER REFERENCES users(id)
      `;
      
      await db.execute(addColumnQuery);
      migrationLogger.info("Coluna broker_id adicionada com sucesso à tabela appointments.");
    } else {
      migrationLogger.info("A coluna broker_id já existe na tabela appointments.");
    }
    
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao adicionar coluna broker_id: ${error}`);
    return false;
  }
}
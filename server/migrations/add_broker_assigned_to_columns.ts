import { logger } from '../utils/logger';
import { db } from '../database';
import { sql } from 'drizzle-orm';

/**
 * Migração para adicionar as colunas broker_id e assigned_to nas tabelas clientes_visitas,
 * adicionar assigned_to na tabela clientes_vendas e também na tabela clientes_agendamentos
 */
export async function runMigration() {
  logger.info('[Migration:AddBrokerAssignedToColumns] Iniciando migração para adicionar colunas de broker_id e assigned_to...');
  
  try {
    // Verificar se a coluna broker_id já existe na tabela clientes_visitas
    const checkBrokerIdInVisits = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clientes_visitas' AND column_name = 'broker_id'
    `);
    
    if (!checkBrokerIdInVisits.rows || checkBrokerIdInVisits.rows.length === 0) {
      // Adicionar coluna broker_id na tabela clientes_visitas
      await db.execute(sql`
        ALTER TABLE clientes_visitas
        ADD COLUMN broker_id INTEGER REFERENCES sistema_users(id)
      `);
      logger.info('[Migration:AddBrokerAssignedToColumns] Coluna broker_id adicionada à tabela clientes_visitas');
    } else {
      logger.info('[Migration:AddBrokerAssignedToColumns] Coluna broker_id já existe na tabela clientes_visitas');
    }
    
    // Verificar se a coluna assigned_to já existe na tabela clientes_visitas
    const checkAssignedToInVisits = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clientes_visitas' AND column_name = 'assigned_to'
    `);
    
    if (!checkAssignedToInVisits.rows || checkAssignedToInVisits.rows.length === 0) {
      // Adicionar coluna assigned_to na tabela clientes_visitas
      await db.execute(sql`
        ALTER TABLE clientes_visitas
        ADD COLUMN assigned_to INTEGER REFERENCES sistema_users(id)
      `);
      logger.info('[Migration:AddBrokerAssignedToColumns] Coluna assigned_to adicionada à tabela clientes_visitas');
    } else {
      logger.info('[Migration:AddBrokerAssignedToColumns] Coluna assigned_to já existe na tabela clientes_visitas');
    }
    
    // Verificar se a coluna assigned_to já existe na tabela clientes_vendas
    const checkAssignedToInSales = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clientes_vendas' AND column_name = 'assigned_to'
    `);
    
    if (!checkAssignedToInSales.rows || checkAssignedToInSales.rows.length === 0) {
      // Adicionar coluna assigned_to na tabela clientes_vendas
      await db.execute(sql`
        ALTER TABLE clientes_vendas
        ADD COLUMN assigned_to INTEGER REFERENCES sistema_users(id)
      `);
      logger.info('[Migration:AddBrokerAssignedToColumns] Coluna assigned_to adicionada à tabela clientes_vendas');
    } else {
      logger.info('[Migration:AddBrokerAssignedToColumns] Coluna assigned_to já existe na tabela clientes_vendas');
    }
    
    // Verificar se a coluna assigned_to já existe na tabela clientes_agendamentos
    const checkAssignedToInAppointments = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clientes_agendamentos' AND column_name = 'assigned_to'
    `);
    
    if (!checkAssignedToInAppointments.rows || checkAssignedToInAppointments.rows.length === 0) {
      // Adicionar coluna assigned_to na tabela clientes_agendamentos
      await db.execute(sql`
        ALTER TABLE clientes_agendamentos
        ADD COLUMN assigned_to INTEGER REFERENCES sistema_users(id)
      `);
      logger.info('[Migration:AddBrokerAssignedToColumns] Coluna assigned_to adicionada à tabela clientes_agendamentos');
    } else {
      logger.info('[Migration:AddBrokerAssignedToColumns] Coluna assigned_to já existe na tabela clientes_agendamentos');
    }
    
    logger.info('[Migration:AddBrokerAssignedToColumns] Migração concluída com sucesso!');
    return true;
  } catch (error) {
    logger.error(`[Migration:AddBrokerAssignedToColumns] Erro na migração: ${error}`);
    throw error;
  }
}
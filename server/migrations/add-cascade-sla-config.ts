import { executeSQL } from '../database';
import { logger } from '../utils/logger';

/**
 * Migração para adicionar configurações de SLA em cascata
 */
export async function addCascadeSLAConfig(): Promise<void> {
  try {
    logger.info('Adicionando configurações de SLA em cascata...');

    // Verificar se as colunas já existem
    const columnsExist = await executeSQL(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sistema_config_automacao_leads' 
      AND column_name IN ('cascade_sla_hours', 'cascade_user_order');
    `);

    if (columnsExist.rows && columnsExist.rows.length >= 2) {
      logger.info('Colunas de SLA em cascata já existem, pulando migração.');
      return;
    }

    // Adicionar coluna cascade_sla_hours se não existir
    const slaHoursExists = columnsExist.rows?.some((row: any) => row.column_name === 'cascade_sla_hours');
    if (!slaHoursExists) {
      await executeSQL(`
        ALTER TABLE sistema_config_automacao_leads 
        ADD COLUMN cascade_sla_hours INTEGER DEFAULT 24;
      `);
      logger.info('Coluna cascade_sla_hours adicionada.');
    }

    // Adicionar coluna cascade_user_order se não existir
    const userOrderExists = columnsExist.rows?.some((row: any) => row.column_name === 'cascade_user_order');
    if (!userOrderExists) {
      await executeSQL(`
        ALTER TABLE sistema_config_automacao_leads 
        ADD COLUMN cascade_user_order JSONB DEFAULT '[]'::jsonb;
      `);
      logger.info('Coluna cascade_user_order adicionada.');
    }

    logger.info('Configurações de SLA em cascata adicionadas com sucesso!');

  } catch (error) {
    logger.error(`Erro ao adicionar configurações de SLA em cascata: ${error}`);
    throw error;
  }
}
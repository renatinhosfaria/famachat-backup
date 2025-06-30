/**
 * Migração para remover colunas não utilizadas da tabela sistema_config_automacao_leads
 */

import * as pg from 'pg';
import { logger } from '../utils/logger';

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:RemoveUnusedColumns");

export const migrationName = 'remove_unused_columns_from_automation';
export const migrationDescription = 'Remove colunas não utilizadas da tabela sistema_config_automacao_leads';

export async function up(client: pg.Client) {
  migrationLogger.info('Iniciando remoção de colunas não utilizadas da tabela sistema_config_automacao_leads...');

  try {
    // Iniciando transação
    await client.query('BEGIN');

    // Lista de colunas a serem removidas
    const columnsToRemove = [
      'notify_visual',
      'notify_system',
      'notify_manager',
      'escalate_to_manager',
      'centralized_comm',
      'custom_rules',
      'identify_by_document',
      'based_on_time',
      'based_on_outcome',
      'use_specialty'
    ];

    // Removendo cada coluna
    for (const column of columnsToRemove) {
      migrationLogger.info(`Removendo coluna ${column}...`);
      try {
        await client.query(`ALTER TABLE sistema_config_automacao_leads DROP COLUMN IF EXISTS ${column}`);
        migrationLogger.info(`Coluna ${column} removida com sucesso.`);
      } catch (error) {
        migrationLogger.error(`Erro ao remover coluna ${column}: ${error}`);
        throw error;
      }
    }

    // Commit da transação
    await client.query('COMMIT');
    migrationLogger.info('Remoção de colunas concluída com sucesso.');
    return true;
  } catch (error) {
    // Em caso de erro, fazer rollback
    await client.query('ROLLBACK');
    migrationLogger.error(`Erro ao remover colunas da tabela sistema_config_automacao_leads: ${error}`);
    throw error;
  }
}

export async function down(client: pg.Client) {
  // Esta migração não pode ser revertida, pois envolve perda de dados
  migrationLogger.warn('Esta migração não pode ser revertida (down não implementado).');
  return true;
}
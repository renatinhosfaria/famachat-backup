/**
 * Migração para remover colunas adicionais da tabela sistema_config_automacao_leads
 */
import * as pg from 'pg';
import { logger } from '../utils/logger';

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:RemoveMoreAutomationColumns");

export const migrationName = 'remove_more_automation_columns';
export const migrationDescription = 'Remove colunas adicionais da tabela sistema_config_automacao_leads';

/**
 * Remove as colunas:
 * - working_hours_start
 * - use_region
 * - use_availability
 * - working_hours_end
 * - working_hours_weekend
 * - identify_by_email
 * - identify_by_phone
 * - keep_same_consultant
 * - assign_new_consultant
 * - inactivity_period
 * - contact_attempts
 * - created_by
 */
export async function up(client: pg.Client) {
  migrationLogger.info('Removendo colunas adicionais da tabela sistema_config_automacao_leads...');

  try {
    // Executar a alteração no schema para remover as colunas
    await client.query(`
    ALTER TABLE sistema_config_automacao_leads
    DROP COLUMN working_hours_start,
    DROP COLUMN use_region,
    DROP COLUMN use_availability,
    DROP COLUMN working_hours_end,
    DROP COLUMN working_hours_weekend,
    DROP COLUMN identify_by_email,
    DROP COLUMN identify_by_phone,
    DROP COLUMN keep_same_consultant,
    DROP COLUMN assign_new_consultant,
    DROP COLUMN inactivity_period,
    DROP COLUMN contact_attempts,
    DROP COLUMN created_by;
  `);

    migrationLogger.info('Colunas adicionais da tabela sistema_config_automacao_leads removidas com sucesso!');
  } catch (error) {
    migrationLogger.error(`Erro ao remover colunas adicionais: ${error}`);
    throw error;
  }
}

/**
 * Restaura as colunas removidas
 */
export async function down(client: pg.Client) {
  migrationLogger.info('Restaurando colunas adicionais da tabela sistema_config_automacao_leads...');

  try {
    // Executar a alteração no schema para restaurar as colunas
    await client.query(`
    ALTER TABLE sistema_config_automacao_leads
    ADD COLUMN working_hours_start TEXT DEFAULT '08:00',
    ADD COLUMN use_region BOOLEAN DEFAULT FALSE,
    ADD COLUMN use_availability BOOLEAN DEFAULT TRUE,
    ADD COLUMN working_hours_end TEXT DEFAULT '18:00',
    ADD COLUMN working_hours_weekend BOOLEAN DEFAULT FALSE,
    ADD COLUMN identify_by_email BOOLEAN DEFAULT TRUE,
    ADD COLUMN identify_by_phone BOOLEAN DEFAULT TRUE,
    ADD COLUMN keep_same_consultant BOOLEAN DEFAULT TRUE,
    ADD COLUMN assign_new_consultant BOOLEAN DEFAULT FALSE,
    ADD COLUMN inactivity_period INTEGER DEFAULT 30,
    ADD COLUMN contact_attempts INTEGER DEFAULT 3,
    ADD COLUMN created_by INTEGER REFERENCES sistema_users(id);
  `);

    migrationLogger.info('Colunas adicionais da tabela sistema_config_automacao_leads restauradas com sucesso!');
  } catch (error) {
    migrationLogger.error(`Erro ao restaurar colunas adicionais: ${error}`);
    throw error;
  }
}
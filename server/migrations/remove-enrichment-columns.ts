/**
 * Migração para remover colunas relacionadas ao "Enriquecimento Automático"
 * que foi completamente removido da aplicação
 */

import * as pg from 'pg';
import { logger } from '../utils/logger';

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:RemoveEnrichmentColumns");

export const migrationName = 'remove_enrichment_columns';
export const migrationDescription = 'Remove colunas de enriquecimento automático não utilizadas';

export async function up(client: pg.Client) {
  migrationLogger.info('Iniciando remoção de colunas de enriquecimento automático...');

  try {
    // Remover cada coluna separadamente para evitar problemas de sintaxe
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" DROP COLUMN IF EXISTS "keep_history";`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" DROP COLUMN IF EXISTS "keep_tags";`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" DROP COLUMN IF EXISTS "auto_scoring";`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" DROP COLUMN IF EXISTS "welcome_message";`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" DROP COLUMN IF EXISTS "reminders";`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" DROP COLUMN IF EXISTS "reengagement";`);

    migrationLogger.info('Colunas removidas com sucesso!');
  } catch (error) {
    migrationLogger.error(`Erro ao remover colunas de enriquecimento automático: ${error}`);
    throw error;
  }
}

export async function down(client: pg.Client) {
  migrationLogger.info('Executando rollback da remoção de colunas...');

  try {
    // Adicionar cada coluna separadamente para evitar problemas de sintaxe
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" ADD COLUMN IF NOT EXISTS "keep_history" BOOLEAN DEFAULT true;`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" ADD COLUMN IF NOT EXISTS "keep_tags" BOOLEAN DEFAULT true;`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" ADD COLUMN IF NOT EXISTS "auto_scoring" BOOLEAN DEFAULT false;`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" ADD COLUMN IF NOT EXISTS "welcome_message" BOOLEAN DEFAULT false;`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" ADD COLUMN IF NOT EXISTS "reminders" BOOLEAN DEFAULT false;`);
    await client.query(`ALTER TABLE "sistema_config_automacao_leads" ADD COLUMN IF NOT EXISTS "reengagement" BOOLEAN DEFAULT false;`);

    migrationLogger.info('Colunas restauradas com sucesso!');
  } catch (error) {
    migrationLogger.error(`Erro ao restaurar colunas de enriquecimento automático: ${error}`);
    throw error;
  }
}
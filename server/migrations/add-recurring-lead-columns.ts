import { db } from '../database';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

// Initialize logger for this specific migration
const migrationLogger = logger.createLogger("Migration:RecurringLeadColumns");

/**
 * Adiciona colunas para identificação e tratamento de leads recorrentes
 * na tabela sistema_config_automacao_leads
 */
export async function addRecurringLeadColumnsToAutomation() {
  try {
    migrationLogger.info('Iniciando migração para adicionar colunas de lead recorrente...');
    
    // Verificar se as colunas já existem antes de adicionar
    const existingColumns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sistema_config_automacao_leads'
    `);
    
    // @ts-ignore - compatibilidade com diferentes versões do driver
    const rows = existingColumns.rows || existingColumns;
    const columnNames = rows.map((row: any) => row.column_name);
    
    // Adicionar coluna byName se não existir
    if (!columnNames.includes('by_name')) {
      await db.execute(sql`
        ALTER TABLE sistema_config_automacao_leads
        ADD COLUMN by_name BOOLEAN DEFAULT true
      `);
      migrationLogger.info('Coluna by_name adicionada com sucesso.');
    } else {
      migrationLogger.info('Coluna by_name já existe, pulando...');
    }
    
    // Adicionar coluna byPhone se não existir
    if (!columnNames.includes('by_phone')) {
      await db.execute(sql`
        ALTER TABLE sistema_config_automacao_leads
        ADD COLUMN by_phone BOOLEAN DEFAULT true
      `);
      migrationLogger.info('Coluna by_phone adicionada com sucesso.');
    } else {
      migrationLogger.info('Coluna by_phone já existe, pulando...');
    }
    
    // Adicionar coluna byEmail se não existir
    if (!columnNames.includes('by_email')) {
      await db.execute(sql`
        ALTER TABLE sistema_config_automacao_leads
        ADD COLUMN by_email BOOLEAN DEFAULT true
      `);
      migrationLogger.info('Coluna by_email adicionada com sucesso.');
    } else {
      migrationLogger.info('Coluna by_email já existe, pulando...');
    }
    
    // Adicionar coluna keepSameConsultant se não existir
    if (!columnNames.includes('keep_same_consultant')) {
      await db.execute(sql`
        ALTER TABLE sistema_config_automacao_leads
        ADD COLUMN keep_same_consultant BOOLEAN DEFAULT true
      `);
      migrationLogger.info('Coluna keep_same_consultant adicionada com sucesso.');
    } else {
      migrationLogger.info('Coluna keep_same_consultant já existe, pulando...');
    }
    
    // Adicionar coluna assignNewConsultant se não existir
    if (!columnNames.includes('assign_new_consultant')) {
      await db.execute(sql`
        ALTER TABLE sistema_config_automacao_leads
        ADD COLUMN assign_new_consultant BOOLEAN DEFAULT false
      `);
      migrationLogger.info('Coluna assign_new_consultant adicionada com sucesso.');
    } else {
      migrationLogger.info('Coluna assign_new_consultant já existe, pulando...');
    }
    
    migrationLogger.info('Migração de colunas de leads recorrentes concluída com sucesso.');
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao executar a migração de colunas de leads recorrentes: ${error}`);
    throw error;
  }
}
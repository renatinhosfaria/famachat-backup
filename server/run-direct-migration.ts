/**
 * Script para execução direta de migração para a tabela sistema_config_automacao_leads
 */

import { pool, tableExists } from './database';
import { DistributionMethodEnum } from '../shared/schema';
import { log, LogLevel } from './utils';

async function createAutomacaoLeadsTable() {
  const client = await pool.connect();
  
  try {
    // Verificar se a tabela já existe
    const exists = await tableExists('sistema_config_automacao_leads');
    
    if (exists) {
      log('Tabela sistema_config_automacao_leads já existe.', LogLevel.INFO);
      return true;
    }
    
    log('Iniciando criação da tabela sistema_config_automacao_leads...', LogLevel.INFO);
    
    // Iniciar transação
    await client.query('BEGIN');
    
    // Criar a tabela
    await client.query(`
      CREATE TABLE IF NOT EXISTS "sistema_config_automacao_leads" (
        "id" SERIAL PRIMARY KEY,
        "active" BOOLEAN DEFAULT true,
        "name" TEXT NOT NULL,
        "distribution_method" TEXT DEFAULT '${DistributionMethodEnum.VOLUME}',
        "use_specialty" BOOLEAN DEFAULT false,
        "use_availability" BOOLEAN DEFAULT true,
        "use_region" BOOLEAN DEFAULT false,
        "working_hours_start" TEXT DEFAULT '08:00',
        "working_hours_end" TEXT DEFAULT '18:00',
        "working_hours_weekend" BOOLEAN DEFAULT false,
        "first_contact_sla" INTEGER DEFAULT 30,
        "warning_percentage" INTEGER DEFAULT 75,
        "critical_percentage" INTEGER DEFAULT 90,
        "notify_visual" BOOLEAN DEFAULT true,
        "notify_system" BOOLEAN DEFAULT false,
        "notify_manager" BOOLEAN DEFAULT false,
        "auto_redistribute" BOOLEAN DEFAULT false,
        "escalate_to_manager" BOOLEAN DEFAULT false,
        "identify_by_email" BOOLEAN DEFAULT true,
        "identify_by_phone" BOOLEAN DEFAULT true,
        "identify_by_document" BOOLEAN DEFAULT false,
        "keep_same_consultant" BOOLEAN DEFAULT true,
        "assign_new_consultant" BOOLEAN DEFAULT false,
        "based_on_time" BOOLEAN DEFAULT false,
        "based_on_outcome" BOOLEAN DEFAULT false,
        "keep_history" BOOLEAN DEFAULT true,
        "keep_tags" BOOLEAN DEFAULT true,
        "auto_scoring" BOOLEAN DEFAULT false,
        "welcome_message" BOOLEAN DEFAULT false,
        "reminders" BOOLEAN DEFAULT false,
        "reengagement" BOOLEAN DEFAULT false,
        "centralized_comm" BOOLEAN DEFAULT true,
        "inactivity_period" INTEGER DEFAULT 30,
        "contact_attempts" INTEGER DEFAULT 3,
        "custom_rules" JSONB,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW(),
        "created_by" INTEGER REFERENCES "sistema_users"("id")
      );
    `);
    
    // Inserir configuração padrão
    await client.query(`
      INSERT INTO "sistema_config_automacao_leads" (
        name, 
        active,
        distribution_method,
        working_hours_start,
        working_hours_end,
        first_contact_sla
      ) VALUES (
        'Configuração Padrão',
        true,
        '${DistributionMethodEnum.VOLUME}',
        '08:00',
        '18:00',
        30
      ) ON CONFLICT DO NOTHING;
    `);
    
    // Confirmar transação
    await client.query('COMMIT');
    
    log('Tabela sistema_config_automacao_leads criada com sucesso!', LogLevel.INFO);
    return true;
  } catch (error) {
    // Em caso de erro, fazer rollback
    await client.query('ROLLBACK');
    log(`Erro ao criar tabela sistema_config_automacao_leads: ${error}`, LogLevel.ERROR);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    log('Iniciando migração direta...', LogLevel.INFO);
    await createAutomacaoLeadsTable();
    log('Migração direta concluída com sucesso!', LogLevel.INFO);
    process.exit(0);
  } catch (error) {
    log(`Erro durante migração direta: ${error}`, LogLevel.ERROR);
    process.exit(1);
  }
}

// Executar o script
main();
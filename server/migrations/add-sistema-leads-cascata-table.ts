import { db, executeSQL } from '../database';
import { logger } from '../utils/logger';

/**
 * Migração para criar a tabela sistema_leads_cascata
 * Sistema de SLA em cascata para múltiplos atendimentos por cliente
 */
export async function addSistemaLeadsCascataTable(): Promise<void> {
  const migrationLogger = logger.createLogger("AddSistemaLeadsCascataTable");
  
  try {
    migrationLogger.info("Iniciando criação da tabela sistema_leads_cascata...");

    // Verificar se a tabela já existe
    const tableExistsResult = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sistema_leads_cascata'
      );
    `);

    if (tableExistsResult.rows && tableExistsResult.rows.length > 0 && tableExistsResult.rows[0].exists) {
      migrationLogger.info("Tabela sistema_leads_cascata já existe, pulando criação.");
      return;
    }

    // Criar a tabela sistema_leads_cascata
    await executeSQL(`
      CREATE TABLE sistema_leads_cascata (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        lead_id INTEGER REFERENCES sistema_leads(id) ON DELETE SET NULL,
        user_id INTEGER NOT NULL REFERENCES sistema_users(id) ON DELETE CASCADE,
        sequencia INTEGER NOT NULL,
        status TEXT DEFAULT 'Ativo',
        sla_horas INTEGER DEFAULT 24,
        iniciado_em TIMESTAMP DEFAULT NOW(),
        expira_em TIMESTAMP NOT NULL,
        finalizado_em TIMESTAMP,
        motivo TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Criar índices para otimizar consultas
    await executeSQL(`
      CREATE INDEX idx_sistema_leads_cascata_cliente_id ON sistema_leads_cascata(cliente_id);
    `);

    await executeSQL(`
      CREATE INDEX idx_sistema_leads_cascata_user_id ON sistema_leads_cascata(user_id);
    `);

    await executeSQL(`
      CREATE INDEX idx_sistema_leads_cascata_status ON sistema_leads_cascata(status);
    `);

    await executeSQL(`
      CREATE INDEX idx_sistema_leads_cascata_expira_em ON sistema_leads_cascata(expira_em);
    `);

    // Índice composto para buscar atendimentos ativos por cliente
    await executeSQL(`
      CREATE INDEX idx_sistema_leads_cascata_cliente_status ON sistema_leads_cascata(cliente_id, status);
    `);

    migrationLogger.info("Tabela sistema_leads_cascata criada com sucesso!");
    migrationLogger.info("Índices criados para otimização de consultas.");

  } catch (error) {
    migrationLogger.error(`Erro ao criar tabela sistema_leads_cascata: ${error}`);
    throw error;
  }
}
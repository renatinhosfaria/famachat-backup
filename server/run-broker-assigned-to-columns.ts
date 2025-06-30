/**
 * Este script executa a migração para adicionar as colunas broker_id e assigned_to
 * nas tabelas de visitas e vendas
 */

import { runMigration } from './migrations/add_broker_assigned_to_columns';
import { logger } from './utils/logger';

async function main() {
  logger.info('Iniciando migração para adicionar colunas broker_id e assigned_to...');
  
  try {
    const result = await runMigration();
    
    if (result) {
      logger.info('Migração concluída com sucesso!');
      process.exit(0);
    } else {
      logger.error('Falha na migração.');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Erro ao executar migração: ${error}`);
    process.exit(1);
  }
}

main();
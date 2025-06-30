import { Pool } from 'pg';
import { logger } from './utils/logger';
import { addDevelopmentNameToSales } from './migrations/add-development-name-to-sales';

const migrationLogger = logger.createLogger('RunDevelopmentNameMigration');

async function runMigration() {
  migrationLogger.info('Iniciando migração para adicionar coluna development_name à tabela clientes_vendas');

  try {
    const result = await addDevelopmentNameToSales();
    if (result) {
      migrationLogger.info('Migração concluída com sucesso!');
    } else {
      migrationLogger.error('Falha ao executar a migração.');
      process.exit(1);
    }
  } catch (error) {
    migrationLogger.error(`Erro durante a execução da migração: ${error}`);
    process.exit(1);
  }
}

// Executar a migração
runMigration()
  .then(() => {
    migrationLogger.info('Script de migração finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    migrationLogger.error(`Erro ao executar script de migração: ${error}`);
    process.exit(1);
  });
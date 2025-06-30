import { sql } from 'drizzle-orm';
import { db } from '../database';
import { logger } from '../utils/logger';

const migrationLogger = logger.createLogger('Migration:SalesDevName');

/**
 * Adiciona a coluna development_name à tabela clientes_vendas
 */
export async function addDevelopmentNameToSales(): Promise<boolean> {
  try {
    migrationLogger.info('Iniciando adição da coluna development_name à tabela clientes_vendas...');
    
    // Verificar se a coluna já existe
    const checkColumnResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clientes_vendas' AND column_name = 'development_name'
    `);
    
    // Se a coluna já existir, não precisamos criar novamente
    if (checkColumnResult.rows.length > 0) {
      migrationLogger.info('A coluna development_name já existe na tabela clientes_vendas.');
      return true;
    }
    
    // Adicionar a coluna
    await db.execute(sql`
      ALTER TABLE clientes_vendas 
      ADD COLUMN development_name TEXT
    `);
    
    // Adicionar comentário à coluna para documentação
    await db.execute(sql`
      COMMENT ON COLUMN clientes_vendas.development_name 
      IS 'Nome do empreendimento imobiliário'
    `);
    
    migrationLogger.info('Coluna development_name adicionada com sucesso à tabela clientes_vendas!');
    return true;
  } catch (error) {
    migrationLogger.error(`Erro ao adicionar coluna development_name: ${error}`);
    return false;
  }
}
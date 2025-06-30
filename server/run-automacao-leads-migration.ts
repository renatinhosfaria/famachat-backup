import { db } from "./db";
import { up } from "./migrations/add-automacao-leads-table";
import { log, LogLevel } from "./utils";

/**
 * Script para executar especificamente a migração de automação de leads
 */
async function main() {
  try {
    log("Iniciando migração para adicionar tabela de automação de leads...", LogLevel.INFO);
    
    // Obter conexão com PostgreSQL
    const { pool } = await import('./db-direct');
    const client = await pool.connect();
    
    try {
      // Iniciar uma transação
      await client.query('BEGIN');

      // Executar a migração
      await up(client);
      
      // Confirmando a transação
      await client.query('COMMIT');
      
      log("Migração da tabela de automação de leads concluída com sucesso", LogLevel.INFO);
    } catch (error) {
      // Em caso de erro, fazer rollback da transação
      await client.query('ROLLBACK');
      log(`Erro durante migração: ${error}`, LogLevel.ERROR);
      throw error;
    } finally {
      // Liberar o cliente de volta para o pool
      client.release();
    }
    
    log("Finalizando script de migração", LogLevel.INFO);
    process.exit(0);
  } catch (error) {
    log(`Erro durante execução da migração: ${error}`, LogLevel.ERROR);
    process.exit(1);
  }
}

// Executar o script
main();
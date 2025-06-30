/**
 * Script para executar a migração de exclusão em cascata
 * Esta migração adiciona a restrição ON DELETE CASCADE a todas as tabelas que referenciam usuários
 */

import { db } from "./database";
import { logger } from "./utils/logger";

// Inicializa o logger para este script
const cascadeMigrationLogger = logger.createLogger("Migration:Cascade");
import { addCascadeDeleteToUsers } from "./migrations/add-cascade-delete-to-users";
import { sql } from "drizzle-orm";

/**
 * Verifica a estrutura da tabela migrations
 */
async function checkMigrationsTable(): Promise<{ hasDescription: boolean }> {
  try {
    const columnsResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'migrations' AND column_name = 'description';
    `);
    
    const hasDescription = columnsResult && 
                        (columnsResult as any).rows && 
                        (columnsResult as any).rows.length > 0;
    
    return { hasDescription };
  } catch (error) {
    cascadeMigrationLogger.error(`Erro ao verificar estrutura da tabela migrations: ${error}`);
    throw error;
  }
}

/**
 * Registra a migração como executada
 */
async function registerMigration(name: string, description: string): Promise<void> {
  try {
    // Verificar a estrutura da tabela
    const { hasDescription } = await checkMigrationsTable();
    
    if (hasDescription) {
      await db.execute(sql`
        INSERT INTO migrations (name, description) 
        VALUES (${name}, ${description})
        ON CONFLICT (name) DO NOTHING;
      `);
    } else {
      await db.execute(sql`
        INSERT INTO migrations (name) 
        VALUES (${name})
        ON CONFLICT (name) DO NOTHING;
      `);
    }
    
    cascadeMigrationLogger.info(`Migração ${name} registrada com sucesso.`);
  } catch (error) {
    cascadeMigrationLogger.error(`Erro ao registrar migração ${name}: ${error}`);
    throw error;
  }
}

/**
 * Função principal para executar a migração de cascade delete
 */
async function main() {
  try {
    cascadeMigrationLogger.info("Iniciando migração de exclusão em cascata para usuários...");
    
    // Executar diretamente a migração de cascade delete
    const result = await addCascadeDeleteToUsers();
    
    if (typeof result === 'object' && result !== null && 'success' in result) {
      if (!result.success) {
        throw new Error(result.message);
      }
      cascadeMigrationLogger.info(`Resultado da migração: ${result.message}`);
    } else if (typeof result === 'boolean' && !result) {
      throw new Error(`A migração falhou, retornando false`);
    }
    
    // Registrar a migração na tabela de migrações
    await registerMigration(
      "add_cascade_delete_to_users", 
      "Adiciona exclusão em cascata para registros relacionados a usuários"
    );
    
    cascadeMigrationLogger.info("Migração de exclusão em cascata concluída com sucesso!");
    process.exit(0);
  } catch (error) {
    cascadeMigrationLogger.error(`Erro ao executar migração: ${error}`);
    process.exit(1);
  }
}

// Executar a função principal
main();
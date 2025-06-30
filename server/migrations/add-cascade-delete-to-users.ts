import { db } from "../database";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

// Inicializa o logger para esta migração específica
const migrationLogger = logger.createLogger("Migration:CascadeDeleteToUsers");

/**
 * Adiciona exclusão em cascata para todas as tabelas que referenciam usuários
 * Isso permite que ao excluir um usuário, todos os registros relacionados sejam excluídos automaticamente
 */
export async function addCascadeDeleteToUsers(): Promise<void | boolean | { success: boolean; message: string }> {
  try {
    migrationLogger.info("Iniciando migração para adicionar exclusão em cascata às referências de usuários...");

    // Lista de todas as tabelas e colunas que referenciam users.id
    const foreignKeyReferences = [
      { table: "clientes", column: "assigned_to" },
      { table: "clientes", column: "broker_id" },
      { table: "appointments", column: "user_id" },
      { table: "appointments", column: "broker_id" },
      { table: "visits", column: "user_id" },
      { table: "sales", column: "user_id" },
      { table: "metrics", column: "user_id" },
      { table: "whatsapp_instances", column: "user_id" },
      { table: "leads", column: "assigned_to" } // Adicionando tabela legacy
    ];

    // Para cada referência, vamos remover a restrição existente e adicionar uma nova com ON DELETE CASCADE
    for (const ref of foreignKeyReferences) {
      migrationLogger.info(`Processando tabela ${ref.table}, coluna ${ref.column}...`);

      // 1. Verificar se a constraint existe usando a information_schema
      const constraintQuery = await db.execute(sql`
        SELECT tc.constraint_name AS conname
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = ${ref.table}
        AND kcu.column_name = ${ref.column}
        AND ccu.table_name = 'users';
      `);

      const constraints = (constraintQuery as any).rows || [];
      
      if (constraints.length === 0) {
        migrationLogger.info(`Nenhuma constraint encontrada para ${ref.table}.${ref.column}`);
        continue;
      }

      // Para cada constraint encontrada
      for (const constraint of constraints) {
        const constraintName = constraint.conname;
        
        migrationLogger.info(`Removendo constraint ${constraintName}...`);
        
        // 2. Remover a constraint existente
        await db.execute(sql`
          ALTER TABLE ${sql.raw(ref.table)}
          DROP CONSTRAINT IF EXISTS ${sql.raw(constraintName)};
        `);
        
        // 3. Adicionar a nova constraint com ON DELETE CASCADE
        const newConstraintName = `${ref.table}_${ref.column}_fkey_cascade`;
        
        migrationLogger.info(`Adicionando nova constraint ${newConstraintName} com ON DELETE CASCADE...`);
        
        await db.execute(sql`
          ALTER TABLE ${sql.raw(ref.table)}
          ADD CONSTRAINT ${sql.raw(newConstraintName)}
          FOREIGN KEY (${sql.raw(ref.column)})
          REFERENCES users(id)
          ON DELETE CASCADE;
        `);
        
        migrationLogger.info(`Constraint para ${ref.table}.${ref.column} atualizada com sucesso`);
      }
    }

    return {
      success: true,
      message: "Exclusão em cascata adicionada com sucesso a todas as referências de usuários"
    };
  } catch (error) {
    migrationLogger.error(`Erro ao adicionar exclusão em cascata: ${error}`);
    return {
      success: false,
      message: `Erro ao adicionar exclusão em cascata: ${error}`
    };
  }
}
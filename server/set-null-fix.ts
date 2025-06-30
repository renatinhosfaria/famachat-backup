import { db } from "./db";
import { sql } from "drizzle-orm";
import { log, LogLevel } from "./utils";

/**
 * Script para alterar as restrições de exclusão em cascata para SET NULL
 * Isso manterá os clientes quando um usuário for excluído
 */
async function main() {
  try {
    log("Iniciando correção das restrições ON DELETE...", LogLevel.INFO);
    
    // Lista de restrições para alterar
    const constraints = [
      { table: "clientes", column: "assigned_to", constraint: "clientes_assigned_to_fkey_cascade" },
      { table: "clientes", column: "broker_id", constraint: "clientes_broker_id_fkey_cascade" },
      { table: "appointments", column: "user_id", constraint: "appointments_user_id_fkey_cascade" },
      { table: "appointments", column: "broker_id", constraint: "appointments_broker_id_fkey_cascade" },
      { table: "visits", column: "user_id", constraint: "visits_user_id_fkey_cascade" },
      { table: "sales", column: "user_id", constraint: "sales_user_id_fkey_cascade" },
      { table: "metrics", column: "user_id", constraint: "metrics_user_id_fkey_cascade" },
      { table: "whatsapp_instances", column: "user_id", constraint: "whatsapp_instances_user_id_fkey_cascade" }
    ];

    for (const item of constraints) {
      log(`Processando ${item.table}.${item.column} (${item.constraint})...`, LogLevel.INFO);
      
      try {
        // Remover a constraint existente
        await db.execute(sql`
          ALTER TABLE ${sql.raw(item.table)}
          DROP CONSTRAINT IF EXISTS ${sql.raw(item.constraint)};
        `);
        
        log(`Constraint ${item.constraint} removida.`, LogLevel.INFO);
        
        // Adicionar a nova constraint com ON DELETE SET NULL
        const newConstraintName = `${item.table}_${item.column}_fkey_setnull`;
        
        await db.execute(sql`
          ALTER TABLE ${sql.raw(item.table)}
          ADD CONSTRAINT ${sql.raw(newConstraintName)}
          FOREIGN KEY (${sql.raw(item.column)})
          REFERENCES users(id)
          ON DELETE SET NULL;
        `);
        
        log(`Nova constraint ${newConstraintName} adicionada com sucesso (SET NULL).`, LogLevel.INFO);
      } catch (error) {
        log(`Erro ao processar ${item.table}.${item.column}: ${error}`, LogLevel.ERROR);
      }
    }
    
    log("Correção das restrições ON DELETE concluída.", LogLevel.INFO);
  } catch (error) {
    log(`Erro geral: ${error}`, LogLevel.ERROR);
  }
}

main().catch(console.error);
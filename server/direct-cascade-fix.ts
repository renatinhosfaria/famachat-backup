import { db } from "./database";
import { sql } from "drizzle-orm";
import { logger } from "./utils/logger";

// Inicializa o logger para este script
const cascadeFixLogger = logger.createLogger("CascadeFix");

/**
 * Script para adicionar exclusão em cascata diretamente para referências de usuários
 */
async function main() {
  try {
    cascadeFixLogger.info("Iniciando correção direta de exclusão em cascata...");
    
    // Lista de restrições de chave estrangeira conhecidas
    const constraints = [
      { table: "clientes", column: "assigned_to", constraint: "leads_assigned_to_fkey" },
      { table: "appointments", column: "user_id", constraint: "appointments_user_id_fkey" },
      { table: "visits", column: "user_id", constraint: "visits_user_id_fkey" },
      { table: "sales", column: "user_id", constraint: "sales_user_id_fkey" },
      { table: "metrics", column: "user_id", constraint: "metrics_user_id_fkey" },
      { table: "appointments", column: "broker_id", constraint: "appointments_broker_id_fkey" },
      { table: "leads", column: "assigned_to", constraint: "leads_assigned_to_fkey1" },
      { table: "clientes", column: "broker_id", constraint: "clientes_broker_id_fkey" },
      { table: "whatsapp_instances", column: "user_id", constraint: "whatsapp_instances_user_id_fkey" }
    ];

    for (const item of constraints) {
      cascadeFixLogger.info(`Processando ${item.table}.${item.column} (${item.constraint})...`);
      
      try {
        // Remover a constraint existente
        await db.execute(sql`
          ALTER TABLE ${sql.raw(item.table)}
          DROP CONSTRAINT IF EXISTS ${sql.raw(item.constraint)};
        `);
        
        cascadeFixLogger.info(`Constraint ${item.constraint} removida.`);
        
        // Adicionar a nova constraint com ON DELETE CASCADE
        const newConstraintName = `${item.table}_${item.column}_fkey_cascade`;
        
        await db.execute(sql`
          ALTER TABLE ${sql.raw(item.table)}
          ADD CONSTRAINT ${sql.raw(newConstraintName)}
          FOREIGN KEY (${sql.raw(item.column)})
          REFERENCES users(id)
          ON DELETE CASCADE;
        `);
        
        cascadeFixLogger.info(`Nova constraint ${newConstraintName} adicionada com sucesso.`);
      } catch (error) {
        cascadeFixLogger.error(`Erro ao processar ${item.table}.${item.column}: ${error}`);
      }
    }
    
    cascadeFixLogger.info("Correção direta de exclusão em cascata concluída.");
  } catch (error) {
    cascadeFixLogger.error(`Erro geral: ${error}`);
  }
}

main().catch(error => {
  cascadeFixLogger.error(`Erro na execução principal: ${error}`);
  process.exit(1);
});
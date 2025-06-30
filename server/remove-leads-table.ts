import { db } from "./db";
import { sql } from "drizzle-orm";
import { log, LogLevel } from "./utils";

/**
 * Script para remover a tabela leads legada
 */
async function main() {
  try {
    log("Iniciando remoção da tabela leads legada...", LogLevel.INFO);
    
    // Verificar se a tabela existe (direto)
    try {
      // Verificando se existem dados
      // Verificando se existem dados
      const countResult = await db.execute(sql`SELECT COUNT(*) FROM leads;`);
      const count = parseInt((countResult as any).rows?.[0]?.count || "0");
      
      if (count > 0) {
        log(`A tabela leads contém ${count} registros. Confirme antes de excluir.`, LogLevel.WARN);
      } else {
        // Remover a foreign key constraint primeiro
        try {
          await db.execute(sql`
            ALTER TABLE leads
            DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey_cascade;
          `);
          log("Constraint removida com sucesso.", LogLevel.INFO);
        } catch (error) {
          log(`Erro ao remover constraint: ${error}`, LogLevel.ERROR);
        }
        
        // Excluir a tabela
        await db.execute(sql`DROP TABLE leads;`);
        log("Tabela leads removida com sucesso!", LogLevel.INFO);
      }
    } else {
      log("A tabela leads não existe.", LogLevel.WARN);
    }
    
  } catch (error) {
    log(`Erro ao remover tabela leads: ${error}`, LogLevel.ERROR);
  }
}

main().catch(console.error);
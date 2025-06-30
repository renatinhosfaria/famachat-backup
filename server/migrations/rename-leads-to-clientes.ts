import { db } from "../database";
import { sql } from "drizzle-orm";
import { registerMigration } from "./index";
import { log } from "../utils";

async function renameLeadsToClientes(): Promise<void> {
  try {
    log("Iniciando migração para renomear leads para clientes...", "info");

    // Verificar se a tabela leads existe
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'leads'
      );
    `;
    
    const result = await db.execute(sql.raw(checkTableQuery));
    const tableExists = result && (result as any).rows && (result as any).rows[0] && (result as any).rows[0].exists;
    
    if (!tableExists) {
      log("A tabela leads não existe. Pulando migração.", "info");
      return;
    }

    // Verificar se a tabela clientes já existe
    const checkClientesTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'clientes'
      );
    `;
    
    const clientesResult = await db.execute(sql.raw(checkClientesTableQuery));
    const clientesTableExists = clientesResult && 
                              (clientesResult as any).rows && 
                              (clientesResult as any).rows[0] && 
                              (clientesResult as any).rows[0].exists;
    
    if (clientesTableExists) {
      log("A tabela clientes já existe. Pulando migração.", "info");
      return;
    }

    // Renomear a tabela leads para clientes
    log("Renomeando tabela leads para clientes...", "info");
    const renameTableQuery = `ALTER TABLE leads RENAME TO clientes;`;
    await db.execute(sql.raw(renameTableQuery));
    log("Tabela leads renomeada para clientes com sucesso.", "info");

    // Atualizar referências nas tabelas relacionadas
    const updateReferencesTablesQueries = [
      {
        table: "appointments",
        column: "lead_id",
        newColumn: "cliente_id",
        query: `
          ALTER TABLE appointments 
          RENAME COLUMN lead_id TO cliente_id;
        `
      },
      {
        table: "visits",
        column: "lead_id",
        newColumn: "cliente_id",
        query: `
          ALTER TABLE visits 
          RENAME COLUMN lead_id TO cliente_id;
        `
      },
      {
        table: "sales",
        column: "lead_id",
        newColumn: "cliente_id",
        query: `
          ALTER TABLE sales 
          RENAME COLUMN lead_id TO cliente_id;
        `
      }
    ];

    // Atualizar cada tabela relacionada
    for (const tableUpdate of updateReferencesTablesQueries) {
      try {
        // Verificar se a tabela existe
        const checkRelatedTableQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${tableUpdate.table}'
          );
        `;
        
        const relatedTableResult = await db.execute(sql.raw(checkRelatedTableQuery));
        const relatedTableExists = relatedTableResult && 
                                (relatedTableResult as any).rows && 
                                (relatedTableResult as any).rows[0] && 
                                (relatedTableResult as any).rows[0].exists;
        
        if (!relatedTableExists) {
          log(`A tabela ${tableUpdate.table} não existe. Pulando atualização.`, "info");
          continue;
        }

        // Verificar se a coluna antiga existe
        const checkColumnQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = '${tableUpdate.table}' 
            AND column_name = '${tableUpdate.column}'
          );
        `;
        
        const columnResult = await db.execute(sql.raw(checkColumnQuery));
        const columnExists = columnResult && 
                          (columnResult as any).rows && 
                          (columnResult as any).rows[0] && 
                          (columnResult as any).rows[0].exists;
        
        if (!columnExists) {
          log(`A coluna ${tableUpdate.column} não existe na tabela ${tableUpdate.table}. Pulando atualização.`, "info");
          continue;
        }

        // Executar a atualização
        await db.execute(sql.raw(tableUpdate.query));
        log(`Coluna ${tableUpdate.column} renomeada para ${tableUpdate.newColumn} na tabela ${tableUpdate.table}.`, "info");
      } catch (error) {
        log(`Erro ao atualizar referências na tabela ${tableUpdate.table}: ${error}`, "error");
        // Continuar para a próxima tabela, não abortar tudo
      }
    }

    log("Migração de leads para clientes concluída com sucesso.", "info");
  } catch (error) {
    log(`Erro ao renomear tabela leads para clientes: ${error}`, "error");
    throw error;
  }
}

// Registrar a migração
registerMigration({
  id: 2,
  name: "rename-leads-to-clientes",
  description: "Renomeia tabela leads para clientes e atualiza referências",
  executeMigration: renameLeadsToClientes
});
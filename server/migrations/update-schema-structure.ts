import { db } from "../database";
import { sql } from "drizzle-orm";
import { registerMigration } from "./index";
import { log } from "../utils";

async function updateSchemaStructure(): Promise<void> {
  try {
    log("Iniciando atualização da estrutura do schema...", "info");

    // Verificação e adição de coluna updated_at em várias tabelas
    const tablesNeedingUpdatedAt = ["clientes", "appointments", "sales", "whatsapp_instances"];
    
    for (const table of tablesNeedingUpdatedAt) {
      try {
        // Verificar se a tabela existe
        const checkTableQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${table}'
          );
        `;
        
        const tableResult = await db.execute(sql.raw(checkTableQuery));
        const tableExists = tableResult && 
                          (tableResult as any).rows && 
                          (tableResult as any).rows[0] && 
                          (tableResult as any).rows[0].exists;
        
        if (!tableExists) {
          log(`A tabela ${table} não existe. Pulando atualização.`, "info");
          continue;
        }

        // Verificar se a coluna updated_at já existe
        const checkColumnQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = '${table}' 
            AND column_name = 'updated_at'
          );
        `;
        
        const columnResult = await db.execute(sql.raw(checkColumnQuery));
        const columnExists = columnResult && 
                           (columnResult as any).rows && 
                           (columnResult as any).rows[0] && 
                           (columnResult as any).rows[0].exists;
        
        if (columnExists) {
          log(`A coluna updated_at já existe na tabela ${table}. Pulando atualização.`, "info");
          continue;
        }

        // Adicionar coluna updated_at
        const alterTableQuery = `
          ALTER TABLE ${table}
          ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        `;
        
        await db.execute(sql.raw(alterTableQuery));
        log(`Coluna updated_at adicionada à tabela ${table} com sucesso.`, "info");
      } catch (error) {
        log(`Erro ao atualizar tabela ${table}: ${error}`, "error");
        // Continuar com as próximas tabelas
      }
    }

    log("Atualização da estrutura do schema concluída com sucesso.", "info");
  } catch (error) {
    log(`Erro ao atualizar estrutura do schema: ${error}`, "error");
    throw error;
  }
}

// Registrar a migração
registerMigration({
  id: 6,
  name: "update-schema-structure",
  description: "Atualiza a estrutura do schema para garantir consistência entre tabelas",
  executeMigration: updateSchemaStructure
});
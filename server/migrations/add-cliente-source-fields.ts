import { db } from "../database";
import { log } from "../utils";
import { sql } from "drizzle-orm";
import { clientes } from "@shared/schema";

/**
 * Esta migração adiciona novos campos à tabela 'clientes' para
 * armazenar detalhes sobre a origem do cliente e o método de contato preferido
 */
export async function addClienteSourceFields() {
  try {
    log("Iniciando migração: adicionar campos de fonte e contato preferido à tabela clientes");

    // Verificar se a coluna source_details já existe
    const sourceDetailsExists = await checkColumnExists('clientes', 'source_details');
    if (!sourceDetailsExists) {
      // Adicionar coluna source_details
      await db.execute(sql`
        ALTER TABLE clientes 
        ADD COLUMN IF NOT EXISTS source_details JSONB DEFAULT NULL
      `);
      log("Coluna source_details adicionada à tabela clientes");
    } else {
      log("Coluna source_details já existe na tabela clientes");
    }

    // Verificar se a coluna preferred_contact já existe
    const preferredContactExists = await checkColumnExists('clientes', 'preferred_contact');
    if (!preferredContactExists) {
      // Adicionar coluna preferred_contact
      await db.execute(sql`
        ALTER TABLE clientes 
        ADD COLUMN IF NOT EXISTS preferred_contact TEXT DEFAULT NULL
      `);
      log("Coluna preferred_contact adicionada à tabela clientes");
    } else {
      log("Coluna preferred_contact já existe na tabela clientes");
    }

    log("Migração concluída: campos de fonte e contato preferido adicionados à tabela clientes");
    return true;
  } catch (error) {
    log(`Erro na migração: ${error}`);
    throw error;
  }
}

/**
 * Função auxiliar para verificar se uma coluna existe em uma tabela
 */
async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
      AND column_name = ${columnName}
    );
  `);
  
  return result.rows[0]?.exists === true;
}
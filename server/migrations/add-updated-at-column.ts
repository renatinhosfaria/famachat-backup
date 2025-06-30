// Adicionar a coluna updated_at à tabela clientes se não existir

import { db } from "../database";
import { sql } from "drizzle-orm";

export const migrationName = 'add_updated_at_column_v1';

export async function runMigration() {
  try {
    // Verificar se a coluna já existe
    const columnCheck = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'clientes' AND column_name = 'updated_at'
    `);
    
    // Se a coluna não existir, adicioná-la
    // @ts-ignore - rowCount existe no objeto retornado
    if (columnCheck.rows && columnCheck.rows.length === 0) {
      
      await db.execute(sql`
        ALTER TABLE clientes
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `);
      
      return true;
    } else {
      
      return true;
    }
  } catch (error) {
    
    return false;
  }
}
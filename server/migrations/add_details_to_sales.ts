import { db } from "../database";
import { sql } from "drizzle-orm";
import { log } from "../utils";

export async function addDetailsToSales(): Promise<void> {
  try {
    log("Adicionando colunas de detalhes à tabela de vendas...", "info");
    
    await db.execute(sql`
      ALTER TABLE "sales"
      ADD COLUMN IF NOT EXISTS "cpf" TEXT,
      ADD COLUMN IF NOT EXISTS "property_type" TEXT,
      ADD COLUMN IF NOT EXISTS "builder_name" TEXT,
      ADD COLUMN IF NOT EXISTS "block" TEXT,
      ADD COLUMN IF NOT EXISTS "unit" TEXT,
      ADD COLUMN IF NOT EXISTS "payment_method" TEXT,
      ADD COLUMN IF NOT EXISTS "commission" NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS "bonus" NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS "total_commission" NUMERIC(12, 2);
    `);
    
    log("Colunas adicionadas com sucesso à tabela de vendas.", "info");
  } catch (error) {
    log(`Erro ao adicionar colunas à tabela sales: ${error}`, "error");
    throw error;
  }
}
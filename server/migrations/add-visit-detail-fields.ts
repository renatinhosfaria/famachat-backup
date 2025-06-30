import { db } from "../database";
import { sql } from "drizzle-orm";
import { log } from "../utils";

/**
 * Migração para adicionar campos de detalhes da visita à tabela 'visits'
 * - Adiciona o campo 'temperature' (inteiro) para registrar a temperatura da visita (1-5)
 * - Adiciona o campo 'visit_description' (texto) para descrição de como foi a visita
 * - Adiciona o campo 'next_steps' (texto) para registrar os próximos passos
 */
export async function addVisitDetailFields(): Promise<void> {
  try {
    log("Verificando se os campos de detalhes de visita já existem na tabela de visitas...", "info");
    
    // Verificar se a coluna 'temperature' já existe
    const temperatureExistsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'visits'
        AND column_name = 'temperature'
      );
    `);
    
    const temperatureExists = temperatureExistsResult && 
                     (temperatureExistsResult as any).rows && 
                     (temperatureExistsResult as any).rows[0] && 
                     (temperatureExistsResult as any).rows[0].exists;
    
    // Verificar se a coluna 'visit_description' já existe
    const descriptionExistsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'visits'
        AND column_name = 'visit_description'
      );
    `);
    
    const descriptionExists = descriptionExistsResult && 
                     (descriptionExistsResult as any).rows && 
                     (descriptionExistsResult as any).rows[0] && 
                     (descriptionExistsResult as any).rows[0].exists;
    
    // Verificar se a coluna 'next_steps' já existe
    const nextStepsExistsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'visits'
        AND column_name = 'next_steps'
      );
    `);
    
    const nextStepsExists = nextStepsExistsResult && 
                     (nextStepsExistsResult as any).rows && 
                     (nextStepsExistsResult as any).rows[0] && 
                     (nextStepsExistsResult as any).rows[0].exists;
    
    // Adicionar as colunas que não existem
    if (!temperatureExists) {
      log("Adicionando coluna 'temperature' na tabela de visitas...", "info");
      await db.execute(sql`
        ALTER TABLE visits 
        ADD COLUMN temperature INTEGER;
      `);
    } else {
      log("Coluna 'temperature' já existe na tabela de visitas.", "info");
    }
    
    if (!descriptionExists) {
      log("Adicionando coluna 'visit_description' na tabela de visitas...", "info");
      await db.execute(sql`
        ALTER TABLE visits 
        ADD COLUMN visit_description TEXT;
      `);
    } else {
      log("Coluna 'visit_description' já existe na tabela de visitas.", "info");
    }
    
    if (!nextStepsExists) {
      log("Adicionando coluna 'next_steps' na tabela de visitas...", "info");
      await db.execute(sql`
        ALTER TABLE visits 
        ADD COLUMN next_steps TEXT;
      `);
    } else {
      log("Coluna 'next_steps' já existe na tabela de visitas.", "info");
    }
    
    // Resultado final da migração
    let result = "Campos de detalhes da visita adicionados com sucesso à tabela 'visits'.";
    if (temperatureExists && descriptionExists && nextStepsExists) {
      result = "Todos os campos de detalhes da visita já existem na tabela 'visits'.";
    }
    
    log(result, "info");
    
    return Promise.resolve();
  } catch (error) {
    log(`Erro ao adicionar campos de detalhes da visita: ${error}`, "error");
    return Promise.reject(error);
  }
}
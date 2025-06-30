import { sql } from "drizzle-orm";
import { db } from "./database";
import { logger } from "./utils/logger";

/**
 * Funções para buscar métricas de desempenho por usuário e período
 * Estas funções são usadas para exibir dados reais no dashboard
 */

export async function getClientesCountByUserPeriod(userId: number, startDate: string, endDate: string): Promise<number> {
  try {
    logger.info(`Consultando clientes para usuário ${userId} entre ${startDate} e ${endDate}`);
    // Parse das datas para o formato correto do PostgreSQL
    const formattedStartDate = new Date(startDate).toISOString();
    const formattedEndDate = new Date(endDate).toISOString();
    
    // Consulta dual para contar clientes por usuário no período (assigned_to OU broker_id)
    const result = await db.execute(
      sql`SELECT COUNT(DISTINCT id) AS count FROM clientes 
          WHERE (assigned_to = ${userId} OR broker_id = ${userId})
          AND created_at BETWEEN ${formattedStartDate} AND ${formattedEndDate}`
    );
    
    // Exibir SQL completa para fins de depuração
    logger.info(`SQL para consulta dual de clientes: 
      SELECT COUNT(DISTINCT id) AS count FROM clientes 
      WHERE (assigned_to = ${userId} OR broker_id = ${userId})
      AND created_at BETWEEN ${formattedStartDate} AND ${formattedEndDate}`);
    
    logger.info(`Resultado da consulta dual de clientes: ${JSON.stringify(result.rows)}`);
    
    // Verifique se temos resultados e trate corretamente
    const count = result.rows[0]?.count ? parseInt(result.rows[0].count) : 0;
    logger.info(`Total de clientes (dual search) para usuário ${userId} no período: ${count}`);
    
    return count;
  } catch (error) {
    logger.error(`Erro ao buscar contagem de clientes para usuário ${userId}:`, error);
    return 0;
  }
}

export async function getAppointmentsCountByUserPeriod(userId: number, startDate: string, endDate: string): Promise<number> {
  try {
    // Parse das datas para o formato correto do PostgreSQL
    const formattedStartDate = new Date(startDate).toISOString();
    const formattedEndDate = new Date(endDate).toISOString();
    
    logger.info(`Consultando agendamentos para usuário ${userId} entre ${formattedStartDate} e ${formattedEndDate}`);
    
    const result = await db.execute(
      sql`SELECT COUNT(*) AS count FROM clientes_agendamentos
          WHERE user_id = ${userId}
          AND created_at BETWEEN ${formattedStartDate} AND ${formattedEndDate}`
    );
    
    logger.info(`Resultado da consulta de agendamentos: ${JSON.stringify(result.rows)}`);
    return parseInt(result.rows[0]?.count || '0');
  } catch (error) {
    logger.error(`Erro ao buscar contagem de agendamentos para usuário ${userId}:`, error);
    return 0;
  }
}

export async function getVisitsCountByUserPeriod(userId: number, startDate: string, endDate: string): Promise<number> {
  try {
    // Parse das datas para o formato correto do PostgreSQL
    const formattedStartDate = new Date(startDate).toISOString();
    const formattedEndDate = new Date(endDate).toISOString();
    
    logger.info(`Consultando visitas para usuário ${userId} entre ${formattedStartDate} e ${formattedEndDate}`);
    
    const result = await db.execute(
      sql`SELECT COUNT(*) AS count FROM clientes_visitas
          WHERE user_id = ${userId}
          AND created_at BETWEEN ${formattedStartDate} AND ${formattedEndDate}`
    );
    
    logger.info(`Resultado da consulta de visitas: ${JSON.stringify(result.rows)}`);
    return parseInt(result.rows[0]?.count || '0');
  } catch (error) {
    logger.error(`Erro ao buscar contagem de visitas para usuário ${userId}:`, error);
    return 0;
  }
}

export async function getSalesCountByUserPeriod(userId: number, startDate: string, endDate: string): Promise<number> {
  try {
    // Parse das datas para o formato correto do PostgreSQL
    const formattedStartDate = new Date(startDate).toISOString();
    const formattedEndDate = new Date(endDate).toISOString();
    
    logger.info(`Consultando vendas para usuário ${userId} entre ${formattedStartDate} e ${formattedEndDate}`);
    
    const result = await db.execute(
      sql`SELECT COUNT(*) AS count FROM clientes_vendas
          WHERE user_id = ${userId}
          AND created_at BETWEEN ${formattedStartDate} AND ${formattedEndDate}`
    );
    
    logger.info(`Resultado da consulta de vendas: ${JSON.stringify(result.rows)}`);
    return parseInt(result.rows[0]?.count || '0');
  } catch (error) {
    logger.error(`Erro ao buscar contagem de vendas para usuário ${userId}:`, error);
    return 0;
  }
}
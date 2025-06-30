import { db } from "../database";
import { Pool } from '@neondatabase/serverless';
// Ambiente necessário para conexão de banco de dados
import 'dotenv/config';
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";
import * as pg from 'pg';

// Inicializa o logger para o sistema de migrações
const migrationLogger = logger.createLogger("Migrations");

// Tipos de dados para o sistema de migração
export type Migration = {
  id: number;
  name: string;
  description: string;
  executeMigration: () => Promise<void>;
};

// Importar migrações disponíveis
import { addWhatsappTables } from "./add-whatsapp-tables";
import { addVisitDetailFields } from "./add-visit-detail-fields";
import { addDetailsToSales } from "./add_details_to_sales";
import { addFacebookConfigTable } from "./add-facebook-config-table";
import { addClienteSourceFields } from "./add-cliente-source-fields";
import { addImoveisFields } from "./add-imoveis-fields";
import { addWhatsappRemoteJid } from "./add-whatsapp-remote-jid";
import { up as addAutomacaoLeadsTable } from "./add-automacao-leads-table";
import { addDevelopmentNameToSales } from "./add-development-name-to-sales";
import { runMigration as addBrokerAssignedToColumns } from "./add_broker_assigned_to_columns";
// Adicione mais importações à medida que criar novas migrações

// Lista de todas as migrações disponíveis, ordenadas por ID
export const migrations: Migration[] = [
  {
    id: 19,
    name: "add_broker_assigned_to_columns",
    description: "Adiciona colunas broker_id e assigned_to nas tabelas de visitas e vendas",
    executeMigration: async () => {
      const result = await addBrokerAssignedToColumns();
      if (!result) throw new Error("Falha ao adicionar colunas broker_id e assigned_to às tabelas");
      // Não retorna valor para manter tipo Promise<void>
    }
  },
  {
    id: 18,
    name: "add_development_name_to_sales",
    description: "Adiciona coluna development_name à tabela de vendas",
    executeMigration: async () => {
      const result = await addDevelopmentNameToSales();
      if (!result) throw new Error("Falha ao adicionar coluna development_name à tabela de vendas");
      // Não retorna valor para manter tipo Promise<void>
    }
  },
  {
    id: 15,
    name: "add_imoveis_fields",
    description: "Adiciona campos necessários à tabela de imóveis",
    executeMigration: async () => {
      const result = await addImoveisFields();
      if (!result) throw new Error("Falha ao adicionar campos à tabela de imóveis");
      // Não retorna valor para manter tipo Promise<void>
    }
  },
  {
    id: 1,
    name: "add_whatsapp_tables",
    description: "Adiciona tabelas para integração com WhatsApp",
    executeMigration: async () => {
      const result = await addWhatsappTables();
      if (!result) throw new Error("Falha ao adicionar tabelas de WhatsApp");
      // Não retorna valor para manter tipo Promise<void>
    }
  },
  {
    id: 11,
    name: "add_visit_detail_fields",
    description: "Adiciona campos de detalhes à tabela de visitas (temperatura, descrição, próximos passos)",
    executeMigration: addVisitDetailFields
  },
  {
    id: 12,
    name: "add_details_to_sales",
    description: "Adiciona campos detalhados à tabela de vendas (CPF, Tipo do Imóvel, Construtora, etc.)",
    executeMigration: addDetailsToSales
  },
  {
    id: 13,
    name: "add_facebook_config_table",
    description: "Adiciona tabela para armazenar configurações da API do Facebook",
    executeMigration: addFacebookConfigTable
  },
  {
    id: 14,
    name: "add_cliente_source_fields",
    description: "Adiciona campos para armazenar detalhes da origem do cliente e contato preferido",
    executeMigration: async () => {
      const result = await addClienteSourceFields();
      if (!result) throw new Error("Falha ao adicionar campos de origem do cliente");
      // Não retorna valor para manter tipo Promise<void>
    }
  },
  {
    id: 16,
    name: "add_whatsapp_remote_jid",
    description: "Adiciona coluna remote_jid à tabela sistema_whatsapp_instances",
    executeMigration: async () => {
      const result = await addWhatsappRemoteJid();
      if (!result) throw new Error("Falha ao adicionar coluna remote_jid");
      // Não retorna valor para manter tipo Promise<void>
    }
  },
  {
    id: 17,
    name: "add_automacao_leads_table",
    description: "Adiciona tabela de configuração para automação de leads",
    executeMigration: async () => {
      try {
        // Usar diretamente a pool de conexão do db
        // Criar uma nova pool para a conexão
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const client = await pool.connect();
        try {
          // Tratar cliente como tipo compatível com a migração
          await addAutomacaoLeadsTable(client as unknown as pg.Client);
          // Não retorna valor para manter tipo Promise<void>
        } catch (error) {
          migrationLogger.error(`Erro ao criar tabela de automação de leads: ${error}`);
          throw error;
        } finally {
          client.release();
          // Fechar a pool após terminar
          await pool.end();
        }
      } catch (error) {
        migrationLogger.error(`Erro ao conectar ao banco de dados: ${error}`);
        throw error;
      }
    }
  }
  // Adicione mais migrações aqui
];

/**
 * Função vazia para manter compatibilidade com código existente
 * Não é mais necessário verificar ou criar a tabela de migrações
 */
export async function ensureMigrationsTable(): Promise<void> {
  try {
    // Apenas verificar se podemos executar uma consulta simples
    await db.execute(sql`SELECT 1`);
    migrationLogger.info("Conexão com o banco de dados verificada com sucesso.");
  } catch (error) {
    migrationLogger.error(`Erro ao verificar conexão com o banco de dados: ${error}`);
    throw error;
  }
}

/**
 * Obtém a lista de migrações já executadas
 */
export async function getExecutedMigrations(): Promise<string[]> {
  // Como a tabela migrations foi removida, estamos retornando uma lista fixa
  // de migrações que sabemos que já foram executadas no banco de dados
  const knownMigrations = [
    'add_whatsapp_tables',
    'add_broker_id_to_clientes',
    'add_cpf_to_clientes',
    'add_address_to_appointments',
    'add_is_primary_to_whatsapp',
    'remove_whatsapp_columns',
    'add_profile_pic_to_clientes',
    'add_cascade_delete_to_users',
    'add_cliente_notes_table',
    'add_updated_at_to_visits',
    'add_visit_detail_fields',
    'add_facebook_config_table',
    'add_whatsapp_remote_jid',
    'add_imoveis_fields',
    'add_cliente_source_fields',
    'add_details_to_sales',
    'add_development_name_to_sales'
  ];
  
  migrationLogger.info(`Usando lista de migrações conhecidas como já executadas: ${knownMigrations.join(', ')}`);
  return knownMigrations;
}

/**
 * Função vazia para manter compatibilidade com código existente
 * Não registra mais migrações na tabela de banco de dados
 */
export async function registerMigration(migration: Migration): Promise<void> {
  migrationLogger.info(`Migração ${migration.name} considerada como registrada.`);
  // Não fazemos mais nada aqui, já que a tabela de migrações foi removida
}

/**
 * Executa todas as migrações pendentes
 */
export async function runMigrations(): Promise<void> {
  try {
    migrationLogger.info("Iniciando processo de migração...");
    
    // Garantir que a tabela de migrações existe
    await ensureMigrationsTable();
    
    // Obter migrações já executadas
    const executed = await getExecutedMigrations();
    migrationLogger.info(`Migrações já executadas: ${executed.length}`);
    
    // Filtrar migrações pendentes
    const pending = migrations.filter(
      migration => !executed.includes(migration.name)
    );
    
    if (pending.length === 0) {
      migrationLogger.info("Nenhuma migração pendente encontrada.");
      return;
    }
    
    migrationLogger.info(`Encontradas ${pending.length} migrações pendentes.`);
    
    // Ordenar por ID e executar
    pending.sort((a, b) => a.id - b.id);
    
    for (const migration of pending) {
      try {
        migrationLogger.info(`Executando migração: ${migration.name} - ${migration.description}`);
        await migration.executeMigration();
        await registerMigration(migration);
        migrationLogger.info(`Migração ${migration.name} concluída com sucesso.`);
      } catch (error) {
        migrationLogger.error(`Falha ao executar migração ${migration.name}: ${error}`);
        throw error;
      }
    }
    
    migrationLogger.info("Processo de migração concluído com sucesso.");
  } catch (error) {
    migrationLogger.error(`Erro ao executar migrações: ${error}`);
    throw error;
  }
}
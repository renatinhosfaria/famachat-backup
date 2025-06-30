import { sql } from "drizzle-orm";
import { db, executeSQL, testConnection } from "./database";
import * as schema from "@shared/schema";
import { log, LogLevel } from "./utils";
import { Role, Department, ClienteStatus, AppointmentStatus, AppointmentType } from "@shared/schema";

// Defina o tipo Migration aqui mesmo em vez de importar
export type Migration = {
  id: number;
  name: string;
  description: string;
  executeMigration: () => Promise<void | boolean | { success: boolean; message: string }>;
};

// Lista simplificada de migrações - todas consideradas como já executadas
const migrationsList: Migration[] = [];

/**
 * Função para verificar conexão com banco de dados
 * Funciona tanto com conexão direta quanto REST
 */
async function checkDatabaseConnection(): Promise<void> {
  try {
    // Usar testConnection que funciona com REST e conexão direta
    await testConnection();
    log("Conexão com o banco de dados verificada com sucesso.", LogLevel.INFO);
  } catch (error) {
    log(`Erro ao verificar conexão com o banco de dados: ${error}`, LogLevel.ERROR);
    throw error;
  }
}

/**
 * Verifica quais migrações já foram executadas
 */
async function getExecutedMigrations(): Promise<string[]> {
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
    'add_sistema_leads_table',
    'add_sistema_leads_cascata_table',
    'add_cascade_sla_config'
  ];
  
  log(`Usando lista de migrações conhecidas como já executadas: ${knownMigrations.join(', ')}`, LogLevel.INFO);
  return knownMigrations;
}

/**
 * Função vazia para manter compatibilidade com código existente
 * Não registra mais migrações na tabela de banco de dados
 */
async function registerMigration(migration: Migration): Promise<void> {
  log(`Migração ${migration.name} considerada como registrada.`, LogLevel.INFO);
  // Não fazemos mais nada aqui, já que a tabela de migrações foi removida
}

/**
 * Executa todas as migrações pendentes
 */
export async function migrate(): Promise<void> {
  try {
    log("Iniciando processo de migração...", LogLevel.INFO);
    
    // Verificar a conexão com o banco de dados
    await checkDatabaseConnection();
    
    // Obter lista de migrações já executadas
    const executedMigrations = await getExecutedMigrations();
    log(`Migrações já executadas: ${executedMigrations.length}`, LogLevel.INFO);
    
    // Filtrar e executar migrações pendentes
    const pendingMigrations = migrationsList.filter(
      migration => !executedMigrations.includes(migration.name)
    );
    
    if (pendingMigrations.length === 0) {
      log("Nenhuma migração pendente encontrada.", LogLevel.INFO);
      return;
    }
    
    log(`Encontradas ${pendingMigrations.length} migrações pendentes.`, LogLevel.INFO);
    
    // Ordenar migrações por ID
    pendingMigrations.sort((a, b) => a.id - b.id);
    
    // Executar migrações em sequência
    for (const migration of pendingMigrations) {
      try {
        log(`Executando migração: ${migration.name} - ${migration.description}`, LogLevel.INFO);
        
        // Executar migração e lidar com diferentes tipos de retorno
        const result = await migration.executeMigration();
        
        // Verificar o tipo de retorno
        if (typeof result === 'object' && result !== null && 'success' in result) {
          // Para retornos no formato { success: boolean, message: string }
          if (!result.success) {
            throw new Error(result.message);
          }
          log(`Resultado da migração: ${result.message}`, LogLevel.INFO);
        } else if (typeof result === 'boolean' && !result) {
          // Para retornos booleanos falsos
          throw new Error(`A migração ${migration.name} falhou, retornando false`);
        }
        
        await registerMigration(migration);
        log(`Migração ${migration.name} concluída com sucesso.`, LogLevel.INFO);
      } catch (error) {
        log(`Erro ao executar migração ${migration.name}: ${error}`, LogLevel.ERROR);
        throw error;
      }
    }
    
    log("Processo de migração concluído com sucesso.", LogLevel.INFO);
  } catch (error) {
    log(`Erro no processo de migração: ${error}`, LogLevel.ERROR);
    throw error;
  }
}

async function createTables() {
  const createTablesSQL = `
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true
    );

    -- Clientes Table (anteriormente Leads)
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      source TEXT,
      assigned_to INTEGER REFERENCES users(id),
      broker_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'Sem Atendimento',
      cpf TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Appointments Table
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id),
      user_id INTEGER REFERENCES users(id),
      broker_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      scheduled_at TIMESTAMP NOT NULL,
      location TEXT,
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Visits Table
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id),
      user_id INTEGER REFERENCES users(id),
      property_id TEXT NOT NULL,
      visited_at TIMESTAMP NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Sales Table
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id),
      user_id INTEGER REFERENCES users(id),
      property_id TEXT NOT NULL,
      value DECIMAL(12, 2) NOT NULL,
      sold_at TIMESTAMP NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Metrics Table
    CREATE TABLE IF NOT EXISTS metrics (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL,
      value DECIMAL(12, 2) NOT NULL,
      period TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await executeSQL(createTablesSQL);
  log("Tabelas criadas ou já existentes.", LogLevel.INFO);
}

async function seedSampleData() {
  log("Inicializando dados de exemplo...", LogLevel.INFO);
  
  try {
    // Criar usuários
    const users = [
      {
        username: "renato",
        passwordHash: "$2b$10$vQdptqYJsdz9l8Zx5oaj5OGOPUxd0yA5T3pFTEDM.xB9TpFdoqgHO", // "senha123"
        fullName: "Renato Alves",
        email: "renato@fama.com.br",
        phone: "(11) 99999-1111",
        role: Role.MANAGER,
        department: Department.MANAGEMENT,
        isActive: true
      },
      {
        username: "lourenzza",
        passwordHash: "$2b$10$vQdptqYJsdz9l8Zx5oaj5OGOPUxd0yA5T3pFTEDM.xB9TpFdoqgHO", // "senha123"
        fullName: "Lourenzza Carvalho",
        email: "lourenzza@fama.com.br",
        phone: "(11) 99999-2222",
        role: Role.MARKETING,
        department: Department.MARKETING,
        isActive: true
      },
      {
        username: "humberto",
        passwordHash: "$2b$10$vQdptqYJsdz9l8Zx5oaj5OGOPUxd0yA5T3pFTEDM.xB9TpFdoqgHO", // "senha123"
        fullName: "Humberto Santos",
        email: "humberto@fama.com.br",
        phone: "(11) 99999-3333",
        role: Role.BROKER_SENIOR,
        department: Department.SALES,
        isActive: true
      },
      {
        username: "michel",
        passwordHash: "$2b$10$vQdptqYJsdz9l8Zx5oaj5OGOPUxd0yA5T3pFTEDM.xB9TpFdoqgHO", // "senha123"
        fullName: "Michel Silva",
        email: "michel@fama.com.br",
        phone: "(11) 99999-4444",
        role: Role.BROKER_SENIOR,
        department: Department.SALES,
        isActive: true
      },
      {
        username: "jessica",
        passwordHash: "$2b$10$vQdptqYJsdz9l8Zx5oaj5OGOPUxd0yA5T3pFTEDM.xB9TpFdoqgHO", // "senha123"
        fullName: "Jessica Oliveira",
        email: "jessica@fama.com.br",
        phone: "(11) 99999-5555",
        role: Role.CONSULTANT,
        department: Department.SALES,
        isActive: true
      },
      {
        username: "anafabia",
        passwordHash: "$2b$10$vQdptqYJsdz9l8Zx5oaj5OGOPUxd0yA5T3pFTEDM.xB9TpFdoqgHO", // "senha123"
        fullName: "Ana Fabia Rodrigues",
        email: "anafabia@fama.com.br",
        phone: "(11) 99999-6666",
        role: Role.CONSULTANT,
        department: Department.SALES,
        isActive: true
      },
      {
        username: "laura",
        passwordHash: "$2b$10$vQdptqYJsdz9l8Zx5oaj5OGOPUxd0yA5T3pFTEDM.xB9TpFdoqgHO", // "senha123"
        fullName: "Laura Mendes",
        email: "laura@fama.com.br",
        phone: "(11) 99999-7777",
        role: Role.CONSULTANT,
        department: Department.SALES,
        isActive: true
      }
    ];
    
    // Verificar se já existem usuários
    const existingUsers = await db.query.users.findMany();
    if (existingUsers.length > 0) {
      log("Usuários já existem, pulando inserção de dados de exemplo.", LogLevel.INFO);
      return;
    }
    
    // Inserir usuários
    for (const user of users) {
      await db.insert(schema.users).values(user);
    }
    log(`${users.length} usuários inseridos`, LogLevel.INFO);
    
    log("Dados de exemplo inicializados com sucesso.", LogLevel.INFO);
  } catch (error) {
    log(`Erro ao inserir dados de exemplo: ${error}`, LogLevel.ERROR);
    // Não fazer throw aqui para não quebrar a aplicação
  }
}
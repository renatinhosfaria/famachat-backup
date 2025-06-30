/**
 * database-rest.ts
 * Database layer usando HTTP/REST em vez de conexão direta
 * Permite acessar PostgreSQL via API REST
 */
import axios, { AxiosInstance } from 'axios';
import { logger } from './utils/logger';

// Inicializa logger com contexto específico do banco de dados REST
const dbLogger = logger.createLogger('Database-REST');

interface RestDatabaseConfig {
  baseURL: string;
  apiKey?: string;
  timeout: number;
}

interface QueryResult {
  rows: any[];
  rowCount: number;
  command: string;
}

interface TableInsert {
  table: string;
  data: Record<string, any>;
  returning?: string[];
}

interface TableUpdate {
  table: string;
  data: Record<string, any>;
  where: Record<string, any>;
  returning?: string[];
}

interface TableDelete {
  table: string;
  where: Record<string, any>;
  returning?: string[];
}

interface TableSelect {
  table: string;
  columns?: string[];
  where?: Record<string, any>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

class DatabaseRestClient {
  private client: AxiosInstance;
  private config: RestDatabaseConfig;

  constructor(config: RestDatabaseConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    });

    dbLogger.info('Database REST client initialized');
  }

  /**
   * Executa uma query SQL raw via REST
   */
  async executeSQL(sql: string, params: any[] = []): Promise<QueryResult> {
    try {
      dbLogger.debug(`Executing SQL via REST: ${sql}`);
      
      const response = await this.client.post('/sql', {
        sql,
        params
      });

      return {
        rows: response.data.rows || [],
        rowCount: response.data.rowCount || 0,
        command: response.data.command || 'UNKNOWN'
      };
    } catch (error) {
      dbLogger.error('Error executing SQL via REST:', error);
      throw error;
    }
  }

  /**
   * Seleciona dados de uma tabela
   */
  async select(options: TableSelect): Promise<any[]> {
    try {
      const { table, columns, where, orderBy, limit, offset } = options;
      
      const params = new URLSearchParams();
      if (columns?.length) params.append('select', columns.join(','));
      if (where) {
        Object.entries(where).forEach(([key, value]) => {
          params.append(key, `eq.${value}`);
        });
      }
      if (orderBy) params.append('order', orderBy);
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());

      const response = await this.client.get(`/${table}?${params.toString()}`);
      return response.data;
    } catch (error) {
      dbLogger.error(`Error selecting from ${options.table}:`, error);
      throw error;
    }
  }

  /**
   * Insere dados em uma tabela
   */
  async insert(options: TableInsert): Promise<any[]> {
    try {
      const { table, data, returning } = options;
      
      const params = new URLSearchParams();
      if (returning?.length) params.append('select', returning.join(','));

      const response = await this.client.post(
        `/${table}?${params.toString()}`,
        data,
        {
          headers: {
            'Prefer': 'return=representation'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      dbLogger.error(`Error inserting into ${options.table}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza dados em uma tabela
   */
  async update(options: TableUpdate): Promise<any[]> {
    try {
      const { table, data, where, returning } = options;
      
      const params = new URLSearchParams();
      if (returning?.length) params.append('select', returning.join(','));
      
      Object.entries(where).forEach(([key, value]) => {
        params.append(key, `eq.${value}`);
      });

      const response = await this.client.patch(
        `/${table}?${params.toString()}`,
        data,
        {
          headers: {
            'Prefer': 'return=representation'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      dbLogger.error(`Error updating ${options.table}:`, error);
      throw error;
    }
  }

  /**
   * Deleta dados de uma tabela
   */
  async delete(options: TableDelete): Promise<any[]> {
    try {
      const { table, where, returning } = options;
      
      const params = new URLSearchParams();
      if (returning?.length) params.append('select', returning.join(','));
      
      Object.entries(where).forEach(([key, value]) => {
        params.append(key, `eq.${value}`);
      });

      const response = await this.client.delete(
        `/${table}?${params.toString()}`,
        {
          headers: {
            'Prefer': 'return=representation'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      dbLogger.error(`Error deleting from ${options.table}:`, error);
      throw error;
    }
  }

  /**
   * Testa a conexão com a API REST
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', {
        baseURL: this.config.baseURL.replace('/api/db', '')
      });
      dbLogger.info('REST API connection test successful');
      return response.status === 200;
    } catch (error) {
      dbLogger.error('REST API connection test failed:', error);
      return false;
    }
  }

  /**
   * Fecha a conexão (cleanup)
   */
  async close(): Promise<void> {
    dbLogger.info('Database REST client closed');
  }
}

// Configuração baseada nas variáveis de ambiente
const isDevelopment = process.argv[0].includes('tsx') || 
                      process.argv.join(' ').includes('tsx') ||
                      process.env.NODE_ENV === 'development';

const defaultPort = isDevelopment ? 3002 : 3001;
const restPort = process.env.DATABASE_REST_PORT ? parseInt(process.env.DATABASE_REST_PORT) : defaultPort;
const baseURL = process.env.DATABASE_REST_URL || `http://localhost:${restPort}/api/db`;

const restConfig: RestDatabaseConfig = {
  baseURL,
  apiKey: process.env.DATABASE_REST_API_KEY,
  timeout: parseInt(process.env.DATABASE_REST_TIMEOUT || '30000')
};

// Instância global do cliente REST
export const dbRest = new DatabaseRestClient(restConfig);

// Funções de conveniência para manter compatibilidade
export async function executeSQL(sql: string, params: any[] = []): Promise<any[]> {
  const result = await dbRest.executeSQL(sql, params);
  return result.rows;
}

export async function testConnection(): Promise<boolean> {
  return await dbRest.testConnection();
}

export { DatabaseRestClient };
export type { TableSelect, TableInsert, TableUpdate, TableDelete, QueryResult };

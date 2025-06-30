/**
 * rest-api-server.ts
 * Servidor REST que // Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW() as current_time');
    client.release();
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      service: 'REST API PostgreSQL Bridge'
    });
  } catch (error) {
    apiLogger.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: 'Database connection failed' 
    });
  }
});e HTTP/REST e PostgreSQL
 * Permite acessar o banco via API REST em vez de conexão direta
 */
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { logger } from './utils/logger';

const apiLogger = logger.createLogger('REST-API');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuração do PostgreSQL
const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: false, // Sem SSL conforme configurado
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Middleware de autenticação simples
const authenticateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = process.env.DATABASE_REST_API_KEY;
  
  if (apiKey) {
    const providedKey = req.headers.authorization?.replace('Bearer ', '');
    if (!providedKey || providedKey !== apiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
  }
  
  next();
};

// Middleware de autenticação para todas as rotas protegidas
app.use('/api/db', authenticateApiKey);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    apiLogger.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: 'Database connection failed' 
    });
  }
});

// Executa SQL direto
app.post('/api/db/sql', async (req, res) => {
  try {
    const { sql, params = [] } = req.body;
    
    if (!sql) {
      return res.status(400).json({ error: 'SQL query is required' });
    }
    
    apiLogger.debug(`Executing SQL: ${sql}`);
    
    const client = await pool.connect();
    const result = await client.query(sql, params);
    client.release();
    
    res.json({
      rows: result.rows,
      rowCount: result.rowCount,
      command: result.command
    });
  } catch (error) {
    apiLogger.error('SQL execution error:', error);
    res.status(500).json({ 
      error: 'SQL execution failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// SELECT de uma tabela (GET /:table)
app.get('/api/db/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { select, limit, offset, order } = req.query;
    
    // Construir query SELECT
    const columns = select ? (select as string).split(',').join(', ') : '*';
    let sql = `SELECT ${columns} FROM ${table}`;
    const params: any[] = [];
    let paramIndex = 1;
    
    // Filtros WHERE baseados nos query params
    const whereConditions: string[] = [];
    Object.entries(req.query).forEach(([key, value]) => {
      if (!['select', 'limit', 'offset', 'order'].includes(key)) {
        // Suporte para operadores: eq, gt, gte, lt, lte, like, ilike
        if (typeof value === 'string' && value.includes('.')) {
          const [operator, val] = value.split('.', 2);
          switch (operator) {
            case 'eq':
              whereConditions.push(`${key} = $${paramIndex}`);
              params.push(val);
              break;
            case 'gt':
              whereConditions.push(`${key} > $${paramIndex}`);
              params.push(val);
              break;
            case 'gte':
              whereConditions.push(`${key} >= $${paramIndex}`);
              params.push(val);
              break;
            case 'lt':
              whereConditions.push(`${key} < $${paramIndex}`);
              params.push(val);
              break;
            case 'lte':
              whereConditions.push(`${key} <= $${paramIndex}`);
              params.push(val);
              break;
            case 'like':
              whereConditions.push(`${key} LIKE $${paramIndex}`);
              params.push(val);
              break;
            case 'ilike':
              whereConditions.push(`${key} ILIKE $${paramIndex}`);
              params.push(val);
              break;
          }
          paramIndex++;
        }
      }
    });
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    if (order) {
      sql += ` ORDER BY ${order}`;
    }
    
    if (limit) {
      sql += ` LIMIT ${parseInt(limit as string)}`;
    }
    
    if (offset) {
      sql += ` OFFSET ${parseInt(offset as string)}`;
    }
    
    const client = await pool.connect();
    const result = await client.query(sql, params);
    client.release();
    
    res.json(result.rows);
  } catch (error) {
    apiLogger.error(`Error selecting from ${req.params.table}:`, error);
    res.status(500).json({ 
      error: 'Select operation failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// INSERT em uma tabela (POST /:table)
app.post('/api/db/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const data = req.body;
    const { select } = req.query;
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    
    let sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
    
    if (select) {
      sql += ` RETURNING ${select}`;
    } else {
      sql += ` RETURNING *`;
    }
    
    const client = await pool.connect();
    const result = await client.query(sql, values);
    client.release();
    
    res.status(201).json(result.rows);
  } catch (error) {
    apiLogger.error(`Error inserting into ${req.params.table}:`, error);
    res.status(500).json({ 
      error: 'Insert operation failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// UPDATE de uma tabela (PATCH /:table)
app.patch('/api/db/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const data = req.body;
    const { select } = req.query;
    
    // Construir SET clause
    const setColumns = Object.keys(data);
    const setValues = Object.values(data);
    const setClause = setColumns.map((col, index) => `${col} = $${index + 1}`).join(', ');
    
    // Construir WHERE clause baseado nos query params
    const whereConditions: string[] = [];
    const whereParams: any[] = [];
    let paramIndex = setValues.length + 1;
    
    Object.entries(req.query).forEach(([key, value]) => {
      if (!['select'].includes(key)) {
        if (typeof value === 'string' && value.includes('.')) {
          const [operator, val] = value.split('.', 2);
          if (operator === 'eq') {
            whereConditions.push(`${key} = $${paramIndex}`);
            whereParams.push(val);
            paramIndex++;
          }
        }
      }
    });
    
    if (whereConditions.length === 0) {
      return res.status(400).json({ error: 'WHERE conditions are required for UPDATE' });
    }
    
    let sql = `UPDATE ${table} SET ${setClause} WHERE ${whereConditions.join(' AND ')}`;
    
    if (select) {
      sql += ` RETURNING ${select}`;
    } else {
      sql += ` RETURNING *`;
    }
    
    const allParams = [...setValues, ...whereParams];
    
    const client = await pool.connect();
    const result = await client.query(sql, allParams);
    client.release();
    
    res.json(result.rows);
  } catch (error) {
    apiLogger.error(`Error updating ${req.params.table}:`, error);
    res.status(500).json({ 
      error: 'Update operation failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// DELETE de uma tabela (DELETE /:table)
app.delete('/api/db/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { select } = req.query;
    
    // Construir WHERE clause baseado nos query params
    const whereConditions: string[] = [];
    const whereParams: any[] = [];
    let paramIndex = 1;
    
    Object.entries(req.query).forEach(([key, value]) => {
      if (!['select'].includes(key)) {
        if (typeof value === 'string' && value.includes('.')) {
          const [operator, val] = value.split('.', 2);
          if (operator === 'eq') {
            whereConditions.push(`${key} = $${paramIndex}`);
            whereParams.push(val);
            paramIndex++;
          }
        }
      }
    });
    
    if (whereConditions.length === 0) {
      return res.status(400).json({ error: 'WHERE conditions are required for DELETE' });
    }
    
    let sql = `DELETE FROM ${table} WHERE ${whereConditions.join(' AND ')}`;
    
    if (select) {
      sql += ` RETURNING ${select}`;
    }
    
    const client = await pool.connect();
    const result = await client.query(sql, whereParams);
    client.release();
    
    res.json(result.rows);
  } catch (error) {
    apiLogger.error(`Error deleting from ${req.params.table}:`, error);
    res.status(500).json({ 
      error: 'Delete operation failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Middleware de tratamento de erros
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  apiLogger.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: error.message 
  });
});

// Inicializar servidor
const isDevelopment = process.argv[0].includes('tsx') || 
                      process.argv.join(' ').includes('tsx') ||
                      process.env.NODE_ENV === 'development';

// Porta REST baseada no ambiente: 3001 para produção, 3002 para desenvolvimento
const defaultRestPort = isDevelopment ? 3002 : 3001;
const envRestPort = process.env.DATABASE_REST_PORT;
const port = envRestPort ? parseInt(envRestPort) : defaultRestPort;

export function startRestApiServer() {
  return new Promise<void>((resolve, reject) => {
    const server = app.listen(port, () => {
      apiLogger.info(`Database REST API server running on port ${port}`);
      resolve();
    });
    
    server.on('error', (error) => {
      apiLogger.error('Failed to start REST API server:', error);
      reject(error);
    });
  });
}

export { app as restApiApp };

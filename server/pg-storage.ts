import { and, eq, gt, lt, between, desc, asc, sql, like, isNull, or } from "drizzle-orm";
import { IStorage } from "./storage";
import { db } from "./database";
import * as schema from "@shared/schema";
import {
  User, InsertUser,
  Cliente, InsertCliente,
  Appointment, InsertAppointment,
  Visit, InsertVisit,
  Sale, InsertSale,
  Metric, InsertMetric,
  ClienteNote, InsertClienteNote,
  WhatsappInstance, InsertWhatsappInstance,
  WhatsappLog, InsertWhatsappLog, // Mantidos para compatibilidade (a tabela foi removida)
  whatsappInstances, clienteNotes, appointments, visits, sales,
  WhatsAppInstanceStatus,
  Lead, InsertLead, UpdateLead,
  LeadStatusEnum, ClienteStatus, UserDepartment,
  clientes, leads
} from "@shared/schema";
import { logger } from "./utils/logger";
import { getDeprecationMessage } from "./constants/deprecatedFunctions";
import { Cache } from "./utils/cache";
import { validateClienteFilter, validateId } from "./utils/validators";

type ClienteFilter = {
  status?: string;
  assignedTo?: number;
  brokerId?: number;
  period?: string;
  search?: string;
  order?: string;
  _timestamp?: string; // Campo para evitar cache entre requisições
};

type AppointmentFilter = {
  userId?: number;
  clienteId?: number;
  brokerId?: number; // Adicionado campo para filtrar por corretor
  startDate?: string;
  endDate?: string;
  status?: string;
};

type VisitFilter = {
  userId?: number;
  clienteId?: number;
  brokerId?: number;
  period?: string;
};

type SaleFilter = {
  userId?: number;
  clienteId?: number;
  brokerId?: number;
  period?: string;
};

type MetricFilter = {
  userId?: number;
  period?: string;
};

// Função helper para verificar se um valor é nulo ou indefinido
function isNullOrUndefined(value: any): boolean {
  return value === null || value === undefined;
}

// Função helper para verificar objetos com segurança contra nulos
function safeGet<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] | null {
  if (isNullOrUndefined(obj)) return null;

  // Verificação de segurança para objeto não nulo
  const nonNullObj = obj as T;
  return nonNullObj[key];
}

function getDateRangeFromPeriod(period?: string): { start: Date, end: Date } {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (!period) {
    // Default to 7 days if no period is provided
    start.setDate(start.getDate() - 7);
    return { start, end };
  }

  switch (period) {
    case "today":
      // Início: Hoje às 00:00:00
      start.setHours(0, 0, 0, 0);
      break;
      
    case "yesterday":
      // Início: Ontem às 00:00:00
      // Fim: Ontem às 23:59:59
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
      
    case "7days":
      // Início: 7 dias atrás
      // Fim: Agora
      start.setDate(start.getDate() - 7);
      break;
      
    case "last_month":
      // Novo filtro: Mês passado (1º dia do mês passado até o último dia do mês passado)
      const lastMonth = now.getMonth() - 1;
      const yearOfLastMonth = lastMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const monthIndex = lastMonth < 0 ? 11 : lastMonth;
      
      // Primeiro dia do mês passado
      start = new Date(yearOfLastMonth, monthIndex, 1);
      start.setHours(0, 0, 0, 0);
      
      // Último dia do mês passado
      end = new Date(yearOfLastMonth, monthIndex + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
      
    case "month":
      // Modificado: Mês atual (1º dia do mês atual até o último dia do mês atual)
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Primeiro dia do mês atual
      start = new Date(currentYear, currentMonth, 1);
      start.setHours(0, 0, 0, 0);
      
      // Último dia do mês atual
      end = new Date(currentYear, currentMonth + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
      
    case "quarter":
      // Modificado: Trimestre atual
      const currentQuarter = Math.floor(now.getMonth() / 3);
      
      // Primeiro dia do primeiro mês do trimestre atual
      start = new Date(now.getFullYear(), currentQuarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      
      // Último dia do último mês do trimestre atual
      end = new Date(now.getFullYear(), (currentQuarter * 3) + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
      
    case "semester":
      // Modificado: Semestre atual
      const currentSemester = Math.floor(now.getMonth() / 6);
      
      // Primeiro dia do primeiro mês do semestre atual
      start = new Date(now.getFullYear(), currentSemester * 6, 1);
      start.setHours(0, 0, 0, 0);
      
      // Último dia do último mês do semestre atual
      end = new Date(now.getFullYear(), (currentSemester * 6) + 6, 0);
      end.setHours(23, 59, 59, 999);
      break;
      
    case "year":
      // Ano completo atual (de Janeiro a Dezembro)
      start = new Date(now.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      
      end = new Date(now.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      break;
      
    default:
      start.setDate(start.getDate() - 7);
      break;
  }

  return { start, end };
}

// Adicionar interfaces para tipos de retorno dos relatórios
interface ClientesReportResult {
  total: number;
  byStatus: Record<string, number>;
}

interface ProductionReportResult {
  totalLeads: number;
  totalAppointments: number;
  totalVisits: number;
  totalSales: number;
  byUser: Record<number, {
    userId: number;
    fullName: string;
    role: string;
    leads: number;
    appointments: number;
    visits: number;
    sales: number;
    conversionRates: {
      appointmentsToLeads: number;
      visitsToAppointments: number;
      salesToVisits: number;
    }
  }>;
}

interface AppointmentsReportResult {
  total: number;
  byStatus: Record<string, number>;
  byUser: Record<number, {
    fullName: string;
    role: string;
    count: number;
  }>;
  byDay: Record<string, number>;
}

interface VisitsReportResult {
  total: number;
  byUser: Record<number, {
    fullName: string;
    role: string;
    count: number;
  }>;
  byDay: Record<string, number>;
  byProperty: Record<string, number>;
}

interface SalesReportResult {
  total: number;
  totalValue: number;
  byUser: Record<number, {
    fullName: string;
    role: string;
    count: number;
    value: number;
  }>;
  byMonth: Record<string, {
    count: number;
    value: number;
  }>;
}

export class PgStorage implements IStorage {
  // Caches para diferentes entidades
  private clienteCache: Cache<Cliente[]>;
  private userCache: Cache<User | User[]>;
  private appointmentCache: Cache<Appointment[]>;
  private reportCache: Cache<any>;
  private leadsCache: Cache<{ leads: Lead[], total?: number }>;

  constructor() {
    logger.info("PostgreSQL Storage inicializado.");

    // Inicializa os caches com TTLs reduzidos
    this.clienteCache = new Cache<Cliente[]>(60 * 1000); // 1 minuto (reduzido de 3 minutos)
    this.userCache = new Cache<User | User[]>(5 * 60 * 1000); // 5 minutos (reduzido de 10 minutos)
    this.appointmentCache = new Cache<Appointment[]>(60 * 1000); // 1 minuto (reduzido de 2 minutos)
    this.reportCache = new Cache<any>(60 * 1000); // 1 minuto (reduzido de 5 minutos)
    this.leadsCache = new Cache<{ leads: Lead[], total?: number }>(60 * 1000); // 1 minuto para cache de leads

    // Limpar caches para garantir dados frescos
    this.clienteCache.clear();
    this.userCache.clear();
    this.appointmentCache.clear();
    this.reportCache.clear();
    this.leadsCache.clear();
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para busca de usuário: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;

      // Verificar no cache primeiro
      const cacheKey = `user:${validId}`;
      const cachedUser = this.userCache.get(cacheKey);
      if (cachedUser) {
        logger.debug(`Usando cache para usuário: ${validId}`);
        return Array.isArray(cachedUser) ? cachedUser[0] : cachedUser;
      }

      // Buscar no banco de dados
      const users = await db.query.users.findMany({
        where: eq(schema.users.id, validId),
        limit: 1
      });

      // Armazenar no cache
      if (users && users.length > 0) {
        this.userCache.set(cacheKey, users[0]);
        logger.debug(`Armazenando usuário no cache: ${validId}`);
      }

      return users[0];
    } catch (error) {
      logger.error(`Erro ao buscar usuário: ${error}`);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      if (!username || typeof username !== 'string') {
        logger.warn(`Username inválido para busca: ${username}`);
        return undefined;
      }

      // Verificar no cache primeiro
      const cacheKey = `user:username:${username}`;
      const cachedUser = this.userCache.get(cacheKey);
      if (cachedUser) {
        logger.debug(`Usando cache para usuário por username: ${username}`);
        return Array.isArray(cachedUser) ? cachedUser[0] : cachedUser;
      }

      // Buscar no banco de dados
      const users = await db.query.users.findMany({
        where: eq(schema.users.username, username),
        limit: 1
      });

      // Armazenar no cache
      if (users && users.length > 0) {
        this.userCache.set(cacheKey, users[0]);
        logger.debug(`Armazenando usuário por username no cache: ${username}`);

        // Armazenar também pelo ID para mais eficiência
        this.userCache.set(`user:${users[0].id}`, users[0]);
      }

      return users[0];
    } catch (error) {
      logger.error(`Erro ao buscar usuário por username: ${error}`);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      if (!email || typeof email !== 'string') {
        logger.warn(`Email inválido para busca: ${email}`);
        return undefined;
      }

      // Verificar no cache primeiro
      const cacheKey = `user:email:${email.toLowerCase()}`;
      const cachedUser = this.userCache.get(cacheKey);
      if (cachedUser) {
        logger.debug(`Usando cache para usuário por email: ${email}`);
        return Array.isArray(cachedUser) ? cachedUser[0] : cachedUser;
      }

      // Buscar no banco de dados
      const users = await db.query.users.findMany({
        where: eq(schema.users.email, email.toLowerCase()),
        limit: 1
      });

      // Armazenar no cache
      if (users && users.length > 0) {
        this.userCache.set(cacheKey, users[0]);
        logger.debug(`Armazenando usuário por email no cache: ${email}`);

        // Armazenar também pelo ID e username para mais eficiência
        this.userCache.set(`user:${users[0].id}`, users[0]);
        this.userCache.set(`user:username:${users[0].username}`, users[0]);
      }

      return users[0];
    } catch (error) {
      logger.error(`Erro ao buscar usuário por email: ${error}`);
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      // Verificar no cache primeiro
      const cacheKey = 'users:all';
      const cachedUsers = this.userCache.get(cacheKey);
      if (cachedUsers) {
        logger.debug(`Usando cache para todos os usuários`);
        return Array.isArray(cachedUsers) ? cachedUsers : [cachedUsers];
      }

      // Buscar no banco de dados
      const users = await db.query.users.findMany();

      // Armazenar no cache
      if (users && users.length > 0) {
        this.userCache.set(cacheKey, users);
        logger.debug(`Armazenando todos os usuários no cache`);
      }

      return users;
    } catch (error) {
      logger.error(`Erro ao buscar todos usuários: ${error}`);
      return [];
    }
  }

  async hasManagerUser(excludeUserId?: number): Promise<boolean> {
    try {
      // Verificar se existe algum usuário com papel de Gestor (exceto o próprio usuário, se especificado)
      const conditions = [eq(schema.users.role, 'Gestor')];
      
      if (excludeUserId !== undefined) {
        conditions.push(sql`${schema.users.id} != ${excludeUserId}`);
      }
      
      const query = conditions.length > 1 ? and(...conditions) : conditions[0];

      const managers = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(query)
        .limit(1);

      return managers.length > 0;
    } catch (error) {
      logger.error(`Erro ao verificar existência de Gestor: ${error}`);
      return false;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User | { error: string }> {
    try {
      // Verificar se já existe um usuário Gestor quando tentamos criar outro
      if (insertUser.role === 'Gestor' && await this.hasManagerUser()) {
        const message = "Já existe um usuário com papel de Gestor. Apenas um usuário Gestor é permitido no sistema.";
        logger.warn(`Tentativa de criar um segundo usuário Gestor bloqueada`);
        return { error: message };
      }

      const result = await db.insert(schema.users).values(insertUser).returning();

      // Invalidar caches relacionados a usuários
      this.userCache.invalidateByPrefix('users:');
      logger.debug(`Cache de usuários invalidado após criação`);

      return result[0];
    } catch (error) {
      logger.error(`Erro ao criar usuário: ${error}`);
      throw error;
    }
  }

  async updateUser(id: number, updateData: InsertUser): Promise<User | undefined | { error: string }> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para atualização de usuário: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;

      // Verificar se o usuário existe
      const user = await this.getUser(validId);
      if (!user) return undefined;

      // Verificar se estamos tentando mudar o papel para Gestor
      // quando já existe outro usuário Gestor
      if (updateData.role === 'Gestor' && user.role !== 'Gestor') {
        // Verificar se já existe um Gestor (excluindo este usuário por segurança)
        if (await this.hasManagerUser(validId)) {
          const message = "Já existe um usuário com papel de Gestor. Apenas um usuário Gestor é permitido no sistema.";
          logger.warn(`Tentativa de ter um segundo usuário Gestor bloqueada na atualização`);
          return { error: message };
        }
      }

      // Atualizar o usuário
      const result = await db
        .update(schema.users)
        .set({
          ...updateData,
          // Não atualizar campos sensíveis se não fornecidos
          passwordHash: updateData.passwordHash || user.passwordHash
        })
        .where(eq(schema.users.id, validId))
        .returning();

      if (result.length > 0) {
        // Invalidar todos os caches relacionados a este usuário
        this.userCache.invalidateByPrefix(`user:${validId}`);
        this.userCache.invalidateByPrefix(`user:username:${user.username}`);
        this.userCache.invalidateByPrefix('users:');

        logger.debug(`Cache de usuário invalidado após atualização: ${validId}`);
      }

      return result[0];
    } catch (error) {
      logger.error(`Erro ao atualizar usuário: ${error}`);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<boolean | { error: string }> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para exclusão de usuário: ${validation.error}`, { id });
        return { error: "ID de usuário inválido" };
      }

      const validId = validation.data;

      // Verificar se o usuário existe
      const user = await this.getUser(validId);
      if (!user) {
        logger.warn(`Tentativa de excluir usuário inexistente: ${validId}`);
        return { error: "Usuário não encontrado" };
      }

      // Verificar se o usuário é um Gestor - proibir a exclusão
      if (user.role === 'Gestor') {
        logger.warn(`Tentativa de excluir usuário Gestor bloqueada: ${user.username} (ID: ${validId})`);
        return { 
          error: "Não é permitido excluir usuários com papel de Gestor" 
        };
      }

      // Verificar se há dados relacionados que impedem a exclusão
      try {
        // Verificar se o usuário tem vendas como consultor onde não pode ser nulo
        const salesAsConsultant = await db.query.sales.findFirst({
          where: eq(schema.sales.consultantId, validId)
        });

        if (salesAsConsultant) {
          return {
            error: "Não é possível excluir este usuário pois possui vendas registradas em seu nome. Para manter a integridade dos dados, desative o usuário em vez de excluí-lo."
          };
        }
      } catch (checkError) {
        logger.warn(`Erro ao verificar dependências do usuário: ${checkError}`);
      }

      // Excluir o usuário
      const deleteResult = await db
        .delete(schema.users)
        .where(eq(schema.users.id, validId))
        .returning();

      if (deleteResult.length === 0) {
        return { error: "Falha ao excluir usuário" };
      }

      // Invalidar todos os caches relacionados a este usuário
      this.userCache.invalidateByPrefix(`user:${validId}`);
      this.userCache.invalidateByPrefix(`user:username:${user.username}`);
      this.userCache.invalidateByPrefix('users:');

      logger.info(`Usuário excluído com sucesso: ${user.username} (ID: ${validId})`);

      return true;
    } catch (error) {
      logger.error(`Erro ao excluir usuário: ${error}`);
      
      // Verificar se é erro de foreign key
      if (error instanceof Error && error.message.includes('foreign key constraint')) {
        return {
          error: "Não é possível excluir este usuário pois possui dados relacionados no sistema. Desative o usuário em vez de excluí-lo para manter a integridade dos dados."
        };
      }
      
      return { error: "Erro interno do servidor ao excluir usuário" };
    }
  }

  async updateUserStatus(id: number, isActive: boolean): Promise<User | undefined> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para atualização de status: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;

      // Verificar se o usuário existe
      const user = await this.getUser(validId);
      if (!user) return undefined;

      // Atualizar apenas o status do usuário
      const result = await db
        .update(schema.users)
        .set({ isActive })
        .where(eq(schema.users.id, validId))
        .returning();

      if (result.length > 0) {
        // Invalidar todos os caches relacionados a este usuário
        this.userCache.invalidateByPrefix(`user:${validId}`);
        this.userCache.invalidateByPrefix(`user:username:${user.username}`);
        this.userCache.invalidateByPrefix('users:');

        logger.debug(`Cache de usuário invalidado após atualização de status: ${validId}`);
      }

      return result[0];
    } catch (error) {
      logger.error(`Erro ao atualizar status do usuário: ${error}`);
      return undefined;
    }
  }

  async getClientes(filter?: ClienteFilter & { 
    page?: number;
    pageSize?: number;
    includeCount?: boolean;
  }): Promise<Cliente[]> {
    try {
      // Validar filtro usando o esquema Zod
      const validationResult = validateClienteFilter(filter);
      if (!validationResult.success) {
        logger.warn(`Filtro inválido para busca de clientes: ${validationResult.error}`, {
          filter,
          details: validationResult.details,
        });
        return [];
      }

      const validFilter = validationResult.data;
      
      // Verificar se validFilter foi definido
      if (!validFilter) {
        logger.warn(`Filtro validado retornou undefined`);
        return [];
      }

      // Gerar chave de cache
      const cacheKey = `clientes:${JSON.stringify(validFilter)}`;

      // Verificar cache primeiro
      const cachedResult = this.clienteCache.get(cacheKey);
      if (cachedResult) {
        logger.debug(`Usando cache para busca de clientes: ${cacheKey}`);
        return cachedResult;
      }

      // Preparar as condições da consulta
      let conditions = [];

      if (validFilter.status) {
        conditions.push(eq(schema.clientes.status, validFilter.status));
      }

      // Se assignedTo e brokerId são o mesmo usuário, buscar por ambos os campos usando OR
      if (validFilter.assignedTo && validFilter.brokerId && validFilter.assignedTo === validFilter.brokerId) {
        conditions.push(
          or(
            eq(schema.clientes.assignedTo, validFilter.assignedTo),
            eq(schema.clientes.brokerId, validFilter.brokerId)
          )
        );
      } else {
        // Caso contrário, aplicar filtros independentes
        if (validFilter.assignedTo) {
          conditions.push(eq(schema.clientes.assignedTo, validFilter.assignedTo));
        }

        if (validFilter.brokerId) {
          conditions.push(eq(schema.clientes.brokerId, validFilter.brokerId));
        }
      }

      if (validFilter.period) {
        const { start, end } = getDateRangeFromPeriod(validFilter.period);
        conditions.push(
          between(
            schema.clientes.createdAt, 
            sql`${start.toISOString()}`, 
            sql`${end.toISOString()}`
          )
        );
      }

      // Filtro de busca por nome, telefone, CPF ou e-mail
      if (validFilter.search) {
        const searchTerm = `%${validFilter.search}%`;
        conditions.push(
          sql`(
            ${schema.clientes.fullName} ILIKE ${searchTerm} OR 
            ${schema.clientes.phone} ILIKE ${searchTerm} OR
            ${schema.clientes.cpf} ILIKE ${searchTerm} OR
            ${schema.clientes.email} ILIKE ${searchTerm}
          )`
        );
      }

      // Determinar a ordem de classificação
      const getOrderBy = () => {
        if (validFilter.order === "mais-antigos") {
          return [asc(schema.clientes.createdAt)];
        }
        return [desc(schema.clientes.createdAt)]; // Padrão: mais-novos
      };

      // Configurar limites para paginação
      const page = validFilter.page || 1;
      const pageSize = validFilter.pageSize || 100; // Padrão: 100 por página
      const offset = (page - 1) * pageSize;

      // Se precisar de contagem total (para paginação)
      if (validFilter.includeCount) {
        // Obter contagem total separadamente - melhor desempenho
        // do que usar COUNT(*) junto com a consulta principal
        const totalCountQuery = db.select({
          count: sql`COUNT(*)`
        }).from(schema.clientes);

        if (conditions.length > 0) {
          totalCountQuery.where(and(...conditions));
        }

        const countResult = await totalCountQuery;
        const totalCount = parseInt(String(countResult[0]?.count || '0'));

        // Armazenar contagem total em variável global para reutilização
        // em paginação e relatórios
        (global as any).__clientesCount = totalCount;
      }

      // Executar consulta principal com paginação
      let result: Cliente[];

      if (conditions.length > 0) {
        result = await db.query.clientes.findMany({
          where: and(...conditions),
          orderBy: getOrderBy(),
          limit: pageSize,
          offset: offset
        });
      } else {
        result = await db.query.clientes.findMany({
          orderBy: getOrderBy(),
          limit: pageSize,
          offset: offset
        });
      }

      // Limitar uso de cache para evitar problemas com muitos dados
      // e garantir que dados sejam atualizados frequentemente
      if (page <= 2) {
        // Limitar o tempo de cache para 60 segundos
        this.clienteCache.set(cacheKey, result, 60000);
        logger.debug(`Armazenando dados no cache: ${cacheKey} (60s)`);
      }

      return result;
    } catch (error) {
      logger.error(`Erro ao buscar clientes: ${error}`);
      return [];
    }
  }

  async getCliente(id: number): Promise<Cliente | undefined> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para busca de cliente: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;

      // Verificar no cache primeiro
      const cacheKey = `cliente:${validId}`;
      const cachedCliente = this.clienteCache.get(cacheKey);
      if (cachedCliente && cachedCliente.length === 1) {
        logger.debug(`Usando cache para cliente: ${validId}`);
        return cachedCliente[0];
      }

      // Buscar no banco de dados
      const clientes = await db.query.clientes.findMany({
        where: eq(schema.clientes.id, validId),
        limit: 1
      });

      // Armazenar no cache
      if (clientes && clientes.length > 0) {
        this.clienteCache.set(cacheKey, clientes);
        logger.debug(`Armazenando cliente no cache: ${validId}`);
      }

      return clientes[0];
    } catch (error) {
      logger.error(`Erro ao buscar cliente: ${error}`);
      return undefined;
    }
  }

  // Método legado mantido para compatibilidade 
  // Método getLead removido - usar getCliente em seu lugar

  async createCliente(insertCliente: InsertCliente): Promise<Cliente> {
    try {
      const now = new Date();
      const clienteWithTimestamps = {
        ...insertCliente,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.insert(schema.clientes).values(clienteWithTimestamps).returning();

      // Invalidar caches relacionados a clientes após criação
      this.clienteCache.invalidateByPrefix('clientes:');
      logger.debug(`Cache de clientes invalidado após criação`);

      return result[0];
    } catch (error) {
      logger.error(`Erro ao criar cliente: ${error}`);
      throw error;
    }
  }

  async updateCliente(id: number, updateData: Partial<InsertCliente>): Promise<Cliente | undefined> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para atualização de cliente: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;

      // Verificar se estamos atualizando o status
      const isStatusUpdate = updateData.status !== undefined;
      const newStatus = updateData.status;

      const now = new Date();
      const updatedData = {
        ...updateData,
        updatedAt: now
      };

      const result = await db
        .update(schema.clientes)
        .set(updatedData)
        .where(eq(schema.clientes.id, validId))
        .returning();

      if (result.length > 0) {
        // Invalidar todos os caches relacionados a este cliente
        this.clienteCache.invalidateByPrefix(`cliente:${validId}`);
        this.clienteCache.invalidateByPrefix('clientes:');

        logger.debug(`Cache de cliente invalidado após atualização: ${validId}`);

        // Se estamos atualizando o status, sincronizar com o lead
        if (isStatusUpdate && newStatus) {
          logger.info(`Sincronizando status do cliente ${validId} (${newStatus}) com o lead correspondente`);
          this.syncLeadStatus(validId, newStatus, 'cliente_to_lead')
            .catch(error => logger.error(`Erro na sincronização de status cliente->lead: ${error}`));
        }
      }

      return result[0];
    } catch (error) {
      logger.error(`Erro ao atualizar cliente: ${error}`);
      return undefined;
    }
  }

  async deleteCliente(id: number): Promise<boolean> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para exclusão de cliente: ${validation.error}`, { id });
        return false;
      }

      const validId = validation.data;

      // ETAPA 1: Primeiro excluir todos os leads associados ao cliente
      try {
        logger.info(`Tentando excluir leads associados ao cliente: ${validId}`);
        
        // Buscar todos os leads associados ao cliente
        const leadsToDelete = await db
          .select({ id: schema.leads.id })
          .from(schema.leads)
          .where(eq(schema.leads.clienteId, validId));
          
        if (leadsToDelete.length > 0) {
          const leadIds = leadsToDelete.map((lead: { id: number }) => lead.id);
          logger.info(`Excluindo ${leadIds.length} leads associados ao cliente ${validId}: ${JSON.stringify(leadIds)}`);
          
          // Excluir os leads na tabela sistema_leads
          const deletedLeads = await db
            .delete(schema.leads)
            .where(eq(schema.leads.clienteId, validId))
            .returning();
            
          logger.info(`Excluídos ${deletedLeads.length} leads associados ao cliente ${validId}`);
        } else {
          logger.info(`Nenhum lead associado ao cliente ${validId} para excluir`);
        }
      } catch (leadError) {
        logger.error(`Erro ao excluir leads associados ao cliente ${validId}: ${leadError}`);
        // Continuar com a exclusão do cliente mesmo se houver erro na exclusão de leads
      }

      // ETAPA 2: Excluir o cliente
      const result = await db
        .delete(schema.clientes)
        .where(eq(schema.clientes.id, validId))
        .returning();

      if (result.length > 0) {
        // Invalidar todos os caches relacionados a este cliente
        this.clienteCache.invalidateByPrefix(`cliente:${validId}`);
        this.clienteCache.invalidateByPrefix('clientes:');
        
        // Também invalidar cache de leads, já que eles foram excluídos
        this.leadsCache.clear();

        logger.info(`Cliente ${validId} e todos os seus leads associados foram excluídos com sucesso`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Erro ao excluir cliente: ${error}`);
      return false;
    }
  }

  // Métodos legados para compatibilidade (removidos)
  // async createLead(insertLead: InsertCliente): Promise<Cliente> { ... }
  // async updateLead(id: number, updateData: InsertCliente): Promise<Cliente | undefined> { ... }

  async getAppointments(filter?: AppointmentFilter): Promise<Appointment[]> {
    try {
      let conditions = [];

      if (filter?.userId) {
        conditions.push(eq(schema.appointments.userId, filter.userId));
      }

      if (filter?.clienteId) {
        conditions.push(eq(schema.appointments.clienteId, filter.clienteId));
      }

      if (filter?.brokerId) {
        conditions.push(eq(schema.appointments.brokerId, filter.brokerId));
      }

      if (filter?.status) {
        conditions.push(eq(schema.appointments.status, filter.status));
      }

      if (filter?.startDate && filter?.endDate) {
        conditions.push(
          between(
            schema.appointments.scheduledAt, 
            sql`${new Date(filter.startDate).toISOString()}`, 
            sql`${new Date(filter.endDate).toISOString()}`
          )
        );
      }

      if (conditions.length > 0) {
        return await db.query.appointments.findMany({
          where: and(...conditions),
          orderBy: [asc(schema.appointments.scheduledAt)]
        });
      } else {
        return await db.query.appointments.findMany({
          orderBy: [asc(schema.appointments.scheduledAt)]
        });
      }
    } catch (error) {
      logger.error(`Erro ao buscar agendamentos: ${error}`);
      return [];
    }
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    try {
      const appointments = await db.query.appointments.findMany({
        where: eq(schema.appointments.id, id),
        limit: 1
      });
      return appointments[0];
    } catch (error) {
      logger.error(`Erro ao buscar agendamento: ${error}`);
      return undefined;
    }
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    try {
      // Usar UTC-3 para created_at e updated_at
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // UTC-3
      
      // Se temos clienteId, vamos buscar o broker_id e assigned_to desse cliente
      let appointmentData = { ...insertAppointment };
      
      if (insertAppointment.clienteId && (!insertAppointment.brokerId || !insertAppointment.assignedTo)) {
        try {
          // Buscar o cliente para obter broker_id e assigned_to
          const cliente = await this.getCliente(insertAppointment.clienteId);
          
          if (cliente) {
            logger.debug(`Obtendo dados complementares do cliente ${cliente.id} para agendamento`);
            
            // Adicionar broker_id se não foi fornecido e existe no cliente
            if (!appointmentData.brokerId && cliente.brokerId) {
              appointmentData.brokerId = cliente.brokerId;
              logger.debug(`Adicionado brokerId ${cliente.brokerId} do cliente ao agendamento`);
            }
            
            // Adicionar assigned_to se não foi fornecido e existe no cliente
            if (!appointmentData.assignedTo && cliente.assignedTo) {
              appointmentData.assignedTo = cliente.assignedTo;
              logger.debug(`Adicionado assignedTo ${cliente.assignedTo} do cliente ao agendamento`);
            }
          }
        } catch (clienteError) {
          logger.warn(`Erro ao buscar dados do cliente para agendamento: ${clienteError}`);
          // Continuamos mesmo se não conseguirmos obter os dados do cliente
        }
      }
      
      const appointmentWithTimestamps = {
        ...appointmentData,
        createdAt: brasiliaTime,
        updatedAt: brasiliaTime
      };

      const result = await db.insert(schema.appointments).values(appointmentWithTimestamps).returning();
      
      // Finalizar todas as duplicatas do SLA cascata quando um agendamento é criado
      if (result[0] && appointmentData.clienteId && appointmentData.userId) {
        try {
          // Importar o serviço de SLA cascata paralelo
          const { slaCascataParallelService } = await import('./services/sla-cascata-parallel.service');
          
          // Finalizar todas as duplicatas para este cliente
          await slaCascataParallelService.finalizarTodasDuplicatas(
            appointmentData.clienteId,
            appointmentData.userId,
            'Agendamento_criado'
          );
          
          logger.info(`SLA cascata finalizado automaticamente para cliente ${appointmentData.clienteId} - agendamento criado por usuário ${appointmentData.userId}`);
        } catch (slaError) {
          // Não falhar a criação do agendamento se houver erro no SLA cascata
          logger.error(`Erro ao finalizar SLA cascata para cliente ${appointmentData.clienteId}: ${slaError}`);
        }
      }

      return result[0];
    } catch (error) {
      logger.error(`Erro ao criar agendamento: ${error}`);
      throw error;
    }
  }

  async updateAppointment(id: number, updateData: Partial<InsertAppointment> | { status: string, updatedAt: Date }): Promise<Appointment | undefined> {
    try {
      // Verificar se estamos apenas atualizando o status (e não a data do agendamento)
      // A API PATCH envia apenas { status: string, updatedAt: Date }
      if ('status' in updateData && Object.keys(updateData).length <= 2 && 'updatedAt' in updateData) {
        // Atualização apenas do status - fazemos uma atualização específica
        

        // Usar UTC-3 para updated_at
        const now = new Date();
        const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // UTC-3

        // Criamos um objeto de atualização que contém apenas os campos que queremos modificar
        const statusUpdateOnly = {
          status: updateData.status,
          updatedAt: brasiliaTime
        };

        const result = await db
          .update(schema.appointments)
          .set(statusUpdateOnly)
          .where(eq(schema.appointments.id, id))
          .returning();

        return result[0];
      } else {
        // Atualização normal - todos os campos
        

        // Usar UTC-3 para updated_at
        const now = new Date();
        const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // UTC-3
        const updatedData = {
          ...updateData,
          updatedAt: brasiliaTime
        };

        const result = await db
          .update(schema.appointments)
          .set(updatedData)
          .where(eq(schema.appointments.id, id))
          .returning();

        return result[0];
      }
    } catch (error) {
      logger.error(`Erro ao atualizar agendamento: ${error}`);
      return undefined;
    }
  }

  async getVisits(filter?: VisitFilter): Promise<Visit[]> {
    try {
      let conditions = [];

      if (filter?.userId) {
        conditions.push(eq(schema.visits.assignedTo, filter.userId));
      }

      if (filter?.clienteId) {
        conditions.push(eq(schema.visits.clienteId, filter.clienteId));
      }

      if (filter?.brokerId) {
        conditions.push(eq(schema.visits.brokerId, filter.brokerId));
      }

      if (filter?.period) {
        const { start, end } = getDateRangeFromPeriod(filter.period);
        conditions.push(
          between(
            schema.visits.visitedAt, 
            sql`${start.toISOString()}`, 
            sql`${end.toISOString()}`
          )
        );
      }

      if (conditions.length > 0) {
        return await db.query.visits.findMany({
          where: and(...conditions),
          orderBy: [desc(schema.visits.visitedAt)]
        });
      } else {
        return await db.query.visits.findMany({
          orderBy: [desc(schema.visits.visitedAt)]
        });
      }
    } catch (error) {
      logger.error(`Erro ao buscar visitas: ${error}`);
      return [];
    }
  }

  async getVisit(id: number): Promise<Visit | undefined> {
    try {
      const visits = await db.query.visits.findMany({
        where: eq(schema.visits.id, id),
        limit: 1
      });
      return visits[0];
    } catch (error) {
      logger.error(`Erro ao buscar visita: ${error}`);
      return undefined;
    }
  }

  async createVisit(insertVisit: InsertVisit): Promise<Visit> {
    try {
      // Usar UTC-3 para created_at e updated_at
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // UTC-3
      
      // Se temos clienteId, vamos buscar o broker_id e assigned_to desse cliente
      let visitData = { ...insertVisit };
      
      if (insertVisit.clienteId && (!insertVisit.brokerId || !insertVisit.assignedTo)) {
        try {
          // Buscar o cliente para obter broker_id e assigned_to
          const cliente = await this.getCliente(insertVisit.clienteId);
          
          if (cliente) {
            logger.debug(`Obtendo dados complementares do cliente ${cliente.id} para visita`);
            
            // Adicionar broker_id se não foi fornecido e existe no cliente
            if (!visitData.brokerId && cliente.brokerId) {
              visitData.brokerId = cliente.brokerId;
              logger.debug(`Adicionado brokerId ${cliente.brokerId} do cliente à visita`);
            }
            
            // Adicionar assigned_to se não foi fornecido e existe no cliente
            if (!visitData.assignedTo && cliente.assignedTo) {
              visitData.assignedTo = cliente.assignedTo;
              logger.debug(`Adicionado assignedTo ${cliente.assignedTo} do cliente à visita`);
            }
          }
        } catch (clienteError) {
          logger.warn(`Erro ao buscar dados do cliente para visita: ${clienteError}`);
          // Continuamos mesmo se não conseguirmos obter os dados do cliente
        }
      }
      
      const visitWithTimestamp = {
        ...visitData,
        createdAt: brasiliaTime,
        updatedAt: brasiliaTime
      };

      const result = await db.insert(schema.visits).values(visitWithTimestamp).returning();
      return result[0];
    } catch (error) {
      logger.error(`Erro ao criar visita: ${error}`);
      throw error;
    }
  }

  async updateVisit(id: number, updateData: Partial<InsertVisit>): Promise<Visit | undefined> {
    try {
      // Usar UTC-3 para updated_at
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // UTC-3
      const updateWithTimestamp = {
        ...updateData,
        updatedAt: brasiliaTime // Atualiza o timestamp usando horário do Brasil
      };

      const result = await db
        .update(schema.visits)
        .set(updateWithTimestamp)
        .where(eq(schema.visits.id, id))
        .returning();

      if (result.length === 0) {
        return undefined;
      }

      return result[0];
    } catch (error) {
      logger.error(`Erro ao atualizar visita ${id}: ${error}`);
      throw error;
    }
  }

  async deleteVisit(id: number): Promise<boolean> {    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para exclusão de visita: ${validation.error}`, { id });
        return false;
      }

      const validId = validation.data;

      // Excluir a visita
      const result = await db
        .delete(schema.visits)
        .where(eq(schema.visits.id, validId))
        .returning();

      if (result.length > 0) {
        logger.debug(`Visita excluída com sucesso: ${validId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Erro ao excluir visita: ${error}`);
      return false;
    }
  }

  async getSales(filter?: SaleFilter): Promise<Sale[]> {
    try {
      let conditions = [];

      if (filter?.userId) {
        conditions.push(eq(schema.sales.assignedTo, filter.userId));
      }

      if (filter?.clienteId) {
        conditions.push(eq(schema.sales.clienteId, filter.clienteId));
      }

      if (filter?.brokerId) {
        conditions.push(eq(schema.sales.brokerId, filter.brokerId));
      }

      if (filter?.period) {
        const { start, end } = getDateRangeFromPeriod(filter.period);
        conditions.push(
          between(
            schema.sales.soldAt, 
            sql`${start.toISOString()}`, 
            sql`${end.toISOString()}`
          )
        );
      }

      if (conditions.length > 0) {
        return await db.query.sales.findMany({
          where: and(...conditions),
          orderBy: [desc(schema.sales.soldAt)]
        });
      } else {
        return await db.query.sales.findMany({
          orderBy: [desc(schema.sales.soldAt)]
        });
      }
    } catch (error) {
      logger.error(`Erro ao buscar vendas: ${error}`);
      return [];
    }
  }

  async getSale(id: number): Promise<Sale | undefined> {
    try {
      const sales = await db.query.sales.findMany({
        where: eq(schema.sales.id, id),
        limit: 1
      });
      return sales[0];
    } catch (error) {
      logger.error(`Erro ao buscar venda: ${error}`);
      return undefined;
    }
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    try {
      // Criar a data atual
      const now = new Date();
      
      // Ajustar para UTC-3 (horário do Brasil) subtraindo 3 horas
      // Isso evita que o PostgreSQL adicione 3 horas adicionais 
      // quando converter para UTC
      const adjustedNow = new Date(now);
      adjustedNow.setHours(now.getHours() - 3);
      
      // Se temos clienteId, vamos buscar o broker_id e assigned_to desse cliente
      let saleData = { ...insertSale };
      
      if (insertSale.clienteId && (!insertSale.brokerId || !insertSale.assignedTo)) {
        try {
          // Buscar o cliente para obter broker_id e assigned_to
          const cliente = await this.getCliente(insertSale.clienteId);
          
          if (cliente) {
            logger.debug(`Obtendo dados complementares do cliente ${cliente.id} para venda`);
            
            // Adicionar broker_id se não foi fornecido e existe no cliente
            if (!saleData.brokerId && cliente.brokerId) {
              saleData.brokerId = cliente.brokerId;
              logger.debug(`Adicionado brokerId ${cliente.brokerId} do cliente à venda`);
            }
            
            // Adicionar assigned_to se não foi fornecido e existe no cliente
            if (!saleData.assignedTo && cliente.assignedTo) {
              saleData.assignedTo = cliente.assignedTo;
              logger.debug(`Adicionado assignedTo ${cliente.assignedTo} do cliente à venda`);
            }
          }
        } catch (clienteError) {
          logger.warn(`Erro ao buscar dados do cliente para venda: ${clienteError}`);
          // Continuamos mesmo se não conseguirmos obter os dados do cliente
        }
      }
      
      const saleWithTimestamps = {
        ...saleData,
        createdAt: adjustedNow,
        updatedAt: adjustedNow
      };

      const result = await db.insert(schema.sales).values(saleWithTimestamps).returning();
      return result[0];
    } catch (error) {
      logger.error(`Erro ao criar venda: ${error}`);
      throw error;
    }
  }

  async getMetrics(filter?: MetricFilter): Promise<Metric[]> {
    try {
      let conditions = [];

      if (filter?.userId) {
        conditions.push(eq(schema.metrics.userId, filter.userId));
      }

      if (filter?.period) {
        const { start, end } = getDateRangeFromPeriod(filter.period);
        conditions.push(
          between(
            schema.metrics.createdAt, 
            sql`${start.toISOString()}`, 
            sql`${end.toISOString()}`
          )
        );
      }

      if (conditions.length > 0) {
        return await db.query.metrics.findMany({
          where: and(...conditions),
          orderBy: [desc(schema.metrics.createdAt)]
        });
      } else {
        return await db.query.metrics.findMany({
          orderBy: [desc(schema.metrics.createdAt)]
        });
      }
    } catch (error) {
      logger.error(`Erro ao buscar métricas: ${error}`);
      return [];
    }
  }

  // Método para excluir agendamento
  async deleteAppointment(id: number): Promise<boolean> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success) {
        logger.warn(`ID inválido para exclusão de agendamento: ${validation.error}`, { id });
        return false;
      }

      const validId = validation.data;
      if (typeof validId !== 'number') {
        logger.warn(`ID de validação não é um número: ${validId}`, { id });
        return false;
      }

      // Excluir o agendamento
      const result = await db
        .delete(schema.appointments)
        .where(eq(schema.appointments.id, validId))
        .returning();

      if (result.length > 0) {
        logger.debug(`Agendamento excluído com sucesso: ${validId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Erro ao excluir agendamento: ${error}`);
      return false;
    }
  }

  // Método para atualizar venda
  async updateSale(id: number, updateData: InsertSale): Promise<Sale | undefined> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success) {
        logger.warn(`ID inválido para atualização de venda: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;
      if (typeof validId !== 'number') {
        logger.warn(`ID de validação não é um número: ${validId}`, { id });
        return undefined;
      }
      
      // Criar a data atual
      const now = new Date();
      
      // Ajustar para UTC-3 (horário do Brasil) subtraindo 3 horas
      // Isso evita que o PostgreSQL adicione 3 horas adicionais 
      // quando converter para UTC
      const adjustedNow = new Date(now);
      adjustedNow.setHours(now.getHours() - 3);

      // Atualizar os campos da venda
      const result = await db
        .update(schema.sales)
        .set({
          ...updateData,
          updatedAt: adjustedNow
        })
        .where(eq(schema.sales.id, validId))
        .returning();

      if (result.length > 0) {
        logger.debug(`Venda atualizada com sucesso: ${validId}`);
        return result[0];
      }

      return undefined;
    } catch (error) {
      logger.error(`Erro ao atualizar venda: ${error}`);
      return undefined;
    }
  }

  // Método para excluir venda
  async deleteSale(id: number): Promise<boolean> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success) {
        logger.warn(`ID inválido para exclusão de venda: ${validation.error}`, { id });
        return false;
      }

      const validId = validation.data;
      if (typeof validId !== 'number') {
        logger.warn(`ID de validação não é um número: ${validId}`, { id });
        return false;
      }
      
      // Verificar se a venda existe antes de tentar excluir
      const sale = await this.getSale(id);
      if (!sale) {
        logger.warn(`Venda não encontrada para exclusão: ID ${validId}`);
        return false;
      }
      
      logger.info(`Iniciando exclusão da venda ID ${validId}`);

      // Excluir a venda
      const result = await db
        .delete(schema.sales)
        .where(eq(schema.sales.id, validId))
        .returning();

      if (result.length > 0) {
        logger.info(`Venda excluída com sucesso: ${validId}`);
        return true;
      }

      logger.warn(`Nenhum registro afetado ao excluir venda ${validId}`);
      return false;
    } catch (error) {
      logger.error(`Erro ao excluir venda: ${error}`);
      return false;
    }
  }

  async createMetric(insertMetric: InsertMetric): Promise<Metric> {
    try {
      const now = new Date();
      const metricWithTimestamp = {
        ...insertMetric,
        createdAt: now
      };

      const result = await db.insert(schema.metrics).values(metricWithTimestamp).returning();
      return result[0];
    } catch (error) {
      logger.error(`Erro ao criar métrica: ${error}`);
      throw error;
    }
  }
  
  // Leads
  async getLeads(filter?: { status?: string, assignedTo?: number, source?: string, searchTerm?: string, period?: string, page?: number, pageSize?: number, includeCount?: boolean }): Promise<{ leads: Lead[], total?: number }> {
    try {
      const page = filter?.page || 1;
      const pageSize = filter?.pageSize || 10;
      const offset = (page - 1) * pageSize;
      const includeCount = filter?.includeCount ?? true;
      
      // Gerar chave de cache
      const cacheKey = `leads:${JSON.stringify({ ...filter, page, pageSize, includeCount })}`;

      // Verificar cache primeiro
      const cachedResult = this.leadsCache.get(cacheKey);
      if (cachedResult) {
        logger.debug(`Usando cache para busca de leads: ${cacheKey}`);
        return cachedResult;
      }
      
      const conditions = [];
      
      if (filter?.status) {
        conditions.push(eq(schema.sistemaLeads.status, filter.status));
      }
      
      if (filter?.assignedTo) {
        conditions.push(eq(schema.sistemaLeads.assignedTo, filter.assignedTo));
      }
      
      if (filter?.source) {
        conditions.push(eq(schema.sistemaLeads.source, filter.source));
      }
      
      if (filter?.searchTerm) {
        const term = `%${filter.searchTerm}%`;
        conditions.push(
          sql`(${schema.sistemaLeads.fullName} ILIKE ${term} OR ${schema.sistemaLeads.email} ILIKE ${term} OR ${schema.sistemaLeads.phone} ILIKE ${term})`
        );
      }
      
      // Filtro por período
      if (filter?.period) {
        const now = new Date();
        let startDate = new Date();
        
        if (filter.period === "today") {
          startDate.setHours(0, 0, 0, 0);
        } else if (filter.period === "week") {
          startDate.setDate(now.getDate() - 7);
        } else if (filter.period === "month") {
          startDate.setMonth(now.getMonth() - 1);
        } else if (filter.period === "quarter") {
          startDate.setMonth(now.getMonth() - 3);
        } else if (filter.period === "year") {
          startDate.setFullYear(now.getFullYear() - 1);
        }
        
        conditions.push(gt(schema.sistemaLeads.createdAt, startDate));
      }
      
      const whereClause = conditions.length > 0 
        ? and(...conditions) 
        : undefined;
      
      // Consulta principal para os leads - usando SQL direto da tabela sistema_leads
      const query = db.select({
        id: schema.sistemaLeads.id,
        fullName: schema.sistemaLeads.fullName,
        email: schema.sistemaLeads.email,
        phone: schema.sistemaLeads.phone,
        source: schema.sistemaLeads.source,
        sourceDetails: schema.sistemaLeads.sourceDetails,
        status: schema.sistemaLeads.status,
        assignedTo: schema.sistemaLeads.assignedTo,
        notes: schema.sistemaLeads.notes,
        isRecurring: schema.sistemaLeads.isRecurring,
        clienteId: schema.sistemaLeads.clienteId,
        createdAt: schema.sistemaLeads.createdAt,
        updatedAt: schema.sistemaLeads.updatedAt,
        tags: schema.sistemaLeads.tags,
        lastActivityDate: schema.sistemaLeads.lastActivityDate,
        score: schema.sistemaLeads.score,
        interesse: schema.sistemaLeads.interesse,
        budget: schema.sistemaLeads.budget,
        metaData: schema.sistemaLeads.metaData
      })
      .from(schema.sistemaLeads)
      .orderBy(desc(schema.sistemaLeads.createdAt))
      .limit(pageSize)
      .offset(offset);

      if (whereClause) {
        query.where(whereClause);
      }

      const result = await query;
      
      let total = 0;
      if (includeCount) {
        // Consulta para contagem total
        const countResult = await db.select({ count: sql<number>`count(*)` })
          .from(schema.sistemaLeads)
          .where(whereClause || sql`1=1`);
        
        total = Number(countResult[0]?.count || 0);
      }
      
      const resultData = { 
        leads: result,
        total: includeCount ? total : undefined
      };
      
      // Armazenar no cache
      this.leadsCache.set(cacheKey, resultData);
      logger.debug(`Armazenando dados no cache: ${cacheKey} (60s)`);
      
      return resultData;
    } catch (error) {
      logger.error(`Erro ao buscar leads: ${error}`);
      return { leads: [] };
    }
  }

  async getLead(id: number): Promise<Lead | undefined> {
    try {
      // Validate ID
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para busca de lead: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;
      
      const lead = await db.query.leads.findFirst({
        where: eq(leads.id, validId),
        with: {
          assignedUser: true
        }
      });

      return lead || undefined;
    } catch (error) {
      logger.error(`Erro ao buscar lead: ${error}`);
      return undefined;
    }
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    try {
      const now = new Date();
      const leadWithTimestamps = {
        ...insertLead,
        // Definir status padrão como "Novo Lead" se não for especificado
        status: insertLead.status || LeadStatusEnum.NOVO_LEAD,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.insert(leads).values(leadWithTimestamps).returning();
      
      // Usar o resultado diretamente em vez de buscar novamente
      const lead = result[0] as Lead;
      if (!lead) {
        throw new Error("Erro ao criar lead");
      }

      // Iniciar SLA cascata paralelo automaticamente para novos leads
      try {
        if (lead.clienteId) {
          // Importar o serviço de SLA cascata paralelo
          const { slaCascataParallelService } = await import('./services/sla-cascata-parallel.service');
          
          // Iniciar cascata automaticamente
          await slaCascataParallelService.iniciarSLACascataParalelo(lead.id, lead.clienteId);
          
          logger.info(`SLA cascata paralelo iniciado automaticamente para lead ${lead.id}, cliente ${lead.clienteId}`);
        } else {
          logger.warn(`Lead ${lead.id} criado sem clienteId - SLA cascata não foi iniciado`);
        }
      } catch (slaError) {
        // Não falhar a criação do lead se houver erro no SLA cascata
        logger.error(`Erro ao iniciar SLA cascata para lead ${lead.id}: ${slaError}`);
      }

      // Invalidar cache de leads
      this.leadsCache.clear();
      
      return lead;
    } catch (error) {
      logger.error(`Erro ao criar lead: ${error}`);
      throw error;
    }
  }
  
  async updateLead(id: number, updateData: UpdateLead): Promise<Lead | undefined> {
    try {
      // Validate ID
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para atualização de lead: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;
      
      // Check if lead exists
      const lead = await this.getLead(validId);
      if (!lead) {
        logger.warn(`Lead não encontrado para atualização: ${validId}`);
        return undefined;
      }
      
      // Update lead
      const now = new Date();
      const leadToUpdate = {
        ...updateData,
        updatedAt: now
      };
      
      await db.update(leads)
        .set(leadToUpdate)
        .where(eq(leads.id, validId));
      
      // Return updated lead
      return await this.getLead(validId);
    } catch (error) {
      logger.error(`Erro ao atualizar lead: ${error}`);
      throw error;
    }
  }
  
  async deleteLead(id: number): Promise<boolean> {
    try {
      // Validate ID
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para exclusão de lead: ${validation.error}`, { id });
        return false;
      }

      const validId = validation.data;
      
      // Delete lead
      const result = await db.delete(leads)
        .where(eq(leads.id, validId))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      logger.error(`Erro ao excluir lead: ${error}`);
      return false;
    }
  }

  async convertLeadToCliente(id: number): Promise<Cliente | { error: string }> {
    try {
      // Validar ID usando o esquema de validação
      const validation = validateId(id);
      if (!validation.success || typeof validation.data !== 'number') {
        logger.warn(`ID inválido para conversão de lead: ${validation.error}`, { id });
        return { error: "ID de lead inválido" };
      }

      const validId = validation.data;
      
      // Obter o lead
      const lead = await this.getLead(validId);
      if (!lead) {
        logger.warn(`Lead não encontrado para conversão: ${validId}`);
        return { error: "Lead não encontrado" };
      }
      
      // Verificar se já existe um cliente com o mesmo telefone
      const existingClientes = await db.select()
        .from(clientes)
        .where(eq(clientes.phone, lead.phone));
      
      if (existingClientes.length > 0) {
        logger.warn(`Tentativa de conversão de lead com telefone duplicado: ${lead.phone}`);
        return { error: "Já existe um cliente com este telefone" };
      }
      
      // Criar objeto de cliente a partir dos dados do lead
      const clienteData: InsertCliente = {
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        assignedTo: lead.assignedTo,
        status: ClienteStatus.SEM_ATENDIMENTO
      };
      
      // Inserir o novo cliente
      const newCliente = await this.createCliente(clienteData);
      
      // Atualizar lead para indicar que foi convertido e guardar o ID do cliente
      await this.updateLead(validId, {
        status: LeadStatusEnum.FECHADO,
        clienteId: newCliente.id
      });
      
      logger.info(`Lead ${validId} convertido para cliente ${newCliente.id} com sucesso`);
      
      return newCliente;
    } catch (error) {
      logger.error(`Erro ao converter lead para cliente: ${error}`);
      return { error: `Erro ao converter lead para cliente: ${error}` };
    }
  }

  /**
   * @deprecated Esta função foi removida. Use getClientesReport() em vez disso.
   * @param period Período para filtro (day, week, month, year)
   * @returns Relatório de clientes com o mesmo formato que getClientesReport
   */
  async getLeadsReport(period?: string): Promise<ClientesReportResult> {
    // Usar a mensagem de depreciação padronizada e o sistema de logs
    logger.warn(getDeprecationMessage("getLeadsReport"), { 
      period,
      functionName: "getLeadsReport",
      stackTrace: new Error().stack 
    });

    // Chamar a nova função
    return this.getClientesReport(period);
  }

  /**
   * Gera relatório de clientes por status para o período especificado
   * @param period Período para filtro (day, week, month, year)
   * @returns Objeto com total e contagem por status
   */
  async getClientesReport(period?: string): Promise<ClientesReportResult> {
    try {
      // Para evitar problemas de cache, vamos fazer uma consulta direta ao banco para contar os clientes
      const { start, end } = getDateRangeFromPeriod(period);

      // Consulta para contar clientes baseada no período - usando tabela clientes
      const countQuery = sql`
        SELECT COUNT(*) as total 
        FROM ${schema.clientes} 
        WHERE ${schema.clientes.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
      `;

      // Executar a consulta para contar o total
      const countResults = await db.execute(countQuery);
      // Verificar se countResults tem o formato esperado
      if (!countResults || !Array.isArray(countResults.rows) || countResults.rows.length === 0) {
        logger.warn(`Resultado inesperado na consulta de contagem de clientes: ${JSON.stringify(countResults)}`);
        return { total: 0, byStatus: {} };
      }
      
      // Extrair o total de clientes da primeira linha do resultado
      const totalStr = countResults.rows[0]?.total;
      const total = totalStr ? parseInt(totalStr.toString(), 10) : 0;
      
      logger.info(`Total de clientes encontrados para o período ${period}: ${total}`);

      // Consulta para agrupar por status
      const statusQuery = sql`
        SELECT ${schema.clientes.status} as status, COUNT(*) as count
        FROM ${schema.clientes}
        WHERE ${schema.clientes.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
        GROUP BY ${schema.clientes.status}
      `;

      // Executar a consulta para agrupar por status
      const statusResults = await db.execute(statusQuery);
      
      // Verificar se statusResults tem o formato esperado
      if (!statusResults || !Array.isArray(statusResults.rows)) {
        logger.warn(`Resultado inesperado na consulta de status de clientes: ${JSON.stringify(statusResults)}`);
        return { total, byStatus: {} };
      }

      // Construir o objeto byStatus
      const byStatus: Record<string, number> = {};
      for (const row of statusResults.rows) {
        if (row && typeof row === 'object') {
          const status = (row.status as string) || 'Desconhecido';
          const countValue = row.count ? parseInt(row.count.toString(), 10) : 0;
          byStatus[status] = countValue;
        }
      }

      logger.debug(`Relatório de clientes gerado com sucesso para o período: ${period}. Total: ${total}`);

      return {
        total,
        byStatus
      };
    } catch (error) {
      logger.error(`Erro ao gerar relatório de clientes: ${error}`);
      return { total: 0, byStatus: {} };
    }
  }

  /**
   * Gera relatório de produção com estatísticas de conversão
   * @param period Período para filtro (day, week, month, year)
   * @returns Relatório com métricas de produção e taxas de conversão
   */
  async getProductionReport(period?: string): Promise<ProductionReportResult> {
    try {
      const { start, end } = getDateRangeFromPeriod(period);

      // Obter o relatório de clientes usando o método corrigido
      const clientesReport = await this.getClientesReport(period);
      const totalLeads = clientesReport.total;

      // Buscar dados de agendamentos, visitas e vendas para o período
      const appointments = await this.getAppointments({
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });
      const visits = await this.getVisits({ period });
      const sales = await this.getSales({ period });

      // Get all users
      const users = await this.getAllUsers();

      // Initialize user stats
      const byUser: Record<number, any> = {};

      for (const user of users) {
        if (user.department === UserDepartment.VENDAS) {
          byUser[user.id] = {
            userId: user.id,
            fullName: user.fullName,
            role: user.role,
            leads: 0,
            appointments: 0,
            visits: 0,
            sales: 0,
            conversionRates: {
              appointmentsToLeads: 0,
              visitsToAppointments: 0,
              salesToVisits: 0,
            }
          };
        }
      }

      try {
        // Obter contagem de clientes por usuário através de consulta direta
        const userLeadsQuery = sql`
          SELECT ${schema.clientes.assignedTo} as user_id, COUNT(*) as lead_count
          FROM ${schema.clientes}
          WHERE ${schema.clientes.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
          AND ${schema.clientes.assignedTo} IS NOT NULL
          GROUP BY ${schema.clientes.assignedTo}
        `;

        const userLeadsResults = await db.execute(userLeadsQuery);
        
        // Verificar se userLeadsResults é iterável
        if (Array.isArray(userLeadsResults)) {
          // Atribuir contagem de clientes aos usuários
          for (const row of userLeadsResults) {
            if (row && typeof row === 'object' && row.user_id) {
              const userId = parseInt(row.user_id as string, 10);
              if (byUser[userId]) {
                byUser[userId].leads = parseInt(row.lead_count as string, 10);
              }
            }
          }
        } else {
          logger.warn(`Resultado inesperado na consulta de leads por usuário: ${JSON.stringify(userLeadsResults)}`);
        }
      } catch (queryError) {
        logger.error(`Erro na consulta de clientes por usuário: ${queryError}`);
        // Continuar a execução mesmo em caso de erro nesta consulta
      }

      // Count appointments by user
      for (const appointment of appointments) {
        const userId = appointment.userId;
        if (userId !== null && userId !== undefined && byUser[userId]) {
          byUser[userId].appointments += 1;
        }
      }

      // Count visits by user
      for (const visit of visits) {
        const userId = visit.userId;
        if (userId !== null && userId !== undefined && byUser[userId]) {
          byUser[userId].visits += 1;
        }
      }

      // Count sales by user
      for (const sale of sales) {
        const userId = sale.userId;
        if (userId !== null && userId !== undefined && byUser[userId]) {
          byUser[userId].sales += 1;
        }
      }

      // Calculate conversion rates
      for (const userId in byUser) {
        const user = byUser[userId];

        // Avoid division by zero
        user.conversionRates.appointmentsToLeads = 
          user.leads > 0 ? Math.round((user.appointments / user.leads) * 100) : 0;

        user.conversionRates.visitsToAppointments = 
          user.appointments > 0 ? Math.round((user.visits / user.appointments) * 100) : 0;

        user.conversionRates.salesToVisits = 
          user.visits > 0 ? Math.round((user.sales / user.visits) * 100) : 0;
      }

      logger.debug(`Relatório de produção gerado com sucesso. Total de clientes: ${totalLeads}`);

      return {
        totalLeads,
        totalAppointments: appointments.length,
        totalVisits: visits.length,
        totalSales: sales.length,
        byUser
      };
    } catch (error) {
      logger.error(`Erro ao gerar relatório de produção: ${error}`);
      return { 
        totalLeads: 0, 
        totalAppointments: 0, 
        totalVisits: 0, 
        totalSales: 0, 
        byUser: {} 
      };
    }
  }

  async getAppointmentsReport(period?: string): Promise<AppointmentsReportResult> {
    try {
      const { start, end } = getDateRangeFromPeriod(period);

      // Realizar consulta direta na tabela clientes_agendamentos para contar os agendamentos no período
      // Usando created_at em vez de scheduledAt conforme solicitado pelo cliente
      const countQuery = sql`
        SELECT COUNT(*) as total 
        FROM ${schema.appointments} 
        WHERE ${schema.appointments.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
      `;

      // Executar a consulta para contar o total
      const countResults = await db.execute(countQuery);
      
      // Verificar se countResults tem o formato esperado
      if (!countResults || !Array.isArray(countResults.rows) || countResults.rows.length === 0) {
        logger.warn(`Resultado inesperado na consulta de contagem de agendamentos: ${JSON.stringify(countResults)}`);
        return { total: 0, byStatus: {}, byUser: {}, byDay: {} };
      }
      
      // Extrair o total de agendamentos da primeira linha do resultado
      const totalStr = countResults.rows[0]?.total;
      const total = totalStr ? parseInt(totalStr.toString(), 10) : 0;
      
      logger.info(`Total de agendamentos encontrados para o período ${period}: ${total}`);

      // Buscar agendamentos detalhados para o período usando created_at em vez de scheduledAt
      // Usando SQL direto para garantir consistência com a consulta de contagem
      const appointmentsQuery = sql`
        SELECT * FROM ${schema.appointments}
        WHERE ${schema.appointments.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
        ORDER BY ${schema.appointments.createdAt} DESC
      `;
      
      const appointmentsResult = await db.execute(appointmentsQuery);
      const appointments = appointmentsResult.rows || [];

      // Aggregating by status and user
      const byStatus: Record<string, number> = {};
      const byUser: Record<number, number> = {};
      const byDay: Record<string, number> = {};

      // Log para debug da estrutura dos agendamentos retornados
      logger.debug(`Estrutura dos agendamentos: ${JSON.stringify(appointments.length > 0 ? appointments[0] : {})}`);

      for (const appointment of appointments) {
        // Como estamos usando SQL direto, precisamos garantir o acesso seguro aos campos
        const status = appointment?.status || 'Desconhecido';
        byStatus[status] = (byStatus[status] || 0) + 1;

        const userId = appointment?.user_id || appointment?.userId;
        if (userId !== null && userId !== undefined) {
          byUser[userId] = (byUser[userId] || 0) + 1;
        }

        // Format date as YYYY-MM-DD for grouping by day
        // Usamos created_at em vez de scheduledAt conforme solicitado
        const dateStr = appointment?.created_at || appointment?.createdAt;
        if (dateStr) {
          const day = new Date(dateStr).toISOString().split('T')[0];
          byDay[day] = (byDay[day] || 0) + 1;
        }
      }

      // Get user details
      const users = await this.getAllUsers();
      const userDetails: Record<number, { fullName: string; role: string; count: number }> = {};

      for (const userId in byUser) {
        const numUserId = parseInt(userId);
        const user = users.find(u => u.id === numUserId);
        if (user) {
          userDetails[numUserId] = {
            fullName: user.fullName,
            role: user.role,
            count: byUser[numUserId]
          };
        }
      }

      // Usar o total obtido diretamente da consulta SQL em vez de appointments.length
      return {
        total: total,
        byStatus,
        byUser: userDetails,
        byDay
      };
    } catch (error) {
      logger.error(`Erro ao gerar relatório de agendamentos: ${error}`);
      return { total: 0, byStatus: {}, byUser: {}, byDay: {} };
    }
  }

  async getVisitsReport(period?: string): Promise<VisitsReportResult> {
    try {
      // Obter período a partir do filtro
      const { start, end } = getDateRangeFromPeriod(period);
      
      // Realizar consulta direta na tabela clientes_visitas para contar as visitas no período por created_at
      const countQuery = sql`
        SELECT COUNT(*) as total 
        FROM ${schema.visits} 
        WHERE ${schema.visits.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
      `;

      // Executar a consulta para contar o total
      const countResults = await db.execute(countQuery);
      
      // Verificar se countResults tem o formato esperado
      if (!countResults || !Array.isArray(countResults.rows) || countResults.rows.length === 0) {
        logger.warn(`Resultado inesperado na consulta de contagem de visitas: ${JSON.stringify(countResults)}`);
        return { total: 0, byUser: {}, byDay: {}, byProperty: {} };
      }
      
      // Extrair o total de visitas da primeira linha do resultado
      const totalStr = countResults.rows[0]?.total;
      const total = totalStr ? parseInt(totalStr.toString(), 10) : 0;
      
      logger.info(`Total de visitas encontradas para o período ${period}: ${total}`);

      // Consultar detalhes das visitas usando created_at
      const visitsQuery = sql`
        SELECT * FROM ${schema.visits}
        WHERE ${schema.visits.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
        ORDER BY ${schema.visits.createdAt} DESC
      `;
      
      const visitsResult = await db.execute(visitsQuery);
      const visits = visitsResult.rows || [];
      
      // Log para debug
      logger.debug(`Estrutura das visitas: ${JSON.stringify(visits.length > 0 ? visits[0] : {})}`);

      // Aggregating by user
      const byUser: Record<number, number> = {};
      const byDay: Record<string, number> = {};
      const byProperty: Record<string, number> = {};

      for (const visit of visits) {
        // Como estamos usando SQL direto, garantimos o acesso seguro aos campos
        const userId = visit?.user_id || visit?.userId;
        if (userId !== null && userId !== undefined) {
          byUser[userId] = (byUser[userId] || 0) + 1;
        }

        // Format date as YYYY-MM-DD for grouping by day - usando created_at em vez de visitedAt
        const dateStr = visit?.created_at || visit?.createdAt;
        if (dateStr) {
          const day = new Date(dateStr).toISOString().split('T')[0];
          byDay[day] = (byDay[day] || 0) + 1;
        }

        // Group by property ID (ou valor padrão se nulo)
        const propertyId = visit?.property_id || visit?.propertyId || 'Não especificado';
        byProperty[propertyId] = (byProperty[propertyId] || 0) + 1;
      }

      // Get user details
      const users = await this.getAllUsers();
      const userDetails: Record<number, { fullName: string; role: string; count: number }> = {};

      for (const userId in byUser) {
        const numUserId = parseInt(userId);
        const user = users.find(u => u.id === numUserId);
        if (user) {
          userDetails[numUserId] = {
            fullName: user.fullName,
            role: user.role,
            count: byUser[numUserId]
          };
        }
      }

      return {
        total: visits.length,
        byUser: userDetails,
        byDay,
        byProperty
      };
    } catch (error) {
      logger.error(`Erro ao gerar relatório de visitas: ${error}`);
      return { total: 0, byUser: {}, byDay: {}, byProperty: {} };
    }
  }

  async getSalesReport(period?: string): Promise<SalesReportResult> {
    try {
      // Obter período a partir do filtro
      const { start, end } = getDateRangeFromPeriod(period);
      
      // Realizar consulta direta na tabela clientes_vendas para contar as vendas no período por created_at
      const countQuery = sql`
        SELECT COUNT(*) as total, SUM(CAST(value AS DECIMAL)) as total_value
        FROM ${schema.sales} 
        WHERE ${schema.sales.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
      `;

      // Executar a consulta para contar o total
      const countResults = await db.execute(countQuery);
      
      // Verificar se countResults tem o formato esperado
      if (!countResults || !Array.isArray(countResults.rows) || countResults.rows.length === 0) {
        logger.warn(`Resultado inesperado na consulta de contagem de vendas: ${JSON.stringify(countResults)}`);
        return { total: 0, totalValue: 0, byUser: {}, byMonth: {} };
      }
      
      // Extrair o total de vendas da primeira linha do resultado
      const totalStr = countResults.rows[0]?.total;
      const total = totalStr ? parseInt(totalStr.toString(), 10) : 0;
      
      // Extrair o valor total das vendas
      const totalValueStr = countResults.rows[0]?.total_value;
      let totalValue = totalValueStr ? parseFloat(totalValueStr.toString()) : 0;
      
      // Garantir que totalValue não seja NaN
      if (isNaN(totalValue)) totalValue = 0;
      
      logger.info(`Total de vendas encontradas para o período ${period}: ${total} (Valor total: ${totalValue})`);

      // Consultar detalhes das vendas usando created_at
      const salesQuery = sql`
        SELECT * FROM ${schema.sales}
        WHERE ${schema.sales.createdAt} BETWEEN ${start.toISOString()} AND ${end.toISOString()}
        ORDER BY ${schema.sales.createdAt} DESC
      `;
      
      const salesResult = await db.execute(salesQuery);
      const sales = salesResult.rows || [];
      
      // Log para debug
      logger.debug(`Estrutura das vendas: ${JSON.stringify(sales.length > 0 ? sales[0] : {})}`);

      // Aggregating by user
      const byUser: Record<number, any> = {};
      const byMonth: Record<string, any> = {};

      for (const sale of sales) {
        // Como estamos usando SQL direto, garantimos o acesso seguro aos campos
        const userId = sale?.user_id || sale?.userId;
        
        // Initialize user data if it doesn't exist
        if (userId !== null && userId !== undefined) {
          if (!byUser[userId]) {
            byUser[userId] = {
              count: 0,
              value: 0
            };
          }

          byUser[userId].count += 1;
          // Ensure sale.value is treated as a number
          const saleValue = typeof sale.value === 'string' ? parseFloat(sale.value) : (sale?.value || 0);
          byUser[userId].value += saleValue;
        }

        // Format date as YYYY-MM for grouping by month using created_at instead of soldAt
        const dateStr = sale?.created_at || sale?.createdAt;
        if (dateStr) {
          const month = new Date(dateStr).toISOString().substring(0, 7);
          if (!byMonth[month]) {
            byMonth[month] = {
              count: 0,
              value: 0
            };
          }

          byMonth[month].count += 1;

          // Ensure sale.value is treated as a number for the month aggregation
          const monthSaleValue = typeof sale.value === 'string' ? parseFloat(sale.value) : (sale?.value || 0);
          byMonth[month].value += monthSaleValue;
        }
      }

      // Get user details
      const users = await this.getAllUsers();
      const userDetails: Record<number, any> = {};

      for (const userId in byUser) {
        const user = users.find(u => u.id === parseInt(userId));
        if (user) {
          userDetails[userId] = {
            fullName: user.fullName,
            role: user.role,
            count: byUser[parseInt(userId)].count,
            value: byUser[parseInt(userId)].value
          };
        }
      }

      return {
        total: total,
        totalValue,
        byUser: userDetails,
        byMonth
      };
    } catch (error) {
      logger.error(`Erro ao gerar relatório de vendas: ${error}`);
      return { total: 0, totalValue: 0, byUser: {}, byMonth: {} };
    }
  }

  // WhatsApp Instances
  async getWhatsappInstances(): Promise<WhatsappInstance[]> {
    try {
      const result = await db.select().from(whatsappInstances);
      return result;
    } catch (error) {
      logger.error(`Erro ao buscar instâncias do WhatsApp: ${error}`);
      return [];
    }
  }

  async getWhatsappInstance(id: string): Promise<WhatsappInstance | undefined> {
    try {
      const result = await db.select().from(whatsappInstances).where(eq(whatsappInstances.instanciaId, id));
      return result.length ? result[0] : undefined;
    } catch (error) {
      logger.error(`Erro ao buscar instância do WhatsApp ${id}: ${error}`);
      return undefined;
    }
  }

  async getWhatsappInstanceByName(instanceName: string): Promise<WhatsappInstance | undefined> {
    try {
      const result = await db.select().from(whatsappInstances).where(eq(whatsappInstances.instanceName, instanceName));
      return result.length ? result[0] : undefined;
    } catch (error) {
      logger.error(`Erro ao buscar instância do WhatsApp com nome ${instanceName}: ${error}`);
      return undefined;
    }
  }

  async getWhatsappInstanceByUser(userId: number): Promise<WhatsappInstance | undefined> {
    try {
      const result = await db.select()
        .from(whatsappInstances)
        .where(eq(whatsappInstances.userId, userId));
      return result.length ? result[0] : undefined;
    } catch (error) {
      logger.error(`Erro ao buscar instância do WhatsApp para o usuário ${userId}: ${error}`);
      return undefined;
    }
  }

  async createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    try {
      const result = await db.insert(whatsappInstances).values(instance).returning();
      return result[0];
    } catch (error) {
      logger.error(`Erro ao criar instância do WhatsApp: ${error}`);
      throw error;
    }
  }

  async createWhatsappInstanceWithId(instance: InsertWhatsappInstance & { instanciaId: string }): Promise<WhatsappInstance> {
    try {
      const result = await db.insert(whatsappInstances).values(instance).returning();
      return result[0];
    } catch (error) {
      logger.error(`Erro ao criar instância do WhatsApp com ID: ${error}`);
      throw error;
    }
  }

  async updateWhatsappInstance(id: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined> {
    try {
      const result = await db.update(whatsappInstances)
        .set({
          ...instance,
          updatedAt: new Date()
        })
        .where(eq(whatsappInstances.instanciaId, id))
        .returning();
      return result.length ? result[0] : undefined;
    } catch (error) {
      logger.error(`Erro ao atualizar instância do WhatsApp ${id}: ${error}`);
      return undefined;
    }
  }

  async updateWhatsappInstanceStatus(id: string, status: string, qrCode?: string): Promise<WhatsappInstance | undefined> {
    try {
      const updateData: any = {
        // O campo 'status' foi renomeado para 'instance_status' no banco
        instanceStatus: status,
        updatedAt: new Date()
      };

      if (status === WhatsAppInstanceStatus.CONNECTED) {
        updateData.lastConnection = new Date();
      }

      if (qrCode) {
        updateData.qrCode = qrCode;
      }

      const result = await db.update(whatsappInstances)
        .set(updateData)
        .where(eq(whatsappInstances.instanciaId, id))
        .returning();

      return result.length ? result[0] : undefined;
    } catch (error) {
      logger.error(`Erro ao atualizar status da instância do WhatsApp ${id}: ${error}`);
      return undefined;
    }
  }

  /**
   * Atualiza informações de ownerJid (remoteJid) e createdAt da instância do WhatsApp
   * @param id ID da instância (campo instanciaId)
   * @param remoteJid O valor do ownerJid da API Evolution (número de telefone da conta)
   * @param apiCreatedAt Data de criação na API Evolution
   * @returns Instância atualizada ou undefined em caso de erro
   */
  async updateWhatsappInstanceApiData(id: string, remoteJid?: string | null, apiCreatedAt?: string | Date | null): Promise<WhatsappInstance | undefined> {
    try {
      const updateData: any = {
        updatedAt: new Date()
      };

      if (remoteJid) {
        updateData.remoteJid = remoteJid;
        logger.info(`Atualizando remoteJid para ${remoteJid}`);
      }

      // Somente atualiza createdAt se for fornecida uma data válida
      if (apiCreatedAt) {
        try {
          const createdDate = apiCreatedAt instanceof Date ? apiCreatedAt : new Date(apiCreatedAt);
          if (!isNaN(createdDate.getTime())) {
            updateData.createdAt = createdDate;
            logger.info(`Atualizando createdAt para ${createdDate.toISOString()}`);
          }
        } catch (dateError) {
          logger.warn(`Erro ao converter data de criação: ${dateError}`);
        }
      }

      // Somente atualiza se houver dados para atualizar
      if (Object.keys(updateData).length > 1) { // Se tiver mais que apenas updatedAt
        const result = await db.update(whatsappInstances)
          .set(updateData)
          .where(eq(whatsappInstances.instanciaId, id))
          .returning();

        return result.length ? result[0] : undefined;
      } else {
        logger.info(`Nenhum dado válido para atualizar na instância ${id}`);
        return await this.getWhatsappInstance(id);
      }
    } catch (error) {
      logger.error(`Erro ao atualizar dados da API da instância do WhatsApp ${id}: ${error}`);
      return undefined;
    }
  }

  async deleteWhatsappInstance(id: string): Promise<boolean> {
    try {
      // Excluímos a instância
      const result = await db.delete(whatsappInstances).where(eq(whatsappInstances.instanciaId, id)).returning();
      return result.length > 0;
    } catch (error) {
      logger.error(`Erro ao excluir instância do WhatsApp ${id}: ${error}`);
      return false;
    }
  }

  // WhatsApp Logs (compatibilidade, tabela removida)
  async getWhatsappLogs(instanceId?: string): Promise<WhatsappLog[]> {
    // A tabela whatsapp_logs foi removida
    logger.info(`Chamada a getWhatsappLogs após remoção da tabela`, { instanceId });
    return [];
  }

  async createWhatsappLog(logData: InsertWhatsappLog): Promise<WhatsappLog> {
    // A tabela whatsapp_logs foi removida
    logger.info(`Chamada a createWhatsappLog após remoção da tabela: ${logData.message}`);
    
    // Retorna objeto simulado para manter compatibilidade
    return {
      id: 0,
      ...logData,
      createdAt: new Date()
    };
  }

  // Cliente Notes
  async getClienteNotes(clienteId: number): Promise<ClienteNote[]> {
    try {
      // Validar ID do cliente
      const validation = validateId(clienteId);
      if (!validation.success) {
        logger.warn(`ID de cliente inválido para busca de anotações: ${validation.error}`, { clienteId });
        return [];
      }

      const validClienteId = validation.data;
      if (typeof validClienteId !== 'number') {
        logger.warn(`ID de cliente de validação não é um número: ${validClienteId}`, { clienteId });
        return [];
      }

      // Buscar anotações para o cliente específico, ordenadas por criação (mais recentes primeiro)
      const notes = await db.query.clienteNotes.findMany({
        where: eq(schema.clienteNotes.clienteId, validClienteId),
        orderBy: [desc(schema.clienteNotes.createdAt)]
      });

      logger.debug(`Buscadas ${notes.length} anotações para o cliente ${validClienteId}`);
      return notes;
    } catch (error) {
      logger.error(`Erro ao buscar anotações do cliente: ${error}`);
      return [];
    }
  }

  async getClienteNote(id: number): Promise<ClienteNote | undefined> {
    try {
      // Validar ID
      const validation = validateId(id);
      if (!validation.success) {
        logger.warn(`ID inválido para busca de anotação: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;
      if (typeof validId !== 'number') {
        logger.warn(`ID de validação não é um número: ${validId}`, { id });
        return undefined;
      }

      // Buscar a anotação específica
      const notes = await db.query.clienteNotes.findMany({
        where: eq(schema.clienteNotes.id, validId),
        limit: 1
      });

      return notes[0];
    } catch (error) {
      logger.error(`Erro ao buscar anotação: ${error}`);
      return undefined;
    }
  }

  async createClienteNote(note: InsertClienteNote): Promise<ClienteNote> {
    try {
      // Criar a anotação no banco de dados com timezone do Brasil (UTC-3)
      const now = new Date();
      const brasilDate = new Date(now.getTime() - (3 * 60 * 60 * 1000));

      const result = await db.insert(schema.clienteNotes).values({
        ...note,
        createdAt: brasilDate,
        updatedAt: brasilDate
      }).returning();

      logger.info(`Anotação criada com sucesso para cliente ${note.clienteId}`);
      return result[0];
    } catch (error) {
      logger.error(`Erro ao criar anotação para cliente: ${error}`);
      throw error;
    }
  }

  async updateClienteNote(id: number, text: string, updateDate?: Date): Promise<ClienteNote | undefined> {
    try {
      // Validar ID
      const validation = validateId(id);
      if (!validation.success) {
        logger.warn(`ID inválido para atualização de anotação: ${validation.error}`, { id });
        return undefined;
      }

      const validId = validation.data;
      if (typeof validId !== 'number') {
        logger.warn(`ID de validação não é um número: ${validId}`, { id });
        return undefined;
      }

      // Verificar se a anotação existe
      const existingNote = await this.getClienteNote(validId);
      if (!existingNote) {
        logger.warn(`Tentativa de atualizar anotação inexistente: ${validId}`);
        return undefined;
      }

      // Atualizar a anotação
      const result = await db.update(schema.clienteNotes)
        .set({ 
          text,
          updatedAt: updateDate || new Date()
        })
        .where(eq(schema.clienteNotes.id, validId))
        .returning();

      logger.info(`Anotação atualizada com sucesso: ${validId}`);
      return result[0];
    } catch (error) {
      logger.error(`Erro ao atualizar anotação: ${error}`);
      return undefined;
    }
  }

  async deleteClienteNote(id: number): Promise<boolean> {
    try {
      // Validar ID
      const validation = validateId(id);
      if (!validation.success) {
        logger.warn(`ID inválido para exclusão de anotação: ${validation.error}`, { id });
        return false;
      }

      const validId = validation.data;
      if (typeof validId !== 'number') {
        logger.warn(`ID de validação não é um número: ${validId}`, { id });
        return false;
      }

      // Verificar se a anotação existe
      const existingNote = await this.getClienteNote(validId);
      if (!existingNote) {
        logger.warn(`Tentativa de excluir anotação inexistente: ${validId}`);
        return false;
      }

      // Excluir a anotação
      const result = await db.delete(schema.clienteNotes)
        .where(eq(schema.clienteNotes.id, validId))
        .returning();

      const deleted = result.length > 0;
      if (deleted) {
        logger.info(`Anotação excluída com sucesso: ${validId}`);
      } else {
        logger.warn(`Falha ao excluir anotação: ${validId}`);
      }

      return deleted;
    } catch (error) {
      logger.error(`Erro ao excluir anotação: ${error}`);
      return false;
    }
  }

  /**
   * Busca um lead pelo ID do cliente associado
   * @param clienteId ID do cliente
   * @returns O lead associado ou undefined
   */
  async getLeadByClienteId(clienteId: number): Promise<Lead | undefined> {
    try {
      const result = await db
        .select()
        .from(leads)
        .where(eq(leads.clienteId, clienteId))
        .limit(1);
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      logger.error(`Erro ao buscar lead por clienteId: ${error}`);
      return undefined;
    }
  }

  /**
   * Sincroniza o status entre cliente e lead
   * @param clienteId ID do cliente
   * @param status Novo status a ser aplicado
   * @param direction Direção da sincronização: 'cliente_to_lead' ou 'lead_to_cliente'
   * @returns true se a sincronização foi bem-sucedida, false caso contrário
   */
  // #region Métodos para Dashboard Performance
  async getClientesCountByDateRange(startDate: string, endDate: string): Promise<number> {
    try {
      const result = await db.select({
        count: sql`COUNT(*)`,
      }).from(clientes)
        .where(
          and(
            sql`created_at >= ${startDate}`,
            sql`created_at <= ${endDate}`
          )
        );
      
      return parseInt(result[0].count.toString()) || 0;
    } catch (error) {
      logger.error(`Erro ao buscar contagem de clientes por período: ${error}`);
      return 0;
    }
  }

  async getAppointmentsCountByDateRange(startDate: string, endDate: string): Promise<number> {
    try {
      const result = await db.select({
        count: sql`COUNT(*)`,
      }).from(appointments)
        .where(
          and(
            sql`created_at >= ${startDate}`,
            sql`created_at <= ${endDate}`
          )
        );
      
      return parseInt(result[0].count.toString()) || 0;
    } catch (error) {
      logger.error(`Erro ao buscar contagem de agendamentos por período: ${error}`);
      return 0;
    }
  }

  async getVisitsCountByDateRange(startDate: string, endDate: string): Promise<number> {
    try {
      const result = await db.select({
        count: sql`COUNT(*)`,
      }).from(visits)
        .where(
          and(
            sql`created_at >= ${startDate}`,
            sql`created_at <= ${endDate}`
          )
        );
      
      return parseInt(result[0].count.toString()) || 0;
    } catch (error) {
      logger.error(`Erro ao buscar contagem de visitas por período: ${error}`);
      return 0;
    }
  }

  async getSalesCountByDateRange(startDate: string, endDate: string): Promise<number> {
    try {
      const result = await db.select({
        count: sql`COUNT(*)`,
      }).from(sales)
        .where(
          and(
            sql`created_at >= ${startDate}`,
            sql`created_at <= ${endDate}`
          )
        );
      
      return parseInt(result[0].count.toString()) || 0;
    } catch (error) {
      logger.error(`Erro ao buscar contagem de vendas por período: ${error}`);
      return 0;
    }
  }
  // #endregion

  async syncLeadStatus(clienteId: number, status: string, direction: 'cliente_to_lead' | 'lead_to_cliente' = 'cliente_to_lead'): Promise<boolean> {
    try {
      // Mapear status do cliente para status do lead e vice-versa
      const statusMapping: Record<string, string> = {
        // Cliente para Lead
        'Sem Atendimento': LeadStatusEnum.NOVO_LEAD,
        'Em Atendimento': LeadStatusEnum.EM_CONTATO,
        'QUALIFICADO': LeadStatusEnum.QUALIFICADO,
        // Lead para Cliente
        [LeadStatusEnum.NOVO_LEAD]: ClienteStatus.SEM_ATENDIMENTO,
        [LeadStatusEnum.EM_CONTATO]: ClienteStatus.SEM_ATENDIMENTO,
        [LeadStatusEnum.QUALIFICADO]: ClienteStatus.AGENDAMENTO,
        [LeadStatusEnum.FECHADO]: ClienteStatus.VENDA,
        [LeadStatusEnum.PERDIDO]: ClienteStatus.NAO_RESPONDEU,
      };

      if (direction === 'cliente_to_lead') {
        // Buscar o lead associado ao cliente
        const lead = await this.getLeadByClienteId(clienteId);
        if (!lead) {
          logger.info(`Nenhum lead encontrado para o cliente ${clienteId} durante a sincronização de status`);
          return false;
        }

        // Mapear o status do cliente para o equivalente no lead
        const leadStatus = statusMapping[status] || status;

        // Evitar atualização desnecessária se o status já for o mesmo
        if (lead.status === leadStatus) {
          return true;
        }

        // Atualizar o status do lead
        await this.updateLead(lead.id, {
          status: leadStatus
        });

        logger.info(`Status do lead ${lead.id} atualizado para ${leadStatus} a partir do cliente ${clienteId}`);
        return true;
      } else {
        // Buscar o lead associado ao cliente
        const lead = await this.getLeadByClienteId(clienteId);
        if (!lead) {
          logger.info(`Nenhum lead encontrado para o cliente ${clienteId} durante a sincronização de status`);
          return false;
        }

        // Mapear o status do lead para o equivalente no cliente
        const clienteStatus = statusMapping[status] || status;

        // Buscar o cliente atual
        const cliente = await this.getCliente(clienteId);
        if (!cliente) {
          logger.warn(`Cliente ${clienteId} não encontrado durante a sincronização de status`);
          return false;
        }

        // Evitar atualização desnecessária se o status já for o mesmo
        if (cliente.status === clienteStatus) {
          return true;
        }

        // Atualizar o status do cliente
        await this.updateCliente(clienteId, {
          status: clienteStatus
        });

        logger.info(`Status do cliente ${clienteId} atualizado para ${clienteStatus} a partir do lead ${lead.id}`);
        return true;
      }
    } catch (error) {
      logger.error(`Erro ao sincronizar status entre cliente e lead: ${error}`);
      return false;
    }
  }
}
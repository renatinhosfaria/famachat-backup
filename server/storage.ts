import {
  users, clientes, appointments, visits, sales, metrics, whatsappInstances, clienteNotes, leads,
  type User, type InsertUser,
  type Cliente, type InsertCliente, type ClienteFilter,
  type Appointment, type InsertAppointment,
  type Visit, type InsertVisit,
  type Sale, type InsertSale,
  type Metric, type InsertMetric,
  type ClienteNote, type InsertClienteNote,
  type WhatsappInstance, type InsertWhatsappInstance,
  type WhatsappLog, type InsertWhatsappLog,
  type Lead, type InsertLead, type UpdateLead,
  Department, Role, ClienteStatus, AppointmentType, AppointmentStatus, WhatsAppInstanceStatus,
  LeadStatusEnum, LeadSourceEnum, sistemaUsersHorarios
} from "@shared/schema";
import { format, subDays, parseISO, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { eq, and, ne, sql } from "drizzle-orm";
import { db } from "./database";
import { logger } from "./utils/logger";

type AppointmentFilter = {
  userId?: number;
  clienteId?: number;
  brokerId?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
};

export type VisitFilter = {
  userId?: number;
  clienteId?: number;
  period?: string;
  propertyId?: string;
};

export type SaleFilter = {
  userId?: number;
  clienteId?: number;
  period?: string;
  propertyId?: string;
};

export type MetricFilter = {
  userId?: number;
  period?: string;
};

export type LeadFilter = {
  status?: string;
  source?: string;
  assignedTo?: number;
  searchTerm?: string;
  period?: string;
  page?: number;
  pageSize?: number;
};

// Função auxiliar para obter intervalo de datas com base no período
export function getDateRangeFromPeriod(period?: string): { start: Date, end: Date } {
  let end = new Date();
  let start = new Date();

  if (!period) {
    // Default to year if no period is provided
    start = new Date(start.getFullYear() - 1, start.getMonth(), start.getDate());
    return { start, end };
  }

  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case "7days":
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start.setMonth(start.getMonth() - 1);
      break;
    case "quarter":
      start.setMonth(start.getMonth() - 3);
      break;
    case "semester":
      start.setMonth(start.getMonth() - 6);
      break;
    case "year":
      // Garantir que o filtro pega dados de todo o ano, independente da data atual
      // Por exemplo, se estamos em 10 de abril de 2025, queremos desde 1º de janeiro de 2024
      // até 31 de dezembro de 2025 para ter um range completo
      start = new Date(end.getFullYear() - 5, 0, 1); // Início do ano, 5 anos atrás (para pegar dados de teste em 2025)
      end = new Date(end.getFullYear(), 11, 31, 23, 59, 59, 999); // Fim do ano atual
      break;
    default:
      start.setDate(start.getDate() - 7);
      break;
  }

  return { start, end };
}

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser & { horariosUsoSistema?: any[] }): Promise<User | { error: string }>;
  updateUser(id: number, user: InsertUser & { horariosUsoSistema?: any[] }): Promise<User | undefined | { error: string }>;
  deleteUser(id: number): Promise<boolean | { error: string }>;
  updateUserStatus(id: number, isActive: boolean): Promise<User | undefined>;
  hasManagerUser(excludeUserId?: number): Promise<boolean>;
  
  // Clientes
  getClientes(filter?: ClienteFilter): Promise<Cliente[]>;
  getCliente(id: number): Promise<Cliente | undefined>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: number, cliente: InsertCliente): Promise<Cliente | undefined>;
  deleteCliente(id: number): Promise<boolean>;
  
  // Appointments
  getAppointments(filter?: AppointmentFilter): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: InsertAppointment): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
  
  // Visits
  getVisits(filter?: VisitFilter): Promise<Visit[]>;
  getVisit(id: number): Promise<Visit | undefined>;
  createVisit(visit: InsertVisit): Promise<Visit>;
  updateVisit(id: number, visit: Partial<InsertVisit>): Promise<Visit | undefined>;
  
  // Sales
  getSales(filter?: SaleFilter): Promise<Sale[]>;
  getSale(id: number): Promise<Sale | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: number, sale: InsertSale): Promise<Sale | undefined>;
  deleteSale(id: number): Promise<boolean>;
  
  // Metrics
  getMetrics(filter?: MetricFilter): Promise<Metric[]>;
  createMetric(metric: InsertMetric): Promise<Metric>;
  
  // Reports
  getClientesReport(period?: string): Promise<any>;
  getProductionReport(period?: string): Promise<any>;
  getAppointmentsReport(period?: string): Promise<any>;
  getVisitsReport(period?: string): Promise<any>;
  getSalesReport(period?: string): Promise<any>;
  
  // WhatsApp Instances
  getWhatsappInstances(): Promise<WhatsappInstance[]>;
  getWhatsappInstance(id: string): Promise<WhatsappInstance | undefined>;
  getWhatsappInstanceByName(instanceName: string): Promise<WhatsappInstance | undefined>;
  getWhatsappInstanceByUser(userId: number): Promise<WhatsappInstance | undefined>;
  createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance>;
  createWhatsappInstanceWithId(instance: InsertWhatsappInstance & { instanciaId: string }): Promise<WhatsappInstance>;
  updateWhatsappInstance(id: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined>;
  updateWhatsappInstanceStatus(id: string, status: string, qrCode?: string): Promise<WhatsappInstance | undefined>;
  updateWhatsappInstanceApiData(id: string, remoteJid?: string | null, apiCreatedAt?: string | Date | null): Promise<WhatsappInstance | undefined>;
  deleteWhatsappInstance(id: string): Promise<boolean>;
  
  // WhatsApp Logs
  getWhatsappLogs(instanceId?: string): Promise<WhatsappLog[]>;
  createWhatsappLog(log: InsertWhatsappLog): Promise<WhatsappLog>;
  
  // Cliente Notes
  getClienteNotes(clienteId: number): Promise<ClienteNote[]>;
  getClienteNote(id: number): Promise<ClienteNote | undefined>;
  createClienteNote(note: InsertClienteNote): Promise<ClienteNote>;
  updateClienteNote(id: number, text: string): Promise<ClienteNote | undefined>;
  deleteClienteNote(id: number): Promise<boolean>;
  
  // Leads
  getLeads(filter?: LeadFilter): Promise<{ leads: Lead[], total?: number }>;
  getLead(id: number): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, lead: UpdateLead): Promise<Lead | undefined>;
  deleteLead(id: number): Promise<boolean>;
  convertLeadToCliente(id: number): Promise<Cliente | { error: string }>;
}

// Implementação da DatabaseStorage para PostgreSQL
export class DatabaseStorage implements IStorage {
  private readonly storageLogger = logger.createLogger("DatabaseStorage");
  
  constructor() {
    this.storageLogger.info("PostgreSQL Storage inicializado");
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      this.storageLogger.error("Erro ao buscar usuário por id", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user || undefined;
    } catch (error) {
      this.storageLogger.error("Erro ao buscar usuário por username:", error);
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      this.storageLogger.error("Erro ao buscar todos usuários:", error);
      return [];
    }
  }

  async hasManagerUser(excludeUserId?: number): Promise<boolean> {
    try {
      const query = db.select({ count: sql`count(*)` }).from(users)
        .where(
          and(
            eq(users.role, 'Gestor'),
            excludeUserId ? ne(users.id, excludeUserId) : undefined
          )
        );
      
      const [result] = await query;
      return result.count > 0;
    } catch (error) {
      this.storageLogger.error("Erro ao verificar se existe usuário Gestor:", error);
      return false;
    }
  }

  async createUser(insertUser: InsertUser & { horariosUsoSistema?: any[] }): Promise<User | { error: string }> {
    try {
      // Verificar se já existe um usuário Gestor quando tentamos criar outro
      if (insertUser.role === 'Gestor' && await this.hasManagerUser()) {
        return { 
          error: "Já existe um usuário com papel de Gestor. Apenas um usuário Gestor é permitido no sistema." 
        };
      }
      // Extrai os horários do payload, se existirem
      const { horariosUsoSistema, ...userData } = insertUser;
      // Cria o usuário
      const [user] = await db.insert(users).values(userData).returning();
      // Se houver horários, insere na tabela de horários
      if (user && horariosUsoSistema && Array.isArray(horariosUsoSistema)) {
        for (const h of horariosUsoSistema) {
          await db.insert(sistemaUsersHorarios).values({
            userId: user.id,
            diaSemana: h.dia,
            horarioInicio: h.inicio,
            horarioFim: h.fim,
            diaTodo: h.diaTodo ?? false,
          });
        }
      }
      return user;
    } catch (error) {
      this.storageLogger.error("Erro ao criar usuário:", error);
      return { error: `Erro ao criar usuário: ${error}` };
    }
  }

  async updateUser(id: number, updateData: InsertUser & { horariosUsoSistema?: any[] }): Promise<User | undefined | { error: string }> {
    try {
      const user = await this.getUser(id);
      if (!user) return undefined;
      // Verificar se está tentando mudar para papel de Gestor e já existe outro Gestor
      if (updateData.role === 'Gestor' && user.role !== 'Gestor' && await this.hasManagerUser(id)) {
        return { 
          error: "Já existe um usuário com papel de Gestor. Apenas um usuário Gestor é permitido no sistema." 
        };
      }
      // Extrai os horários do payload, se existirem
      const { horariosUsoSistema, ...userData } = updateData;
      // Atualiza o usuário
      const [updatedUser] = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      // Atualiza os horários se enviados
      if (horariosUsoSistema && Array.isArray(horariosUsoSistema)) {
        // Remove horários antigos
        await db.delete(sistemaUsersHorarios).where(eq(sistemaUsersHorarios.userId, id));
        // Insere os novos
        for (const h of horariosUsoSistema) {
          await db.insert(sistemaUsersHorarios).values({
            userId: id,
            diaSemana: h.dia,
            horarioInicio: h.inicio,
            horarioFim: h.fim,
            diaTodo: h.diaTodo ?? false,
          });
        }
      }
      return updatedUser;
    } catch (error) {
      this.storageLogger.error("Erro ao atualizar usuário:", error);
      return { error: `Erro ao atualizar usuário: ${error}` };
    }
  }

  async deleteUser(id: number): Promise<boolean | { error: string }> {
    try {
      // Buscar o usuário para verificar o papel
      const user = await this.getUser(id);
      if (!user) return false;
      
      // Verificar se o usuário é um Gestor - proibir a exclusão
      if (user.role === 'Gestor') {
        return { 
          error: "Não é permitido excluir usuários com papel de Gestor" 
        };
      }
      
      const result = await db
        .delete(users)
        .where(eq(users.id, id));
      
      return true;
    } catch (error) {
      this.storageLogger.error("Erro ao excluir usuário:", error);
      return { error: `Erro ao excluir usuário: ${error}` };
    }
  }

  async updateUserStatus(id: number, isActive: boolean): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ isActive })
        .where(eq(users.id, id))
        .returning();
      
      return updatedUser;
    } catch (error) {
      this.storageLogger.error("Erro ao atualizar status do usuário:", error);
      return undefined;
    }
  }

  // Implementação provisória do resto da interface para manter compatibilidade
  // As outras funcionalidades serão implementadas conforme necessário
  
  // Métodos para Clientes
  async getClientes(filter?: ClienteFilter): Promise<Cliente[]> {
    return [];
  }
  
  async getCliente(id: number): Promise<Cliente | undefined> {
    return undefined;
  }
  
  async createCliente(cliente: InsertCliente): Promise<Cliente> {
    throw new Error("Método não implementado");
  }
  
  async updateCliente(id: number, cliente: InsertCliente): Promise<Cliente | undefined> {
    return undefined;
  }
  
  async deleteCliente(id: number): Promise<boolean> {
    return false;
  }
  
  // Métodos para Appointments
  async getAppointments(filter?: AppointmentFilter): Promise<Appointment[]> {
    return [];
  }
  
  async getAppointment(id: number): Promise<Appointment | undefined> {
    return undefined;
  }
  
  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    throw new Error("Método não implementado");
  }
  
  async updateAppointment(id: number, appointment: InsertAppointment): Promise<Appointment | undefined> {
    return undefined;
  }
  
  async deleteAppointment(id: number): Promise<boolean> {
    return false;
  }
  
  // Visits
  async getVisits(filter?: VisitFilter): Promise<Visit[]> {
    return [];
  }
  
  async getVisit(id: number): Promise<Visit | undefined> {
    return undefined;
  }
  
  async createVisit(visit: InsertVisit): Promise<Visit> {
    throw new Error("Método não implementado");
  }
  
  async updateVisit(id: number, visit: Partial<InsertVisit>): Promise<Visit | undefined> {
    return undefined;
  }
  
  // Sales
  async getSales(filter?: SaleFilter): Promise<Sale[]> {
    return [];
  }
  
  async getSale(id: number): Promise<Sale | undefined> {
    return undefined;
  }
  
  async createSale(sale: InsertSale): Promise<Sale> {
    throw new Error("Método não implementado");
  }
  
  async updateSale(id: number, sale: InsertSale): Promise<Sale | undefined> {
    return undefined;
  }
  
  async deleteSale(id: number): Promise<boolean> {
    return false;
  }
  
  // Metrics
  async getMetrics(filter?: MetricFilter): Promise<Metric[]> {
    return [];
  }
  
  async createMetric(metric: InsertMetric): Promise<Metric> {
    throw new Error("Método não implementado");
  }
  
  // Reports
  async getClientesReport(period?: string): Promise<any> {
    return {};
  }
  
  async getProductionReport(period?: string): Promise<any> {
    return {};
  }
  
  async getAppointmentsReport(period?: string): Promise<any> {
    return {};
  }
  
  async getVisitsReport(period?: string): Promise<any> {
    return {};
  }
  
  async getSalesReport(period?: string): Promise<any> {
    return {};
  }
  
  // WhatsApp Instances
  async getWhatsappInstances(): Promise<WhatsappInstance[]> {
    return [];
  }
  
  async getWhatsappInstance(id: string): Promise<WhatsappInstance | undefined> {
    return undefined;
  }
  
  async getWhatsappInstanceByName(instanceName: string): Promise<WhatsappInstance | undefined> {
    return undefined;
  }
  
  async getWhatsappInstanceByUser(userId: number): Promise<WhatsappInstance | undefined> {
    return undefined;
  }
  
  async createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    throw new Error("Método não implementado");
  }
  
  async createWhatsappInstanceWithId(instance: InsertWhatsappInstance & { instanciaId: string }): Promise<WhatsappInstance> {
    throw new Error("Método não implementado");
  }
  
  async updateWhatsappInstance(id: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined> {
    return undefined;
  }
  
  async updateWhatsappInstanceStatus(id: string, status: string, qrCode?: string): Promise<WhatsappInstance | undefined> {
    return undefined;
  }
  
  async updateWhatsappInstanceApiData(id: string, remoteJid?: string | null, apiCreatedAt?: string | Date | null): Promise<WhatsappInstance | undefined> {
    return undefined;
  }
  
  async deleteWhatsappInstance(id: string): Promise<boolean> {
    return false;
  }
  
  // WhatsApp Logs
  async getWhatsappLogs(instanceId?: string): Promise<WhatsappLog[]> {
    return [];
  }
  
  async createWhatsappLog(log: InsertWhatsappLog): Promise<WhatsappLog> {
    throw new Error("Método não implementado");
  }
  
  // Cliente Notes
  async getClienteNotes(clienteId: number): Promise<ClienteNote[]> {
    return [];
  }
  
  async getClienteNote(id: number): Promise<ClienteNote | undefined> {
    return undefined;
  }
  
  async createClienteNote(note: InsertClienteNote): Promise<ClienteNote> {
    throw new Error("Método não implementado");
  }
  
  async updateClienteNote(id: number, text: string): Promise<ClienteNote | undefined> {
    return undefined;
  }
  
  async deleteClienteNote(id: number): Promise<boolean> {
    return false;
  }
  
  // Implementação dos métodos de Leads
  async getLeads(filter?: LeadFilter): Promise<{ leads: Lead[], total?: number }> {
    try {
      let query = db.select().from(leads);
      let countQuery;
      
      if (filter?.includeCount) {
        countQuery = db.select({ count: sql`count(*)` }).from(leads);
      }
      
      if (filter) {
        // Aplicar filtros
        if (filter.status) {
          query = query.where(eq(leads.status, filter.status));
          if (countQuery) countQuery = countQuery.where(eq(leads.status, filter.status));
        }
        
        if (filter.source) {
          query = query.where(eq(leads.source, filter.source));
          if (countQuery) countQuery = countQuery.where(eq(leads.source, filter.source));
        }
        
        if (filter.assignedTo) {
          query = query.where(eq(leads.assignedTo, filter.assignedTo));
          if (countQuery) countQuery = countQuery.where(eq(leads.assignedTo, filter.assignedTo));
        }
        
        if (filter.searchTerm) {
          const searchCondition = sql`(
            ${leads.fullName} ILIKE ${`%${filter.searchTerm}%`} OR
            ${leads.email} ILIKE ${`%${filter.searchTerm}%`} OR
            ${leads.phone} ILIKE ${`%${filter.searchTerm}%`}
          )`;
          
          query = query.where(searchCondition);
          if (countQuery) countQuery = countQuery.where(searchCondition);
        }
        
        if (filter.period) {
          const { start, end } = getDateRangeFromPeriod(filter.period);
          const periodCondition = sql`${leads.createdAt} BETWEEN ${start} AND ${end}`;
          
          query = query.where(periodCondition);
          if (countQuery) countQuery = countQuery.where(periodCondition);
        }
        
        // Paginação - aplica apenas na query principal, não na contagem
        if (filter.page && filter.pageSize) {
          const offset = (filter.page - 1) * filter.pageSize;
          query = query.limit(filter.pageSize).offset(offset);
        }
      }
      
      // Ordenação padrão: do mais recente para o mais antigo
      query = query.orderBy(sql`${leads.createdAt} DESC`);
      
      const leadsList = await query;
      
      // Se solicitado, busca a contagem total
      let total;
      if (filter?.includeCount && countQuery) {
        const [result] = await countQuery;
        total = Number(result.count);
      }
      
      return { 
        leads: leadsList,
        total: filter?.includeCount ? total : undefined 
      };
    } catch (error) {
      this.storageLogger.error("Erro ao buscar leads:", error);
      return { leads: [] };
    }
  }
  
  async getLead(id: number): Promise<Lead | undefined> {
    try {
      const [lead] = await db.select().from(leads).where(eq(leads.id, id));
      return lead || undefined;
    } catch (error) {
      this.storageLogger.error(`Erro ao buscar lead com ID ${id}:`, error);
      return undefined;
    }
  }
  
  async createLead(lead: InsertLead): Promise<Lead> {
    try {
      const [newLead] = await db.insert(leads).values(lead).returning();
      return newLead;
    } catch (error) {
      this.storageLogger.error("Erro ao criar lead:", error);
      throw new Error(`Erro ao criar lead: ${error}`);
    }
  }
  
  async updateLead(id: number, leadUpdate: UpdateLead): Promise<Lead | undefined> {
    try {
      const [updatedLead] = await db
        .update(leads)
        .set({
          ...leadUpdate,
          updatedAt: new Date()
        })
        .where(eq(leads.id, id))
        .returning();
      
      return updatedLead;
    } catch (error) {
      this.storageLogger.error(`Erro ao atualizar lead com ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteLead(id: number): Promise<boolean> {
    try {
      await db.delete(leads).where(eq(leads.id, id));
      return true;
    } catch (error) {
      this.storageLogger.error(`Erro ao excluir lead com ID ${id}:`, error);
      return false;
    }
  }
  
  async convertLeadToCliente(id: number): Promise<Cliente | { error: string }> {
    try {
      // Obter o lead
      const lead = await this.getLead(id);
      if (!lead) {
        return { error: "Lead não encontrado" };
      }
      
      // Verificar se já existe um cliente com o mesmo telefone
      const existingClientes = await db.select()
        .from(clientes)
        .where(eq(clientes.phone, lead.phone));
      
      if (existingClientes.length > 0) {
        return { error: "Já existe um cliente com este telefone" };
      }
      
      // Criar objeto de cliente a partir dos dados do lead
      const clienteData: InsertCliente = {
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        assignedTo: lead.assignedTo,
        status: ClienteStatus.SEM_ATENDIMENTO,
        interesse: lead.interesse,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Inserir o novo cliente
      const [newCliente] = await db.insert(clientes)
        .values(clienteData)
        .returning();
      
      // Atualizar o lead para indicar que foi convertido
      await this.updateLead(id, { 
        status: LeadStatusEnum.CONVERTIDO, // Atualizando status ao converter
        clienteId: newCliente.id
      });
      
      return newCliente;
    } catch (error) {
      this.storageLogger.error(`Erro ao converter lead ${id} para cliente:`, error);
      return { error: `Erro ao converter lead para cliente: ${error}` };
    }
  }
}

// Classe de armazenamento em memória para testes
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private clientes: Map<number, Cliente>;
  private appointments: Map<number, Appointment>;
  private visits: Map<number, Visit>;
  private sales: Map<number, Sale>;
  private metrics: Map<number, Metric>;
  private whatsappInstances: Map<string, WhatsappInstance>;
  private clienteNotes: Map<number, ClienteNote>;
  private leads: Map<number, Lead>;
  
  private userIdCounter: number;
  private clienteIdCounter: number;
  private appointmentIdCounter: number;
  private visitIdCounter: number;
  private saleIdCounter: number;
  private metricIdCounter: number;
  private whatsappInstanceIdCounter: number;
  private clienteNoteIdCounter: number;
  private leadIdCounter: number;

  constructor() {
    this.users = new Map();
    this.clientes = new Map();
    this.appointments = new Map();
    this.visits = new Map();
    this.sales = new Map();
    this.metrics = new Map();
    this.whatsappInstances = new Map();
    this.clienteNotes = new Map();
    this.leads = new Map();
    
    this.userIdCounter = 1;
    this.clienteIdCounter = 1;
    this.appointmentIdCounter = 1;
    this.visitIdCounter = 1;
    this.saleIdCounter = 1;
    this.metricIdCounter = 1;
    this.whatsappInstanceIdCounter = 1;
    this.clienteNoteIdCounter = 1;
    this.leadIdCounter = 1;
    
    // Initialize with some sample users
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Create sample users
    const users = [
      {
        username: "gestor1",
        passwordHash: "password", // Em produção, usaria bcrypt.hashSync("password", 10)
        fullName: "Ana Gerência",
        department: Department.MANAGEMENT,
        role: Role.MANAGER,
        email: null,
        phone: null,
        isActive: true
      },
      {
        username: "marketing1",
        passwordHash: "password", // Em produção, usaria bcrypt.hashSync("password", 10)
        fullName: "Marcelo Silva",
        department: Department.MARKETING,
        role: Role.MARKETING,
        email: null,
        phone: null,
        isActive: true
      },
      {
        username: "atendimento1",
        passwordHash: "password", // Em produção, usaria bcrypt.hashSync("password", 10)
        fullName: "Patricia Ferreira",
        department: Department.CUSTOMER_SERVICE,
        role: Role.CONSULTANT,
        email: null,
        phone: null,
        isActive: true
      },
      {
        username: "corretor1",
        passwordHash: "password", // Em produção, usaria bcrypt.hashSync("password", 10)
        fullName: "Carlos Rodrigues",
        department: Department.SALES,
        role: Role.BROKER,
        email: null,
        phone: null,
        isActive: true
      }
    ];
    
    users.forEach(user => this.createUser(user));
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async hasManagerUser(excludeUserId?: number): Promise<boolean> {
    return Array.from(this.users.values()).some(
      (user) => user.role === 'Gestor' && user.id !== excludeUserId
    );
  }

  async createUser(insertUser: InsertUser & { horariosUsoSistema?: any[] }): Promise<User | { error: string }> {
    try {
      // Verificar se já existe um usuário Gestor quando tentamos criar outro
      if (insertUser.role === 'Gestor' && await this.hasManagerUser()) {
        return { 
          error: "Já existe um usuário com papel de Gestor. Apenas um usuário Gestor é permitido no sistema." 
        };
      }
      // Extrai os horários do payload, se existirem
      const { horariosUsoSistema, ...userData } = insertUser;
      // Cria o usuário
      const [user] = await db.insert(users).values(userData).returning();
      // Se houver horários, insere na tabela de horários
      if (user && horariosUsoSistema && Array.isArray(horariosUsoSistema)) {
        for (const h of horariosUsoSistema) {
          await db.insert(sistemaUsersHorarios).values({
            userId: user.id,
            diaSemana: h.dia,
            horarioInicio: h.inicio,
            horarioFim: h.fim,
            diaTodo: h.diaTodo ?? false,
          });
        }
      }
      return user;
    } catch (error) {
      this.storageLogger.error("Erro ao criar usuário:", error);
      return { error: `Erro ao criar usuário: ${error}` };
    }
  }

  // Clientes
  async getClientes(filter?: ClienteFilter): Promise<Cliente[]> {
    let clientes = Array.from(this.clientes.values());
    
    if (filter) {
      if (filter.status) {
        clientes = clientes.filter(cliente => cliente.status === filter.status);
      }
      
      if (filter.assignedTo) {
        clientes = clientes.filter(cliente => cliente.assignedTo === filter.assignedTo);
      }
      
      if (filter.period) {
        const { start, end } = getDateRangeFromPeriod(filter.period);
        clientes = clientes.filter(cliente => {
          const createdAt = new Date(cliente.createdAt);
          return isWithinInterval(createdAt, { start, end });
        });
      }
    }
    
    return clientes;
  }
  
  async getCliente(id: number): Promise<Cliente | undefined> {
    return this.clientes.get(id);
  }
  
  async createCliente(insertCliente: InsertCliente): Promise<Cliente> {
    const id = this.clienteIdCounter++;
    const now = new Date();
    const cliente: Cliente = { 
      ...insertCliente, 
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.clientes.set(id, cliente);
    return cliente;
  }

  async updateCliente(id: number, updateData: InsertCliente): Promise<Cliente | undefined> {
    const cliente = this.clientes.get(id);
    if (!cliente) return undefined;
    
    const updatedCliente: Cliente = { 
      ...cliente, 
      ...updateData,
      id,
      updatedAt: new Date()
    };
    
    this.clientes.set(id, updatedCliente);
    return updatedCliente;
  }
  
  async deleteCliente(id: number): Promise<boolean> {
    return this.clientes.delete(id);
  }

  // Appointments
  async getAppointments(filter?: AppointmentFilter): Promise<Appointment[]> {
    let appointments = Array.from(this.appointments.values());
    
    if (filter) {
      if (filter.userId) {
        appointments = appointments.filter(apt => apt.userId === filter.userId);
      }
      
      if (filter.clienteId) {
        appointments = appointments.filter(apt => apt.clienteId === filter.clienteId);
      }
      
      if (filter.brokerId) {
        appointments = appointments.filter(apt => apt.brokerId === filter.brokerId);
      }
      
      if (filter.status) {
        appointments = appointments.filter(apt => apt.status === filter.status);
      }
      
      if (filter.startDate && filter.endDate) {
        const startDate = parseISO(filter.startDate);
        const endDate = parseISO(filter.endDate);
        
        appointments = appointments.filter(apt => {
          const appointmentStart = new Date(apt.startTime);
          return isWithinInterval(appointmentStart, { start: startDate, end: endDate });
        });
      }
    }
    
    return appointments;
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = this.appointmentIdCounter++;
    const now = new Date();
    const appointment: Appointment = { 
      ...insertAppointment, 
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id: number, updateData: InsertAppointment): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    const updatedAppointment: Appointment = { 
      ...appointment, 
      ...updateData,
      id,
      updatedAt: new Date()
    };
    
    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }
  
  async deleteAppointment(id: number): Promise<boolean> {
    return this.appointments.delete(id);
  }

  // Visits
  async getVisits(filter?: VisitFilter): Promise<Visit[]> {
    let visits = Array.from(this.visits.values());
    
    if (filter) {
      if (filter.userId) {
        visits = visits.filter(visit => visit.userId === filter.userId);
      }
      
      if (filter.clienteId) {
        visits = visits.filter(visit => visit.clienteId === filter.clienteId);
      }
      
      if (filter.propertyId) {
        visits = visits.filter(visit => visit.propertyId === filter.propertyId);
      }
      
      if (filter.period) {
        const { start, end } = getDateRangeFromPeriod(filter.period);
        visits = visits.filter(visit => {
          const createdAt = new Date(visit.createdAt);
          return isWithinInterval(createdAt, { start, end });
        });
      }
    }
    
    return visits;
  }

  async getVisit(id: number): Promise<Visit | undefined> {
    return this.visits.get(id);
  }

  async createVisit(insertVisit: InsertVisit): Promise<Visit> {
    const id = this.visitIdCounter++;
    const now = new Date();
    const visit: Visit = { 
      ...insertVisit, 
      id, 
      createdAt: now 
    };
    this.visits.set(id, visit);
    return visit;
  }
  
  async updateVisit(id: number, updateData: Partial<InsertVisit>): Promise<Visit | undefined> {
    const visit = this.visits.get(id);
    if (!visit) return undefined;
    
    const updatedVisit: Visit = { 
      ...visit, 
      ...updateData,
      id
    };
    
    this.visits.set(id, updatedVisit);
    return updatedVisit;
  }
  
  async deleteVisit(id: number): Promise<boolean> {
    return this.visits.delete(id);
  }

  // Sales
  async getSales(filter?: SaleFilter): Promise<Sale[]> {
    let sales = Array.from(this.sales.values());
    
    if (filter) {
      if (filter.userId) {
        sales = sales.filter(sale => sale.userId === filter.userId);
      }
      
      if (filter.clienteId) {
        sales = sales.filter(sale => sale.clienteId === filter.clienteId);
      }
      
      if (filter.propertyId) {
        sales = sales.filter(sale => sale.propertyId === filter.propertyId);
      }
      
      if (filter.period) {
        const { start, end } = getDateRangeFromPeriod(filter.period);
        sales = sales.filter(sale => {
          const createdAt = new Date(sale.createdAt);
          return isWithinInterval(createdAt, { start, end });
        });
      }
    }
    
    return sales;
  }

  async getSale(id: number): Promise<Sale | undefined> {
    return this.sales.get(id);
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    const id = this.saleIdCounter++;
    const now = new Date();
    const sale: Sale = { 
      ...insertSale, 
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.sales.set(id, sale);
    return sale;
  }
  
  async updateSale(id: number, updateData: InsertSale): Promise<Sale | undefined> {
    const sale = this.sales.get(id);
    if (!sale) return undefined;
    
    const updatedSale: Sale = { 
      ...sale, 
      ...updateData,
      id,
      updatedAt: new Date()
    };
    
    this.sales.set(id, updatedSale);
    return updatedSale;
  }
  
  async deleteSale(id: number): Promise<boolean> {
    return this.sales.delete(id);
  }

  // Metrics
  async getMetrics(filter?: MetricFilter): Promise<Metric[]> {
    let metrics = Array.from(this.metrics.values());
    
    if (filter) {
      if (filter.userId) {
        metrics = metrics.filter(metric => metric.userId === filter.userId);
      }
      
      if (filter.period) {
        const { start, end } = getDateRangeFromPeriod(filter.period);
        metrics = metrics.filter(metric => {
          const date = new Date(metric.date);
          return isWithinInterval(date, { start, end });
        });
      }
    }
    
    return metrics;
  }

  async createMetric(insertMetric: InsertMetric): Promise<Metric> {
    const id = this.metricIdCounter++;
    const now = new Date();
    const metric: Metric = { 
      ...insertMetric, 
      id, 
      createdAt: now 
    };
    this.metrics.set(id, metric);
    return metric;
  }

  // Reports
  async getClientesReport(period?: string): Promise<any> {
    const clientes = await this.getClientes({ period });
    
    // Group clientes by status
    const statusCounts: Record<string, number> = {};
    for (const cliente of clientes) {
      statusCounts[cliente.status] = (statusCounts[cliente.status] || 0) + 1;
    }
    
    // Group clientes by assignedTo
    const userClientes: Record<number, number> = {};
    for (const cliente of clientes) {
      if (cliente.assignedTo) {
        userClientes[cliente.assignedTo] = (userClientes[cliente.assignedTo] || 0) + 1;
      }
    }
    
    return {
      total: clientes.length,
      byStatus: statusCounts,
      byUser: userClientes,
      clientes
    };
  }

  async getProductionReport(period?: string): Promise<any> {
    const clientes = await this.getClientes({ period });
    const appointments = await this.getAppointments({
      startDate: period ? getDateRangeFromPeriod(period).start.toISOString() : undefined,
      endDate: period ? getDateRangeFromPeriod(period).end.toISOString() : undefined
    });
    const visits = await this.getVisits({ period });
    const sales = await this.getSales({ period });
    
    // Group by user
    const users = await this.getAllUsers();
    const production: Record<number, any> = {};
    
    users.forEach(user => {
      const userClientes = clientes.filter(cliente => cliente.assignedTo === user.id);
      const userAppointments = appointments.filter(apt => apt.userId === user.id);
      const userVisits = visits.filter(visit => visit.userId === user.id);
      const userSales = sales.filter(sale => sale.userId === user.id);
      
      production[user.id] = {
        userId: user.id,
        fullName: user.fullName,
        role: user.role,
        clientes: userClientes.length,
        appointments: userAppointments.length,
        visits: userVisits.length,
        sales: userSales.length,
        conversionRates: {
          appointmentsToClientes: userClientes.length ? Math.round((userAppointments.length / userClientes.length) * 100) : 0,
          visitsToAppointments: userAppointments.length ? Math.round((userVisits.length / userAppointments.length) * 100) : 0,
          salesToVisits: userVisits.length ? Math.round((userSales.length / userVisits.length) * 100) : 0
        }
      };
    });
    
    return {
      period,
      totalClientes: clientes.length,
      totalAppointments: appointments.length,
      totalVisits: visits.length,
      totalSales: sales.length,
      byUser: production
    };
  }

  async getAppointmentsReport(period?: string): Promise<any> {
    const appointments = await this.getAppointments({
      startDate: period ? getDateRangeFromPeriod(period).start.toISOString() : undefined,
      endDate: period ? getDateRangeFromPeriod(period).end.toISOString() : undefined
    });
    
    // Group by type
    const typeCounts: Record<string, number> = {};
    Object.values(AppointmentType).forEach(type => {
      typeCounts[type] = appointments.filter(apt => apt.type === type).length;
    });
    
    // Group by status
    const statusCounts: Record<string, number> = {};
    Object.values(AppointmentStatus).forEach(status => {
      statusCounts[status] = appointments.filter(apt => apt.status === status).length;
    });
    
    // Group by user
    const userAppointments: Record<number, number> = {};
    for (const apt of appointments) {
      userAppointments[apt.userId] = (userAppointments[apt.userId] || 0) + 1;
    }
    
    return {
      total: appointments.length,
      byType: typeCounts,
      byStatus: statusCounts,
      byUser: userAppointments,
      appointments
    };
  }

  async getVisitsReport(period?: string): Promise<any> {
    const visits = await this.getVisits({ period });
    
    // Group by outcome
    const outcomeCounts: Record<string, number> = {};
    for (const visit of visits) {
      if (visit.outcome) {
        outcomeCounts[visit.outcome] = (outcomeCounts[visit.outcome] || 0) + 1;
      }
    }
    
    // Group by user
    const userVisits: Record<number, number> = {};
    for (const visit of visits) {
      userVisits[visit.userId] = (userVisits[visit.userId] || 0) + 1;
    }
    
    return {
      total: visits.length,
      byOutcome: outcomeCounts,
      byUser: userVisits,
      visits
    };
  }

  async getSalesReport(period?: string): Promise<any> {
    const sales = await this.getSales({ period });
    
    // Group by status
    const statusCounts: Record<string, number> = {};
    for (const sale of sales) {
      if (sale.status) {
        statusCounts[sale.status] = (statusCounts[sale.status] || 0) + 1;
      }
    }
    
    // Group by user
    const userSales: Record<number, { count: number, value: number }> = {};
    for (const sale of sales) {
      if (sale.userId) {
        if (!userSales[sale.userId]) {
          userSales[sale.userId] = { count: 0, value: 0 };
        }
        userSales[sale.userId].count += 1;
        userSales[sale.userId].value += Number(sale.value);
      }
    }
    
    // Calculate total value
    const totalValue = sales.reduce((sum, sale) => sum + Number(sale.value), 0);
    
    return {
      total: sales.length,
      totalValue,
      byStatus: statusCounts,
      byUser: userSales,
      sales
    };
  }
  
  // WhatsApp Instances
  async getWhatsappInstances(): Promise<WhatsappInstance[]> {
    return Array.from(this.whatsappInstances.values());
  }

  async getWhatsappInstance(id: string): Promise<WhatsappInstance | undefined> {
    return this.whatsappInstances.get(id);
  }

  async getWhatsappInstanceByName(instanceName: string): Promise<WhatsappInstance | undefined> {
    return Array.from(this.whatsappInstances.values()).find(
      (instance) => instance.instanceName === instanceName
    );
  }

  async getWhatsappInstanceByUser(userId: number): Promise<WhatsappInstance | undefined> {
    return Array.from(this.whatsappInstances.values()).find(
      (instance) => instance.userId === userId
    );
  }

  async createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    const now = new Date();
    // Para dar compatibilidade com o modelo anterior, usamos o valor de instanciaId que já deve vir preenchido
    const id = instance.instanciaId;
    
    const whatsappInstance: WhatsappInstance = {
      ...instance,
      createdAt: now,
      updatedAt: now
    };
    
    this.whatsappInstances.set(id, whatsappInstance);
    return whatsappInstance;
  }

  async createWhatsappInstanceWithId(instance: InsertWhatsappInstance & { instanciaId: string }): Promise<WhatsappInstance> {
    const now = new Date();
    const id = instance.instanciaId;
    
    const whatsappInstance: WhatsappInstance = {
      ...instance,
      createdAt: now,
      updatedAt: now
    };
    
    this.whatsappInstances.set(id, whatsappInstance);
    return whatsappInstance;
  }
  
  async updateWhatsappInstance(id: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined> {
    const whatsappInstance = this.whatsappInstances.get(id);
    if (!whatsappInstance) return undefined;
    
    const updatedInstance: WhatsappInstance = {
      ...whatsappInstance,
      ...instance,
      updatedAt: new Date()
    };
    
    this.whatsappInstances.set(id, updatedInstance);
    return updatedInstance;
  }

  async updateWhatsappInstanceStatus(id: string, status: string, qrCode?: string): Promise<WhatsappInstance | undefined> {
    const whatsappInstance = this.whatsappInstances.get(id);
    if (!whatsappInstance) return undefined;
    
    const updatedInstance: WhatsappInstance = {
      ...whatsappInstance,
      status,
      qrCode: qrCode || whatsappInstance.qrCode,
      updatedAt: new Date()
    };
    
    this.whatsappInstances.set(id, updatedInstance);
    return updatedInstance;
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
      const whatsappInstance = this.whatsappInstances.get(id);
      if (!whatsappInstance) return undefined;
      
      const updatedInstance: WhatsappInstance = {
        ...whatsappInstance,
        updatedAt: new Date()
      };
      
      // Atualizar remoteJid se fornecido
      if (remoteJid) {
        updatedInstance.remoteJid = remoteJid;
      }
      
      // Atualizar createdAt se fornecido uma data válida
      if (apiCreatedAt) {
        try {
          const createdDate = apiCreatedAt instanceof Date ? apiCreatedAt : new Date(apiCreatedAt);
          if (!isNaN(createdDate.getTime())) {
            updatedInstance.createdAt = createdDate;
          }
        } catch (dateError) {
          console.warn(`Erro ao converter data de criação: ${dateError}`);
        }
      }
      
      this.whatsappInstances.set(id, updatedInstance);
      return updatedInstance;
    } catch (error) {
      this.storageLogger.error(`Erro ao atualizar dados da API da instância do WhatsApp ${id}: ${error}`);
      return undefined;
    }
  }

  async deleteWhatsappInstance(id: string): Promise<boolean> {
    return this.whatsappInstances.delete(id);
  }
  
  // WhatsApp Logs
  // Atenção: A tabela whatsapp_logs foi removida
  // Essas funções apenas mantêm compatibilidade com o código existente
  async getWhatsappLogs(instanceId?: string): Promise<WhatsappLog[]> {
    // Retorna um array vazio, pois a tabela foi removida
    return [];
  }

  async createWhatsappLog(log: InsertWhatsappLog): Promise<WhatsappLog> {
    // Apenas retorna um objeto simulado, pois a tabela whatsappLogs foi removida
    // Isso mantém compatibilidade com código existente sem gerar erros
    return {
      id: 0,
      ...log,
      createdAt: new Date()
    };
  }
  
  // Cliente Notes
  async getClienteNotes(clienteId: number): Promise<ClienteNote[]> {
    return Array.from(this.clienteNotes.values())
      .filter(note => note.clienteId === clienteId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getClienteNote(id: number): Promise<ClienteNote | undefined> {
    return this.clienteNotes.get(id);
  }
  
  async createClienteNote(note: InsertClienteNote): Promise<ClienteNote> {
    const id = this.clienteNoteIdCounter++;
    const now = new Date();
    const clienteNote: ClienteNote = {
      ...note,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.clienteNotes.set(id, clienteNote);
    return clienteNote;
  }
  
  async updateClienteNote(id: number, text: string): Promise<ClienteNote | undefined> {
    const note = this.clienteNotes.get(id);
    if (!note) return undefined;
    
    const updatedNote: ClienteNote = {
      ...note,
      text,
      updatedAt: new Date()
    };
    
    this.clienteNotes.set(id, updatedNote);
    return updatedNote;
  }
  
  async deleteClienteNote(id: number): Promise<boolean> {
    return this.clienteNotes.delete(id);
  }
  
  // Leads
  async getLeads(filter?: LeadFilter): Promise<{ leads: Lead[], total?: number }> {
    let leads = Array.from(this.leads.values());
    let total = leads.length;
    
    if (filter) {
      if (filter.status) {
        leads = leads.filter(lead => lead.status === filter.status);
      }
      
      if (filter.source) {
        leads = leads.filter(lead => lead.source === filter.source);
      }
      
      if (filter.assignedTo) {
        leads = leads.filter(lead => lead.assignedTo === filter.assignedTo);
      }
      
      if (filter.searchTerm) {
        const searchTerm = filter.searchTerm.toLowerCase();
        leads = leads.filter(lead => 
          lead.fullName.toLowerCase().includes(searchTerm) ||
          (lead.email && lead.email.toLowerCase().includes(searchTerm)) ||
          lead.phone.toLowerCase().includes(searchTerm)
        );
      }
      
      if (filter.period) {
        const { start, end } = getDateRangeFromPeriod(filter.period);
        leads = leads.filter(lead => {
          const createdAt = new Date(lead.createdAt);
          return isWithinInterval(createdAt, { start, end });
        });
      }
      
      total = leads.length;
      
      // Ordenação padrão: do mais recente para o mais antigo
      leads.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Paginação
      if (filter.page && filter.pageSize) {
        const startIdx = (filter.page - 1) * filter.pageSize;
        const endIdx = startIdx + filter.pageSize;
        leads = leads.slice(startIdx, endIdx);
      }
    }
    
    return { leads, total: filter?.includeCount ? total : undefined };
  }
  
  async getLead(id: number): Promise<Lead | undefined> {
    return this.leads.get(id);
  }
  
  async createLead(lead: InsertLead): Promise<Lead> {
    const id = this.leadIdCounter++;
    const now = new Date();
    const newLead: Lead = {
      ...lead,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.leads.set(id, newLead);
    return newLead;
  }
  
  async updateLead(id: number, updateData: UpdateLead): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    
    const updatedLead: Lead = {
      ...lead,
      ...updateData,
      id,
      updatedAt: new Date()
    };
    
    this.leads.set(id, updatedLead);
    return updatedLead;
  }
  
  async deleteLead(id: number): Promise<boolean> {
    return this.leads.delete(id);
  }
  
  async convertLeadToCliente(id: number): Promise<Cliente | { error: string }> {
    const lead = this.leads.get(id);
    if (!lead) {
      return { error: "Lead não encontrado" };
    }
    
    // Verificar se já existe um cliente com o mesmo telefone
    const existingCliente = Array.from(this.clientes.values()).find(
      cliente => cliente.phone === lead.phone
    );
    
    if (existingCliente) {
      return { error: "Já existe um cliente com este telefone" };
    }
    
    // Criar cliente a partir do lead
    const clienteData: InsertCliente = {
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      assignedTo: lead.assignedTo,
      status: ClienteStatus.SEM_ATENDIMENTO,
      interesse: lead.interesse
    };
    
    const newCliente = await this.createCliente(clienteData);
    
    // Atualizar lead para indicar que foi convertido
    await this.updateLead(id, {
      status: LeadStatusEnum.CONVERTIDO,
      clienteId: newCliente.id
    });
    
    return newCliente;
  }
  
  // Métodos necessários para a interface IStorage
  async updateUser(id: number, updateData: InsertUser): Promise<User | undefined | { error: string }> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    // Verificar se está tentando mudar para papel de Gestor e já existe outro Gestor
    if (updateData.role === 'Gestor' && user.role !== 'Gestor' && await this.hasManagerUser(id)) {
      return { 
        error: "Já existe um usuário com papel de Gestor. Apenas um usuário Gestor é permitido no sistema." 
      };
    }
    
    const updatedUser: User = {
      ...user,
      ...updateData,
      id
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean | { error: string }> {
    // Buscar o usuário para verificar o papel
    const user = this.users.get(id);
    if (!user) return false;
    
    // Verificar se o usuário é um Gestor - proibir a exclusão
    if (user.role === 'Gestor') {
      return { 
        error: "Não é permitido excluir usuários com papel de Gestor" 
      };
    }
    
    // Excluir o usuário se não for um Gestor
    return this.users.delete(id);
  }
  
  async updateUserStatus(id: number, isActive: boolean): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      isActive: isActive
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
}

// Importar a PgStorage para usar o PostgreSQL
import { PgStorage } from './pg-storage';

// Comentar temporariamente a linha abaixo para usar PostgreSQL em vez do armazenamento em memória
// export const storage = new MemStorage();

// Usar PostgreSQL para armazenamento permanente
export const storage = new PgStorage();

// Função para calcular tempo na etapa
function calculateTimeInStage(createdAt: Date) {
  const now = new Date();
  const diffMs = now.getTime() - new Date(createdAt).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours >= 24) {
    return `${Math.floor(diffHours / 24)}d`;
  } else if (diffHours >= 1) {
    return `${diffHours}h`;
  } else {
    return `${Math.floor(diffMs / (1000 * 60))}m`;
  }
}

// Atualizar a função getLeads para incluir o processamento de tempo na etapa
export async function getLeads(filter: LeadFilter) {
  try {
    const leads = await db.select().from(leads);
    
    // Processar cada lead
    const processedLeads = leads.map(lead => ({
      ...lead,
      timeInStage: calculateTimeInStage(lead.createdAt)
    }));
    
    return {
      leads: processedLeads,
      total: processedLeads.length
    };
  } catch (error) {
    this.storageLogger.error('Erro ao buscar leads:', error);
    throw error;
  }
}

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { auth } from "../middleware/auth";
// Função local para obter range de datas por período
function getDateRangeFromPeriod(period: string): { start: Date, end: Date } {
  const now = new Date();
  let start = new Date();
  let end = new Date();

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
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "last_month":
      // Mês anterior completo
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "quarter":
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), (currentQuarter * 3) + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "semester":
      // Semestre atual (6 meses)
      const currentSemester = Math.floor(now.getMonth() / 6);
      start = new Date(now.getFullYear(), currentSemester * 6, 1);
      start.setHours(0, 0, 0, 0);
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

// Função para obter taxas de conversão de clientes para agendamentos por mês (global)
async function obterTaxasConversaoClientesParaAgendamentos(): Promise<number[]> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11 (jan-dez)
  
  // Inicializar array para os 12 meses
  const rates: number[] = Array(12).fill(0);
  
  // Iterar apenas até o mês atual do ano corrente
  for (let month = 0; month <= currentMonth; month++) {
    // Definir datas de início e fim para cada mês
    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0); // Último dia do mês
    
    // Formatar datas para consulta SQL
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Buscar contagem de clientes e agendamentos para o mês
    const clientesCount = await storage.getClientesCountByDateRange(startDateStr, endDateStr);
    const appointmentsCount = await storage.getAppointmentsCountByDateRange(startDateStr, endDateStr);
    
    // Calcular taxa de conversão com verificação de divisão por zero
    rates[month] = clientesCount > 0 
      ? Math.round((appointmentsCount / clientesCount) * 100) 
      : 0;
  }
  
  return rates;
}

// Função para obter taxas de conversão de clientes para agendamentos por mês (filtrado por usuário)
async function obterTaxasConversaoClientesParaAgendamentosPorUsuario(userId: number): Promise<number[]> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11 (jan-dez)
  
  // Inicializar array para os 12 meses
  const rates: number[] = Array(12).fill(0);
  
  // Iterar apenas até o mês atual do ano corrente
  for (let month = 0; month <= currentMonth; month++) {
    // Definir datas de início e fim para cada mês
    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0); // Último dia do mês
    
    // Formatar datas para consulta SQL
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Buscar clientes atribuídos ao usuário no mês
    const clientes = await storage.getClientes({ 
      assignedTo: userId,
      // Filtrar por período do mês atual
    });
    
    // Filtrar clientes criados no mês específico
    const clientesDoMes = clientes.filter(cliente => {
      if (!cliente.createdAt) return false;
      const clienteDate = new Date(cliente.createdAt);
      return clienteDate >= startDate && clienteDate <= endDate;
    });
    
    // Buscar agendamentos do usuário no mês
    const appointments = await storage.getAppointments({ 
      userId: userId,
      startDate: startDateStr,
      endDate: endDateStr 
    });
    
    // Calcular taxa de conversão com verificação de divisão por zero
    rates[month] = clientesDoMes.length > 0 
      ? Math.round((appointments.length / clientesDoMes.length) * 100) 
      : 0;
  }
  
  return rates;
}

// Função para obter taxas de conversão de agendamentos para visitas por mês (global)
async function obterTaxasConversaoAgendamentosParaVisitas(): Promise<number[]> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11 (jan-dez)
  
  // Inicializar array para os 12 meses
  const rates: number[] = Array(12).fill(0);
  
  // Iterar apenas até o mês atual do ano corrente
  for (let month = 0; month <= currentMonth; month++) {
    // Definir datas de início e fim para cada mês
    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0); // Último dia do mês
    
    // Formatar datas para consulta SQL
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Buscar contagem de agendamentos e visitas para o mês
    const appointmentsCount = await storage.getAppointmentsCountByDateRange(startDateStr, endDateStr);
    const visitsCount = await storage.getVisitsCountByDateRange(startDateStr, endDateStr);
    
    // Calcular taxa de conversão com verificação de divisão por zero
    rates[month] = appointmentsCount > 0 
      ? Math.round((visitsCount / appointmentsCount) * 100) 
      : 0;
  }
  
  return rates;
}

// Função para obter taxas de conversão de agendamentos para visitas por mês (filtrado por usuário)
async function obterTaxasConversaoAgendamentosParaVisitasPorUsuario(userId: number): Promise<number[]> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11 (jan-dez)
  
  // Inicializar array para os 12 meses
  const rates: number[] = Array(12).fill(0);
  
  // Iterar apenas até o mês atual do ano corrente
  for (let month = 0; month <= currentMonth; month++) {
    // Definir datas de início e fim para cada mês
    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0); // Último dia do mês
    
    // Buscar agendamentos do usuário no mês
    const appointments = await storage.getAppointments({ 
      userId: userId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    
    // Buscar todas as visitas do usuário
    const allVisits = await storage.getVisits({ 
      userId: userId
    });
    
    // Filtrar visitas criadas no mês específico
    const visitsDoMes = allVisits.filter(visit => {
      if (!visit.createdAt) return false;
      const visitDate = new Date(visit.createdAt);
      return visitDate >= startDate && visitDate <= endDate;
    });
    
    // Calcular taxa de conversão com verificação de divisão por zero
    rates[month] = appointments.length > 0 
      ? Math.round((visitsDoMes.length / appointments.length) * 100) 
      : 0;
  }
  
  return rates;
}

// Função para obter taxas de conversão de visitas para vendas por mês (global)
async function obterTaxasConversaoVisitasParaVendas(): Promise<number[]> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11 (jan-dez)
  
  // Inicializar array para os 12 meses
  const rates: number[] = Array(12).fill(0);
  
  // Iterar apenas até o mês atual do ano corrente
  for (let month = 0; month <= currentMonth; month++) {
    // Definir datas de início e fim para cada mês
    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0); // Último dia do mês
    
    // Formatar datas para consulta SQL
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Buscar contagem de visitas e vendas para o mês
    const visitsCount = await storage.getVisitsCountByDateRange(startDateStr, endDateStr);
    const salesCount = await storage.getSalesCountByDateRange(startDateStr, endDateStr);
    
    // Calcular taxa de conversão com verificação de divisão por zero
    rates[month] = visitsCount > 0 
      ? Math.round((salesCount / visitsCount) * 100) 
      : 0;
  }
  
  return rates;
}

// Função para obter taxas de conversão de visitas para vendas por mês (filtrado por usuário)
async function obterTaxasConversaoVisitasParaVendasPorUsuario(userId: number): Promise<number[]> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11 (jan-dez)
  
  // Inicializar array para os 12 meses
  const rates: number[] = Array(12).fill(0);
  
  // Iterar apenas até o mês atual do ano corrente
  for (let month = 0; month <= currentMonth; month++) {
    // Definir datas de início e fim para cada mês
    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0); // Último dia do mês
    
    // Buscar todas as visitas do usuário
    const allVisits = await storage.getVisits({ 
      userId: userId
    });
    
    // Filtrar visitas criadas no mês específico
    const visitsDoMes = allVisits.filter(visit => {
      if (!visit.createdAt) return false;
      const visitDate = new Date(visit.createdAt);
      return visitDate >= startDate && visitDate <= endDate;
    });
    
    // Buscar todas as vendas do usuário
    const allSales = await storage.getSales({ 
      userId: userId
    });
    
    // Filtrar vendas criadas no mês específico
    const salesDoMes = allSales.filter(sale => {
      if (!sale.createdAt) return false;
      const saleDate = new Date(sale.createdAt);
      return saleDate >= startDate && saleDate <= endDate;
    });
    
    // Calcular taxa de conversão com verificação de divisão por zero
    rates[month] = visitsDoMes.length > 0 
      ? Math.round((salesDoMes.length / visitsDoMes.length) * 100) 
      : 0;
  }
  
  return rates;
}

// Função para obter taxas de conversão mensais reais do banco de dados (mantida por compatibilidade)
async function getMonthlyConversionRates() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11 (jan-dez)
  
  // Inicializar arrays para cada métrica
  const appointmentsToClientes: number[] = Array(12).fill(0);
  const visitsToAppointments: number[] = Array(12).fill(0);
  const salesToVisits: number[] = Array(12).fill(0);
  
  // Iterar apenas até o mês atual do ano corrente
  for (let month = 0; month <= currentMonth; month++) {
    // Definir datas de início e fim para cada mês
    const startDate = new Date(currentYear, month, 1);
    const endDate = new Date(currentYear, month + 1, 0); // Último dia do mês
    
    // Formatar datas para consulta SQL
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Buscar contagem de clientes, agendamentos, visitas e vendas para o mês
    const clientesCount = await storage.getClientesCountByDateRange(startDateStr, endDateStr);
    const appointmentsCount = await storage.getAppointmentsCountByDateRange(startDateStr, endDateStr);
    const visitsCount = await storage.getVisitsCountByDateRange(startDateStr, endDateStr);
    const salesCount = await storage.getSalesCountByDateRange(startDateStr, endDateStr);
    
    // Calcular taxas de conversão com verificação de divisão por zero
    appointmentsToClientes[month] = clientesCount > 0 
      ? Math.round((appointmentsCount / clientesCount) * 100) 
      : 0;
      
    visitsToAppointments[month] = appointmentsCount > 0 
      ? Math.round((visitsCount / appointmentsCount) * 100) 
      : 0;
      
    salesToVisits[month] = visitsCount > 0 
      ? Math.round((salesCount / visitsCount) * 100) 
      : 0;
  }
  
  return {
    appointmentsToClientes,
    visitsToAppointments,
    salesToVisits
  };
}

interface DashboardMetrics {
  newClientes: number;
  appointments: number;
  visits: number;
  sales: number;
  conversionRates: {
    appointmentsToClientes: number;
    visitsToAppointments: number;
    salesToVisits: number;
  };
  monthlyConversionRates?: {
    appointmentsToClientes: number[];
    visitsToAppointments: number[];
    salesToVisits: number[];
  };
  teamAverages: {
    newClientes: number;
    appointments: number;
    visits: number;
    sales: number;
  };
  performance: number[]; // 7 days performance data
  teamPerformance: number[]; // 7 days team average performance data
}

export function registerDashboardRoutes(app: Express) {
  // Route with authentication for logged users
  app.get("/api/dashboard/metrics", auth, async (req: Request, res: Response) => {
    try {
      console.log('[Dashboard Metrics] Endpoint acessado');
      console.log('[Dashboard Metrics] Headers de autorização:', req.headers.authorization ? 'Presente' : 'Ausente');
      
      const period = req.query.period as string || "year";
      const filterUserId = req.query.userId ? parseInt(req.query.userId as string) : null;
      
      // Extrair userId do middleware de autenticação JWT
      const authenticatedUser = (req as any).user;
      const authUserId = authenticatedUser?.id;
      const userRole = authenticatedUser?.role;
      
      console.log(`[Dashboard Debug] Usuario autenticado: ${JSON.stringify(authenticatedUser)}`);
      console.log(`[Dashboard Debug] AuthUserId: ${authUserId}, FilterUserId: ${filterUserId}, Role: ${userRole}`);
      
      if (!authUserId) {
        console.log('[Dashboard Metrics] Usuário não autenticado');
        return res.status(401).json({ 
          success: false, 
          message: "Usuário não autenticado" 
        });
      }

      // Para usuários não-gestores, sempre filtrar pelos próprios dados
      // Apenas gestores podem ver dados agregados ou de outros usuários
      const isManager = userRole === 'Gestor' || userRole === 'Administrador';
      const effectiveFilterUserId = isManager ? filterUserId : authUserId;
      
      console.log(`[Dashboard Debug] IsManager: ${isManager}, EffectiveFilterUserId: ${effectiveFilterUserId}`);

      // Obter dados para o período
      const { start, end } = getDateRangeFromPeriod(period);

      let allClientes, allAppointments, allVisits, allSales;

      if (effectiveFilterUserId) {
        // Buscar dados específicos do usuário filtrado usando dual-field search
        console.log(`[Dashboard Debug] Buscando dados para usuário ${effectiveFilterUserId} no período ${period}`);
        
        // Convert null to undefined for TypeScript compatibility
        const userId = effectiveFilterUserId || undefined;
        
        // Buscar clientes onde o usuário é assignedTo OU brokerId
        const clientesAssigned = await storage.getClientes({ 
          assignedTo: userId,
          page: 1,
          pageSize: 2000
        });
        
        const clientesBroker = await storage.getClientes({ 
          brokerId: userId,
          page: 1,
          pageSize: 2000
        });
        
        // Combinar e remover duplicatas
        const clientesMap = new Map();
        [...clientesAssigned, ...clientesBroker].forEach(cliente => {
          clientesMap.set(cliente.id, cliente);
        });
        allClientes = Array.from(clientesMap.values());
        
        // Buscar agendamentos onde o usuário é user_id OU broker_id
        const appointmentsUser = await storage.getAppointments({ userId });
        const appointmentsBroker = await storage.getAppointments({ brokerId: userId });
        
        const appointmentsMap = new Map();
        [...appointmentsUser, ...appointmentsBroker].forEach(appointment => {
          appointmentsMap.set(appointment.id, appointment);
        });
        allAppointments = Array.from(appointmentsMap.values());
        
        // Buscar visitas onde o usuário é userId OU brokerId
        const visitsUser = await storage.getVisits({ userId });
        const visitsBroker = await storage.getVisits({ brokerId: userId });
        
        const visitsMap = new Map();
        [...visitsUser, ...visitsBroker].forEach(visit => {
          visitsMap.set(visit.id, visit);
        });
        allVisits = Array.from(visitsMap.values());
        
        // Buscar vendas onde o usuário é userId OU brokerId
        const salesUser = await storage.getSales({ userId });
        const salesBroker = await storage.getSales({ brokerId: userId });
        
        const salesMap = new Map();
        [...salesUser, ...salesBroker].forEach(sale => {
          salesMap.set(sale.id, sale);
        });
        allSales = Array.from(salesMap.values());
      } else {
        // Buscar dados de todos os usuários (agregado)
        console.log(`[Dashboard Debug] Buscando dados de todos os usuários no período ${period}`);
        
        // Buscar todos os clientes em múltiplas páginas
        const clientesPage1 = await storage.getClientes({ 
          page: 1,
          pageSize: 2000
        });
        const clientesPage2 = await storage.getClientes({ 
          page: 2,
          pageSize: 2000
        });
        const clientesPage3 = await storage.getClientes({ 
          page: 3,
          pageSize: 2000
        });
        allClientes = [...clientesPage1, ...clientesPage2, ...clientesPage3];
        
        // Buscar todos os agendamentos
        allAppointments = await storage.getAppointments({});
        
        // Buscar todas as visitas
        allVisits = await storage.getVisits({});
        
        // Buscar todas as vendas
        allSales = await storage.getSales({});
      }
      
      console.log(`[Dashboard Debug] Dados encontrados: clientes=${allClientes.length}, agendamentos=${allAppointments.length}, visitas=${allVisits.length}, vendas=${allSales.length}`);
      
      // Aplicar filtro de período se necessário
      let clientes = allClientes;
      let appointments = allAppointments;
      let visits = allVisits;
      let sales = allSales;
      
      if (period !== "year") {
        clientes = allClientes.filter(cliente => {
          if (!cliente.createdAt) return false;
          const clienteDate = new Date(cliente.createdAt);
          return clienteDate >= start && clienteDate <= end;
        });
        
        appointments = allAppointments.filter(appointment => {
          if (!appointment.createdAt) return false;
          const appointmentDate = new Date(appointment.createdAt);
          return appointmentDate >= start && appointmentDate <= end;
        });
        
        visits = allVisits.filter(visit => {
          if (!visit.createdAt) return false;
          const visitDate = new Date(visit.createdAt);
          return visitDate >= start && visitDate <= end;
        });
        
        sales = allSales.filter(sale => {
          if (!sale.createdAt) return false;
          const saleDate = new Date(sale.createdAt);
          return saleDate >= start && saleDate <= end;
        });
      }
      
      console.log(`[Dashboard Debug] Após filtro de período (${period}): clientes=${clientes.length}, agendamentos=${appointments.length}, visitas=${visits.length}, vendas=${sales.length}`);
      
      // Criar relatórios simples baseados nos dados reais
      const clientesReport = { total: clientes.length, byStatus: {} };
      const appointmentsReport = { total: appointments.length, byStatus: {}, byUser: {}, byDay: {} };
      const visitsReport = { total: visits.length, byUser: {}, byDay: {}, byProperty: {} };
      const salesReport = { total: sales.length, totalValue: 0, byUser: {}, byMonth: {} };
      const productionReport = { 
        totalLeads: clientes.length, 
        totalAppointments: appointments.length, 
        totalVisits: visits.length, 
        totalSales: sales.length, 
        byUser: {} 
      };

      // Extrair os dados e montar o objeto de métricas
      const metrics: DashboardMetrics = {
        newClientes: clientesReport.total || 0,
        appointments: appointmentsReport.total || 0,
        visits: visitsReport.total || 0,
        sales: salesReport.total || 0,
        conversionRates: {
          appointmentsToClientes: clientesReport.total > 0 ? Math.round((appointmentsReport.total / clientesReport.total) * 100) : 0,
          visitsToAppointments: appointmentsReport.total > 0 ? Math.round((visitsReport.total / appointmentsReport.total) * 100) : 0,
          salesToVisits: visitsReport.total > 0 ? Math.round((salesReport.total / visitsReport.total) * 100) : 0,
        },
        teamAverages: {
          newClientes: Math.max(1, Math.round(clientesReport.total / 3)) || 0, // Usando divisão arbitrária
          appointments: Math.max(1, Math.round(appointmentsReport.total / 3)) || 0,
          visits: Math.max(1, Math.round(visitsReport.total / 3)) || 0,
          sales: Math.max(1, Math.round(salesReport.total / 3)) || 0,
        },
        // Obter dados históricos de taxas de conversão mensais a partir do banco de dados
        monthlyConversionRates: filterUserId ? {
          appointmentsToClientes: await obterTaxasConversaoClientesParaAgendamentosPorUsuario(filterUserId),
          visitsToAppointments: await obterTaxasConversaoAgendamentosParaVisitasPorUsuario(filterUserId),
          salesToVisits: await obterTaxasConversaoVisitasParaVendasPorUsuario(filterUserId),
        } : {
          appointmentsToClientes: await obterTaxasConversaoClientesParaAgendamentos(),
          visitsToAppointments: await obterTaxasConversaoAgendamentosParaVisitas(),
          salesToVisits: await obterTaxasConversaoVisitasParaVendas(),
        },
        performance: [0, 0, 0, 0, 0, 0, 0], // Placeholder - Seria preenchido com dados reais
        teamPerformance: [0, 0, 0, 0, 0, 0, 0], // Placeholder - Seria preenchido com dados reais
      };

      // Log final das métricas para verificar se estão corretas
      console.log(`[Dashboard Debug] Métricas finais para Laura:`, {
        newClientes: metrics.newClientes,
        appointments: metrics.appointments,
        visits: metrics.visits,
        sales: metrics.sales
      });

      res.json(metrics);
    } catch (error) {
      
      res.status(500).json({ 
        message: "Falha ao carregar métricas do dashboard",
        error: String(error)
      });
    }
  });

  // Buscar clientes recentes para o dashboard
  app.get("/api/dashboard/recent-clientes", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
      const dualSearch = req.query.dualSearch ? parseInt(req.query.dualSearch as string) : undefined;
      
      let clientes;

      // Se dualSearch for especificado, buscar em ambos assigned_to e broker_id
      if (dualSearch) {
        // Buscar clientes onde o usuário é assignedTo
        const clientesAssigned = await storage.getClientes({
          assignedTo: dualSearch,
          order: "mais-novos",
          page: 1,
          pageSize: limit
        });
        
        // Buscar clientes onde o usuário é brokerId
        const clientesBroker = await storage.getClientes({
          brokerId: dualSearch,
          order: "mais-novos",
          page: 1,
          pageSize: limit
        });
        
        // Combinar e remover duplicatas, depois ordenar e limitar
        const clientesMap = new Map();
        [...clientesAssigned, ...clientesBroker].forEach(cliente => {
          clientesMap.set(cliente.id, cliente);
        });
        
        // Ordenar por data de criação (mais novos primeiro) e limitar
        const allClientes = Array.from(clientesMap.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, limit);
        
        clientes = allClientes;
      } else {
        clientes = await storage.getClientes({ 
          order: "mais-novos",
          page: 1,
          pageSize: limit,
          assignedTo: assignedTo
        });
      }
      
      res.json(clientes);
    } catch (error) {
      
      res.status(500).json({ message: "Falha ao carregar clientes recentes" });
    }
  });

  // Buscar próximos agendamentos para o dashboard
  app.get("/api/dashboard/upcoming-appointments", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const now = new Date();
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

      // Definir data de início como agora e data de fim como 7 dias no futuro
      const startDate = now.toISOString();
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Buscar agendamentos futuros
      const appointments = await storage.getAppointments({ 
        userId,
        startDate,
        endDate,
        status: "Confirmado" // Filtra apenas agendamentos confirmados
      });

      // Ordenar por data agendada
      appointments.sort((a, b) => {
        const dateA = a.scheduledAt instanceof Date ? a.scheduledAt.getTime() : new Date(a.scheduledAt).getTime();
        const dateB = b.scheduledAt instanceof Date ? b.scheduledAt.getTime() : new Date(b.scheduledAt).getTime();
        return dateA - dateB;
      });

      // Limitar ao número solicitado
      const limitedAppointments = appointments.slice(0, limit);
      
      res.json(limitedAppointments);
    } catch (error) {
      
      res.status(500).json({ message: "Falha ao carregar próximos agendamentos" });
    }
  });
}
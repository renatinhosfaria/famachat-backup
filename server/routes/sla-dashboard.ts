import express from 'express';
import { checkAuth, checkRole } from '../middlewares/auth';
import { slaCascataParallelService } from '../services/sla-cascata-parallel.service';
import { logger } from '../utils/logger';
import { db } from '../database';
import { sistemaLeadsCascata, users, clientes } from '@shared/schema';
import { eq, and, gte, lte, desc, asc } from 'drizzle-orm';

const router = express.Router();

// Inicializa o logger para o módulo de dashboard SLA
const dashboardLogger = logger.createLogger('SLADashboard');

// Middleware para verificar se é um gestor
const checkGestor = checkRole('Gestor');

// Rota para obter métricas gerais do sistema SLA Cascata
router.get('/metrics', checkAuth, checkGestor, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dataInicio = startDate ? new Date(startDate as string) : undefined;
    const dataFim = endDate ? new Date(endDate as string) : undefined;
    
    const metricas = await slaCascataParallelService.obterMetricasPerformance(dataInicio, dataFim);
    
    res.json(metricas);
  } catch (error) {
    dashboardLogger.error('Erro ao obter métricas SLA:', error);
    res.status(500).json({ error: 'Erro ao obter métricas' });
  }
});

// Rota para obter atendimentos ativos em tempo real
router.get('/active-assignments', checkAuth, async (req, res) => {
  try {
    const atendimentosAtivos = await db
      .select({
        id: sistemaLeadsCascata.id,
        clienteId: sistemaLeadsCascata.clienteId,
        leadId: sistemaLeadsCascata.leadId,
        userId: sistemaLeadsCascata.userId,
        sequencia: sistemaLeadsCascata.sequencia,
        slaHoras: sistemaLeadsCascata.slaHoras,
        iniciadoEm: sistemaLeadsCascata.iniciadoEm,
        expiraEm: sistemaLeadsCascata.expiraEm,
        // Dados do usuário
        userName: users.username,
        userFullName: users.fullName,
        userRole: users.role,
        // Dados do cliente
        clienteNome: clientes.fullName,
        clientePhone: clientes.phone,
        clienteEmail: clientes.email,
        clienteStatus: clientes.status,
      })
      .from(sistemaLeadsCascata)
      .leftJoin(users, eq(sistemaLeadsCascata.userId, users.id))
      .leftJoin(clientes, eq(sistemaLeadsCascata.clienteId, clientes.id))
      .where(eq(sistemaLeadsCascata.status, 'Ativo'))
      .orderBy(asc(sistemaLeadsCascata.expiraEm));

    // Calcular tempo restante para cada atendimento
    const agora = new Date();
    const atendimentosComTempo = atendimentosAtivos.map((atendimento: any) => {
      const expiraEm = new Date(atendimento.expiraEm);
      const tempoRestanteMs = expiraEm.getTime() - agora.getTime();
      const tempoRestanteHoras = Math.max(0, Math.round(tempoRestanteMs / (1000 * 60 * 60)));
      
      return {
        ...atendimento,
        tempoRestanteHoras,
        statusTempo: tempoRestanteMs <= 0 ? 'EXPIRADO' : 
                    tempoRestanteMs <= 2 * 60 * 60 * 1000 ? 'CRITICO' : 
                    tempoRestanteMs <= 6 * 60 * 60 * 1000 ? 'ALERTA' : 'OK'
      };
    });

    res.json({
      atendimentos: atendimentosComTempo,
      total: atendimentosComTempo.length,
      resumo: {
        total: atendimentosComTempo.length,
        expirados: atendimentosComTempo.filter((a: any) => a.statusTempo === 'EXPIRADO').length,
        criticos: atendimentosComTempo.filter((a: any) => a.statusTempo === 'CRITICO').length,
        alertas: atendimentosComTempo.filter((a: any) => a.statusTempo === 'ALERTA').length,
        ok: atendimentosComTempo.filter((a: any) => a.statusTempo === 'OK').length,
      }
    });
  } catch (error) {
    dashboardLogger.error('Erro ao buscar atendimentos ativos:', error);
    res.status(500).json({ error: 'Erro ao buscar atendimentos ativos' });
  }
});

// Rota para obter ranking de performance dos usuários
router.get('/user-ranking', checkAuth, checkGestor, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Definir período padrão (últimos 30 dias)
    const agora = new Date();
    const dataInicio = startDate ? new Date(startDate as string) : new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dataFim = endDate ? new Date(endDate as string) : agora;

    // Buscar todos os atendimentos no período
    const atendimentos = await db
      .select({
        userId: sistemaLeadsCascata.userId,
        status: sistemaLeadsCascata.status,
        sequencia: sistemaLeadsCascata.sequencia,
        iniciadoEm: sistemaLeadsCascata.iniciadoEm,
        userName: users.username,
        userFullName: users.fullName,
        userRole: users.role,
      })
      .from(sistemaLeadsCascata)
      .leftJoin(users, eq(sistemaLeadsCascata.userId, users.id))
      .where(
        and(
          gte(sistemaLeadsCascata.iniciadoEm, dataInicio),
          lte(sistemaLeadsCascata.iniciadoEm, dataFim)
        )
      );

    // Calcular métricas por usuário
    const metricas = atendimentos.reduce((acc: any, atendimento: any) => {
      const userId = atendimento.userId;
      
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          userName: atendimento.userName,
          userFullName: atendimento.userFullName,
          userRole: atendimento.userRole,
          totalAtendimentos: 0,
          finalizadosSucesso: 0,
          finalizadosDuplicata: 0,
          expirados: 0,
          ativos: 0,
          taxaConversao: 0,
          mediaSequencia: 0,
          somaSequencias: 0,
        };
      }

      const user = acc[userId];
      user.totalAtendimentos++;
      user.somaSequencias += atendimento.sequencia || 1;

      switch (atendimento.status) {
        case 'Finalizado_Sucesso':
          user.finalizadosSucesso++;
          break;
        case 'Finalizado_Duplicata':
          user.finalizadosDuplicata++;
          break;
        case 'Expirado':
          user.expirados++;
          break;
        case 'Ativo':
          user.ativos++;
          break;
      }

      return acc;
    }, {} as any);

    // Calcular percentuais e ordenar
    const ranking = Object.values(metricas).map((user: any) => {
      user.taxaConversao = user.totalAtendimentos > 0 ? 
        Math.round((user.finalizadosSucesso / user.totalAtendimentos) * 100 * 100) / 100 : 0;
      user.mediaSequencia = user.totalAtendimentos > 0 ? 
        Math.round((user.somaSequencias / user.totalAtendimentos) * 100) / 100 : 0;
      
      return user;
    }).sort((a: any, b: any) => b.taxaConversao - a.taxaConversao);

    res.json({
      periodo: { dataInicio, dataFim },
      ranking,
      total: ranking.length
    });
  } catch (error) {
    dashboardLogger.error('Erro ao buscar ranking de usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking' });
  }
});

// Rota para obter histórico de cascata de um cliente
router.get('/client/:clienteId/cascade-history', checkAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.clienteId);
    
    if (isNaN(clienteId)) {
      return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    const historico = await db
      .select({
        id: sistemaLeadsCascata.id,
        leadId: sistemaLeadsCascata.leadId,
        userId: sistemaLeadsCascata.userId,
        sequencia: sistemaLeadsCascata.sequencia,
        status: sistemaLeadsCascata.status,
        slaHoras: sistemaLeadsCascata.slaHoras,
        iniciadoEm: sistemaLeadsCascata.iniciadoEm,
        expiraEm: sistemaLeadsCascata.expiraEm,
        finalizadoEm: sistemaLeadsCascata.finalizadoEm,
        motivo: sistemaLeadsCascata.motivo,
        // Dados do usuário
        userName: users.username,
        userFullName: users.fullName,
        userRole: users.role,
        // Dados do cliente
        clienteNome: clientes.fullName,
        clientePhone: clientes.phone,
        clienteEmail: clientes.email,
      })
      .from(sistemaLeadsCascata)
      .leftJoin(users, eq(sistemaLeadsCascata.userId, users.id))
      .leftJoin(clientes, eq(sistemaLeadsCascata.clienteId, clientes.id))
      .where(eq(sistemaLeadsCascata.clienteId, clienteId))
      .orderBy(asc(sistemaLeadsCascata.sequencia), asc(sistemaLeadsCascata.iniciadoEm));

    // Calcular estatísticas do histórico
    const estatisticas = {
      totalSequencias: historico.length,
      usuariosEnvolvidos: new Set(historico.map((h: any) => h.userId)).size,
      status: {
        ativo: historico.filter((h: any) => h.status === 'Ativo').length,
        expirado: historico.filter((h: any) => h.status === 'Expirado').length,
        finalizadoSucesso: historico.filter((h: any) => h.status === 'Finalizado_Sucesso').length,
        finalizadoDuplicata: historico.filter((h: any) => h.status === 'Finalizado_Duplicata').length,
      }
    };

    res.json({
      clienteId,
      historico,
      estatisticas
    });
  } catch (error) {
    dashboardLogger.error(`Erro ao buscar histórico de cascata do cliente ${req.params.clienteId}:`, error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// Rota para obter estatísticas de conversão por fonte
router.get('/conversion-by-source', checkAuth, checkGestor, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const agora = new Date();
    const dataInicio = startDate ? new Date(startDate as string) : new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dataFim = endDate ? new Date(endDate as string) : agora;

    // Buscar atendimentos com fonte do cliente
    const atendimentos = await db
      .select({
        clienteSource: clientes.source,
        status: sistemaLeadsCascata.status,
        sequencia: sistemaLeadsCascata.sequencia,
      })
      .from(sistemaLeadsCascata)
      .leftJoin(clientes, eq(sistemaLeadsCascata.clienteId, clientes.id))
      .where(
        and(
          gte(sistemaLeadsCascata.iniciadoEm, dataInicio),
          lte(sistemaLeadsCascata.iniciadoEm, dataFim)
        )
      );

    // Agrupar por fonte e calcular métricas
    const estatisticasPorFonte = atendimentos.reduce((acc: any, atendimento: any) => {
      const fonte = atendimento.clienteSource || 'Não informado';
      
      if (!acc[fonte]) {
        acc[fonte] = {
          fonte,
          totalAtendimentos: 0,
          finalizadosSucesso: 0,
          expirados: 0,
          taxaConversao: 0,
          mediaSequencia: 0,
          somaSequencias: 0,
        };
      }

      const stat = acc[fonte];
      stat.totalAtendimentos++;
      stat.somaSequencias += atendimento.sequencia || 1;

      if (atendimento.status === 'Finalizado_Sucesso') {
        stat.finalizadosSucesso++;
      } else if (atendimento.status === 'Expirado') {
        stat.expirados++;
      }

      return acc;
    }, {} as any);

    // Calcular percentuais
    const estatisticas = Object.values(estatisticasPorFonte).map((stat: any) => {
      stat.taxaConversao = stat.totalAtendimentos > 0 ? 
        Math.round((stat.finalizadosSucesso / stat.totalAtendimentos) * 100 * 100) / 100 : 0;
      stat.mediaSequencia = stat.totalAtendimentos > 0 ? 
        Math.round((stat.somaSequencias / stat.totalAtendimentos) * 100) / 100 : 0;
      
      return stat;
    }).sort((a: any, b: any) => b.totalAtendimentos - a.totalAtendimentos);

    res.json({
      periodo: { dataInicio, dataFim },
      estatisticas,
      total: estatisticas.length
    });
  } catch (error) {
    dashboardLogger.error('Erro ao buscar conversão por fonte:', error);
    res.status(500).json({ error: 'Erro ao buscar conversão por fonte' });
  }
});

// Rota para obter tendências por período (gráfico de linha)
router.get('/trends', checkAuth, checkGestor, async (req, res) => {
  try {
    const { startDate, endDate, period = 'day' } = req.query;
    
    const agora = new Date();
    const dataInicio = startDate ? new Date(startDate as string) : new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dataFim = endDate ? new Date(endDate as string) : agora;

    // Buscar todos os atendimentos no período
    const atendimentos = await db
      .select({
        status: sistemaLeadsCascata.status,
        iniciadoEm: sistemaLeadsCascata.iniciadoEm,
        finalizadoEm: sistemaLeadsCascata.finalizadoEm,
      })
      .from(sistemaLeadsCascata)
      .where(
        and(
          gte(sistemaLeadsCascata.iniciadoEm, dataInicio),
          lte(sistemaLeadsCascata.iniciadoEm, dataFim)
        )
      );

    // Agrupar por período
    const tendencias = atendimentos.reduce((acc: any, atendimento: any) => {
      const data = new Date(atendimento.iniciadoEm);
      let chave = '';

      if (period === 'day') {
        chave = data.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (period === 'week') {
        const inicioSemana = new Date(data);
        inicioSemana.setDate(data.getDate() - data.getDay());
        chave = inicioSemana.toISOString().split('T')[0];
      } else if (period === 'month') {
        chave = `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      if (!acc[chave]) {
        acc[chave] = {
          periodo: chave,
          totalAtendimentos: 0,
          finalizadosSucesso: 0,
          expirados: 0,
          ativos: 0,
        };
      }

      const trend = acc[chave];
      trend.totalAtendimentos++;

      switch (atendimento.status) {
        case 'Finalizado_Sucesso':
          trend.finalizadosSucesso++;
          break;
        case 'Expirado':
          trend.expirados++;
          break;
        case 'Ativo':
          trend.ativos++;
          break;
      }

      return acc;
    }, {} as any);

    // Converter para array e ordenar
    const tendenciasArray = Object.values(tendencias)
      .sort((a: any, b: any) => a.periodo.localeCompare(b.periodo));

    res.json({
      periodo: { dataInicio, dataFim },
      groupBy: period,
      tendencias: tendenciasArray
    });
  } catch (error) {
    dashboardLogger.error('Erro ao buscar tendências:', error);
    res.status(500).json({ error: 'Erro ao buscar tendências' });
  }
});

export default router;

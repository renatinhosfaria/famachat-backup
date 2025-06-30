import { logger } from '../utils/logger';
import { slaCascataParallelService } from '../services/sla-cascata-parallel.service';
import { notificationService } from '../services/notification.service';

/**
 * Inicializador do Sistema de Automação SLA Cascata Paralelo
 * Este módulo é responsável por inicializar todos os serviços automáticos
 */
export class AutomationInitializer {
  private static instance: AutomationInitializer;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): AutomationInitializer {
    if (!AutomationInitializer.instance) {
      AutomationInitializer.instance = new AutomationInitializer();
    }
    return AutomationInitializer.instance;
  }

  /**
   * Inicializa todos os sistemas de automação
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[Automação] Sistema já está inicializado');
      return;
    }

    try {
      logger.info('[Automação] Iniciando sistema de automação SLA Cascata Paralelo...');

      // Inicializar processamento automático de SLAs
      await this.initializeSLAProcessing();

      // Configurar tarefas periódicas
      await this.setupPeriodicTasks();

      // Configurar limpeza de dados antigos
      await this.setupDataCleanup();

      this.isInitialized = true;
      logger.info('[Automação] ✅ Sistema de automação iniciado com sucesso!');

    } catch (error) {
      logger.error(`[Automação] ❌ Erro ao inicializar sistema de automação: ${error}`);
      throw error;
    }
  }

  /**
   * Inicializa o processamento automático de SLAs
   */
  private async initializeSLAProcessing(): Promise<void> {
    try {
      logger.info('[Automação] Configurando processamento automático de SLAs...');

      // Iniciar o processamento automático do serviço SLA
      slaCascataParallelService.iniciarProcessamentoAutomatico();

      logger.info('[Automação] ✅ Processamento automático de SLAs configurado');

    } catch (error) {
      logger.error(`[Automação] Erro ao configurar processamento de SLAs: ${error}`);
      throw error;
    }
  }

  /**
   * Configura tarefas periódicas do sistema
   */
  private async setupPeriodicTasks(): Promise<void> {
    try {
      logger.info('[Automação] Configurando tarefas periódicas...');

      // Limpeza de dados expirados a cada hora
      setInterval(async () => {
        try {
          await this.cleanupExpiredData();
        } catch (error) {
          logger.error(`[Automação] Erro na limpeza periódica: ${error}`);
        }
      }, 60 * 60 * 1000); // 1 hora

      // Relatório de métricas diário (às 08:00)
      this.scheduleDaily(8, 0, async () => {
        try {
          await this.generateDailyReport();
        } catch (error) {
          logger.error(`[Automação] Erro ao gerar relatório diário: ${error}`);
        }
      });

      // Monitoramento de performance a cada 5 minutos
      setInterval(async () => {
        try {
          await this.monitorSystemHealth();
        } catch (error) {
          logger.error(`[Automação] Erro no monitoramento: ${error}`);
        }
      }, 5 * 60 * 1000); // 5 minutos

      logger.info('[Automação] ✅ Tarefas periódicas configuradas');

    } catch (error) {
      logger.error(`[Automação] Erro ao configurar tarefas periódicas: ${error}`);
      throw error;
    }
  }

  /**
   * Configura limpeza automática de dados antigos
   */
  private async setupDataCleanup(): Promise<void> {
    try {
      logger.info('[Automação] Configurando limpeza automática de dados...');

      // Executar limpeza inicial
      await this.cleanupExpiredData();

      logger.info('[Automação] ✅ Limpeza automática configurada');

    } catch (error) {
      logger.error(`[Automação] Erro ao configurar limpeza de dados: ${error}`);
      throw error;
    }
  }

  /**
   * Limpa dados expirados do sistema
   */
  private async cleanupExpiredData(): Promise<void> {
    try {
      const { db } = await import('../database');
      const { sistemaLeadsCascata } = await import('@shared/schema');
      const { and, lt, ne } = await import('drizzle-orm');

      // Remover registros finalizados há mais de 30 dias
      const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const resultado = await db
        .delete(sistemaLeadsCascata)
        .where(
          and(
            ne(sistemaLeadsCascata.status, 'Ativo'),
            lt(sistemaLeadsCascata.finalizadoEm, trintaDiasAtras)
          )
        );

      logger.info(`[Automação] Limpeza: removidos registros antigos de cascata`);

    } catch (error) {
      logger.error(`[Automação] Erro na limpeza de dados: ${error}`);
    }
  }

  /**
   * Gera relatório diário de performance
   */
  private async generateDailyReport(): Promise<void> {
    try {
      logger.info('[Automação] Gerando relatório diário...');

      // Obter métricas do dia anterior
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      ontem.setHours(0, 0, 0, 0);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const metricas = await slaCascataParallelService.obterMetricasPerformance(ontem, hoje);

      if (metricas) {
        logger.info(`[Automação] Relatório diário gerado:`, {
          totalAtendimentos: metricas.resumo.totalAtendimentos,
          taxaConversao: metricas.resumo.taxaConversao,
          taxaExpiracao: metricas.resumo.taxaExpiracao
        });

        // Buscar gestores para enviar relatório
        const { users } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        const { db } = await import('../database');

        const gestores = await db
          .select()
          .from(users)
          .where(eq(users.role, 'Gestor'));

        // Enviar relatório para cada gestor
        for (const gestor of gestores) {
          await notificationService.enviarResumoPerformance(gestor.id, metricas);
        }
      }

    } catch (error) {
      logger.error(`[Automação] Erro ao gerar relatório diário: ${error}`);
    }
  }

  /**
   * Monitora saúde do sistema
   */
  private async monitorSystemHealth(): Promise<void> {
    try {
      // Verificar se há atendimentos ativos próximos da expiração
      const agora = new Date();
      const proximaHora = new Date(agora.getTime() + 60 * 60 * 1000);

      const { db } = await import('../database');
      const { sistemaLeadsCascata } = await import('@shared/schema');
      const { and, eq, lt, gt } = await import('drizzle-orm');

      const atendimentosProximosExpiracao = await db
        .select()
        .from(sistemaLeadsCascata)
        .where(
          and(
            eq(sistemaLeadsCascata.status, 'Ativo'),
            lt(sistemaLeadsCascata.expiraEm, proximaHora),
            gt(sistemaLeadsCascata.expiraEm, agora)
          )
        );

      if (atendimentosProximosExpiracao.length > 10) {
        logger.warn(`[Automação] Atenção: ${atendimentosProximosExpiracao.length} atendimentos expirando na próxima hora`);
      }

    } catch (error) {
      logger.error(`[Automação] Erro no monitoramento de saúde: ${error}`);
    }
  }

  /**
   * Agenda tarefa para horário específico diariamente
   */
  private scheduleDaily(hour: number, minute: number, task: () => Promise<void>): void {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    // Se o horário já passou hoje, agendar para amanhã
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const timeUntilScheduled = scheduledTime.getTime() - now.getTime();

    setTimeout(() => {
      task();
      // Reagendar para o próximo dia
      setInterval(task, 24 * 60 * 60 * 1000);
    }, timeUntilScheduled);

    logger.info(`[Automação] Tarefa agendada para ${hour}:${minute.toString().padStart(2, '0')} diariamente`);
  }

  /**
   * Para todos os processos automáticos (útil para shutdown graceful)
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('[Automação] Finalizando sistema de automação...');
      
      this.isInitialized = false;
      
      logger.info('[Automação] ✅ Sistema de automação finalizado');
    } catch (error) {
      logger.error(`[Automação] Erro ao finalizar sistema: ${error}`);
    }
  }

  /**
   * Verifica se o sistema está inicializado
   */
  isSystemInitialized(): boolean {
    return this.isInitialized;
  }
}

// Exportar instância singleton
export const automationInitializer = AutomationInitializer.getInstance();

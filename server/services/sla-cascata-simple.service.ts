import { db, executeSQL } from '../database';
import { sistemaLeadsCascata, leads, clientes, users, sistemaConfigAutomacaoLeads } from '@shared/schema';
import { eq, and, lt, asc, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger';

/**
 * Serviço simplificado de SLA em Cascata
 * Gerencia o sistema de distribuição automática de leads com exclusividade de 24 horas
 */
export class SLACascataService {
  private static instance: SLACascataService;

  public static getInstance(): SLACascataService {
    if (!SLACascataService.instance) {
      SLACascataService.instance = new SLACascataService();
    }
    return SLACascataService.instance;
  }

  /**
   * Busca usuários ativos EXCLUSIVAMENTE da configuração cascade_user_order
   */
  private async buscarUsuariosAtivos(): Promise<any[]> {
    try {
      // Buscar configuração ativa para obter ordem dos usuários
      const config = await db
        .select()
        .from(sistemaConfigAutomacaoLeads)
        .where(eq(sistemaConfigAutomacaoLeads.active, true))
        .limit(1);

      if (config.length === 0 || !config[0].cascadeUserOrder) {
        logger.warn(`[SLA Cascata Simple] Nenhuma configuração cascade_user_order encontrada`);
        return [];
      }

      const ordemUsuarios = config[0].cascadeUserOrder as number[];
      
      if (ordemUsuarios.length === 0) {
        logger.warn(`[SLA Cascata Simple] Lista cascade_user_order está vazia`);
        return [];
      }

      // Buscar APENAS os usuários que estão na configuração cascade_user_order
      const usuariosDaCascata = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            inArray(users.id, ordemUsuarios)
          )
        );

      // Ordenar conforme a sequência definida em cascade_user_order
      return usuariosDaCascata.sort((a: any, b: any) => {
        const posA = ordemUsuarios.indexOf(a.id);
        const posB = ordemUsuarios.indexOf(b.id);
        return posA - posB;
      });

    } catch (error) {
      logger.error(`[SLA Cascata Simple] Erro ao buscar usuários da cascata: ${error}`);
      return [];
    }
  }

  /**
   * Insere novo registro na cascata
   */
  private async inserirSistemaLeadsCascata(dados: any): Promise<void> {
    await db.insert(sistemaLeadsCascata).values(dados);
  }

  /**
   * Busca atendimentos expirados
   */
  private async buscarAtendimentosExpirados(): Promise<any[]> {
    const agora = new Date();
    
    return await db
      .select()
      .from(sistemaLeadsCascata)
      .where(
        and(
          eq(sistemaLeadsCascata.status, 'Ativo'),
          lt(sistemaLeadsCascata.expiraEm, agora)
        )
      );
  }

  /**
   * Atualiza status do atendimento
   */
  private async atualizarStatusAtendimento(id: number, dados: any): Promise<void> {
    await db
      .update(sistemaLeadsCascata)
      .set(dados)
      .where(eq(sistemaLeadsCascata.id, id));
  }

  /**
   * Inicia o processo de SLA em cascata para um lead
   */
  async iniciarSLACascata(leadId: number, clienteId: number): Promise<void> {
    try {
      logger.info(`[SLA Cascata] Iniciando para lead ${leadId}, cliente ${clienteId}`);

      // Buscar usuários ativos usando método compatível
      const usuariosAtivos = await this.buscarUsuariosAtivos();

      if (usuariosAtivos.length === 0) {
        logger.warn('[SLA Cascata] Nenhum usuário ativo encontrado');
        return;
      }

      // Criar primeiro atendimento na cascata
      const primeiroUsuario = usuariosAtivos[0];
      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      await this.inserirSistemaLeadsCascata({
        clienteId,
        leadId,
        userId: primeiroUsuario.id,
        sequencia: 1,
        status: 'Ativo',
        slaHoras: 24,
        expiraEm,
      });

      logger.info(`[SLA Cascata] Criado primeiro atendimento para usuário ${primeiroUsuario.username}`);

    } catch (error) {
      logger.error(`[SLA Cascata] Erro ao iniciar: ${error}`);
      throw error;
    }
  }

  /**
   * Processa SLAs expirados
   */
  async processarSLAsExpirados(): Promise<void> {
    try {
      logger.info('[SLA Cascata] Processando SLAs expirados');

      // Buscar atendimentos ativos que expiraram usando método compatível
      const atendimentosExpirados = await this.buscarAtendimentosExpirados();

      logger.info(`[SLA Cascata] Encontrados ${atendimentosExpirados.length} atendimentos expirados`);

      for (const atendimento of atendimentosExpirados) {
        await this.processarAtendimentoExpirado(atendimento);
      }

    } catch (error) {
      logger.error(`[SLA Cascata] Erro ao processar expirados: ${error}`);
    }
  }

  /**
   * Processa um atendimento específico que expirou
   */
  private async processarAtendimentoExpirado(atendimento: any): Promise<void> {
    try {
      // Marcar como expirado usando método compatível
      await this.atualizarStatusAtendimento(atendimento.id, {
        status: 'Expirado',
        finalizadoEm: new Date(),
        motivo: 'SLA_Expirado'
      });

      // Buscar próximo usuário
      const proximoUsuario = await this.buscarProximoUsuario(atendimento.userId);

      if (proximoUsuario) {
        const novaExpiracao = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await this.inserirSistemaLeadsCascata({
          clienteId: atendimento.clienteId,
          leadId: atendimento.leadId,
          userId: proximoUsuario.id,
          sequencia: atendimento.sequencia + 1,
          status: 'Ativo',
          slaHoras: 24,
          expiraEm: novaExpiracao,
        });

        logger.info(`[SLA Cascata] Criado próximo atendimento: usuário ${proximoUsuario.username}`);
      }

    } catch (error) {
      logger.error(`[SLA Cascata] Erro ao processar atendimento ${atendimento.id}: ${error}`);
    }
  }

  /**
   * Busca o próximo usuário na sequência EXCLUSIVAMENTE da cascade_user_order
   */
  private async buscarProximoUsuario(usuarioAtualId: number): Promise<any | null> {
    try {
      // Buscar usuários EXCLUSIVAMENTE da configuração cascade_user_order
      const usuariosAtivos = await this.buscarUsuariosAtivos();
      
      if (usuariosAtivos.length === 0) {
        logger.warn(`[SLA Cascata Simple] Nenhum usuário encontrado na cascade_user_order`);
        return null;
      }

      const indiceAtual = usuariosAtivos.findIndex(u => u.id === usuarioAtualId);
      const proximoIndice = (indiceAtual + 1) % usuariosAtivos.length;
      return usuariosAtivos[proximoIndice];

    } catch (error) {
      logger.error(`[SLA Cascata Simple] Erro ao buscar próximo usuário: ${error}`);
      return null;
    }
  }

  /**
   * Busca atendimento ativo específico
   */
  private async buscarAtendimentoAtivo(clienteId: number, userId: number): Promise<any[]> {
    return await db
      .select()
      .from(sistemaLeadsCascata)
      .where(
        and(
          eq(sistemaLeadsCascata.clienteId, clienteId),
          eq(sistemaLeadsCascata.userId, userId),
          eq(sistemaLeadsCascata.status, 'Ativo')
        )
      )
      .limit(1);
  }

  /**
   * Finaliza um atendimento com sucesso
   */
  async finalizarAtendimentoComSucesso(clienteId: number, userId: number): Promise<void> {
    try {
      const atendimentoAtivo = await this.buscarAtendimentoAtivo(clienteId, userId);

      if (atendimentoAtivo.length > 0) {
        await this.atualizarStatusAtendimento(atendimentoAtivo[0].id, {
          status: 'Finalizado',
          finalizadoEm: new Date(),
          motivo: 'Agendamento'
        });

        logger.info(`[SLA Cascata] Atendimento finalizado com sucesso: ID ${atendimentoAtivo[0].id}`);
      }

    } catch (error) {
      logger.error(`[SLA Cascata] Erro ao finalizar atendimento: ${error}`);
    }
  }

  /**
   * Busca atendimentos ativos para um usuário
   */
  async buscarAtendimentosAtivos(userId: number): Promise<any[]> {
    try {
      const atendimentos = await db
        .select({
          id: sistemaLeadsCascata.id,
          clienteId: sistemaLeadsCascata.clienteId,
          leadId: sistemaLeadsCascata.leadId,
          sequencia: sistemaLeadsCascata.sequencia,
          expiraEm: sistemaLeadsCascata.expiraEm,
          iniciadoEm: sistemaLeadsCascata.iniciadoEm,
          clienteNome: clientes.fullName,
          clienteEmail: clientes.email,
          clientePhone: clientes.phone,
          clienteStatus: clientes.status,
        })
        .from(sistemaLeadsCascata)
        .leftJoin(clientes, eq(sistemaLeadsCascata.clienteId, clientes.id))
        .where(
          and(
            eq(sistemaLeadsCascata.userId, userId),
            eq(sistemaLeadsCascata.status, 'Ativo')
          )
        )
        .orderBy(asc(sistemaLeadsCascata.expiraEm));

      return atendimentos;

    } catch (error) {
      logger.error(`[SLA Cascata] Erro ao buscar atendimentos ativos: ${error}`);
      return [];
    }
  }

  /**
   * Inicia o processamento automático de SLAs
   */
  iniciarProcessamentoAutomatico(): void {
    logger.info('[SLA Cascata] Iniciando processamento automático');
    
    // Executar imediatamente
    this.processarSLAsExpirados();
    
    // Configurar execução a cada minuto
    setInterval(() => {
      this.processarSLAsExpirados();
    }, 60 * 1000);
  }
}

// Exportar instância singleton
export const slaCascataService = SLACascataService.getInstance();
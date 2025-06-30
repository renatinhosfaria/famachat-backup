import { logger } from '../utils/logger';
import { db } from '../database';
import { users, clientes } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Serviço de Notificações para SLA Cascata Paralelo
 * Gerencia notificações para usuários quando recebem novos atendimentos
 */
export class NotificationService {
  private static instance: NotificationService;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Notifica usuário sobre novo atendimento via múltiplos canais
   */
  async notificarNovoAtendimento(
    userId: number, 
    clienteId: number, 
    sequencia: number,
    leadId?: number
  ): Promise<void> {
    try {
      logger.info(`[Notificações] Iniciando notificação para usuário ${userId}, cliente ${clienteId}, sequência ${sequencia}`);

      // Buscar dados do usuário e cliente
      const [usuario, cliente] = await Promise.all([
        this.buscarUsuario(userId),
        this.buscarCliente(clienteId)
      ]);

      if (!usuario || !cliente) {
        logger.warn(`[Notificações] Usuário ou cliente não encontrado: user=${userId}, cliente=${clienteId}`);
        return;
      }

      // Determinar o tipo de notificação baseado na sequência
      const tipoNotificacao = sequencia === 1 ? 'PRIMEIRO_ATENDIMENTO' : 'ATENDIMENTO_CASCATA';
      
      // Criar mensagem personalizada
      const mensagem = this.criarMensagemNotificacao(usuario, cliente, sequencia, tipoNotificacao);

      // Enviar notificações pelos canais disponíveis
      await Promise.all([
        this.enviarNotificacaoWhatsApp(usuario, mensagem),
        this.enviarNotificacaoEmail(usuario, mensagem),
        this.enviarNotificacaoSistema(usuario, mensagem, clienteId, leadId),
      ]);

      logger.info(`[Notificações] Notificações enviadas com sucesso para usuário ${usuario.username}`);

    } catch (error) {
      logger.error(`[Notificações] Erro ao notificar usuário ${userId}: ${error}`);
    }
  }

  /**
   * Busca dados do usuário
   */
  private async buscarUsuario(userId: number): Promise<any | null> {
    try {
      const resultado = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          whatsappInstance: users.whatsappInstance,
          whatsappConnected: users.whatsappConnected,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return resultado.length > 0 ? resultado[0] : null;
    } catch (error) {
      logger.error(`[Notificações] Erro ao buscar usuário ${userId}: ${error}`);
      return null;
    }
  }

  /**
   * Busca dados do cliente
   */
  private async buscarCliente(clienteId: number): Promise<any | null> {
    try {
      const resultado = await db
        .select({
          id: clientes.id,
          fullName: clientes.fullName,
          email: clientes.email,
          phone: clientes.phone,
          source: clientes.source,
          status: clientes.status,
        })
        .from(clientes)
        .where(eq(clientes.id, clienteId))
        .limit(1);

      return resultado.length > 0 ? resultado[0] : null;
    } catch (error) {
      logger.error(`[Notificações] Erro ao buscar cliente ${clienteId}: ${error}`);
      return null;
    }
  }

  /**
   * Cria mensagem personalizada de notificação
   */
  private criarMensagemNotificacao(
    usuario: any, 
    cliente: any, 
    sequencia: number, 
    tipo: 'PRIMEIRO_ATENDIMENTO' | 'ATENDIMENTO_CASCATA'
  ): any {
    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString('pt-BR');
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const baseMessage = {
      usuario: usuario,
      cliente: cliente,
      sequencia: sequencia,
      tipo: tipo,
      timestamp: agora,
      dataFormatada: dataFormatada,
      horaFormatada: horaFormatada,
    };

    if (tipo === 'PRIMEIRO_ATENDIMENTO') {
      return {
        ...baseMessage,
        titulo: '🆕 Novo Lead Atribuído',
        mensagemCurta: `Novo lead: ${cliente.fullName}`,
        mensagemCompleta: `🆕 *Novo Lead Atribuído*\n\n` +
          `👤 *Cliente:* ${cliente.fullName}\n` +
          `📱 *Telefone:* ${cliente.phone}\n` +
          `📧 *Email:* ${cliente.email || 'Não informado'}\n` +
          `🎯 *Origem:* ${cliente.source || 'Não informado'}\n` +
          `📅 *Data/Hora:* ${dataFormatada} às ${horaFormatada}\n\n` +
          `⏰ *SLA:* 24 horas para primeiro contato\n\n` +
          `💡 *Dica:* Entre em contato rapidamente para aumentar suas chances de conversão!`,
        prioridade: 'ALTA'
      };
    } else {
      return {
        ...baseMessage,
        titulo: '🔄 Lead em Cascata - Sua Vez!',
        mensagemCurta: `Lead cascata: ${cliente.fullName} (Seq. ${sequencia})`,
        mensagemCompleta: `🔄 *Lead em Cascata - Sua Vez!*\n\n` +
          `👤 *Cliente:* ${cliente.fullName}\n` +
          `📱 *Telefone:* ${cliente.phone}\n` +
          `📧 *Email:* ${cliente.email || 'Não informado'}\n` +
          `🎯 *Origem:* ${cliente.source || 'Não informado'}\n` +
          `🔢 *Sequência:* ${sequencia}ª tentativa\n` +
          `📅 *Data/Hora:* ${dataFormatada} às ${horaFormatada}\n\n` +
          `⚡ *Status:* Lead disponível por SLA expirado\n` +
          `⏰ *Seu SLA:* 24 horas para contato\n\n` +
          `🏆 *Oportunidade:* Este cliente ainda não foi contatado com sucesso. Sua chance de converter!`,
        prioridade: 'MUITO_ALTA'
      };
    }
  }

  /**
   * Envia notificação via WhatsApp (se disponível)
   */
  private async enviarNotificacaoWhatsApp(usuario: any, mensagem: any): Promise<void> {
    try {
      // Verificar se usuário tem WhatsApp conectado
      if (!usuario.whatsappConnected || !usuario.whatsappInstance) {
        logger.info(`[Notificações] WhatsApp não disponível para usuário ${usuario.username}`);
        return;
      }

      // TODO: Implementar envio via Evolution API
      // Aqui você integraria com seu serviço de WhatsApp
      logger.info(`[Notificações] WhatsApp: ${mensagem.mensagemCurta} -> ${usuario.username}`);
      
      // Exemplo de implementação:
      /*
      const whatsappService = await import('../services/whatsapp-api');
      await whatsappService.enviarMensagem({
        instancia: usuario.whatsappInstance,
        numero: usuario.phone,
        mensagem: mensagem.mensagemCompleta,
        tipo: 'text'
      });
      */

    } catch (error) {
      logger.error(`[Notificações] Erro ao enviar WhatsApp para ${usuario.username}: ${error}`);
    }
  }

  /**
   * Envia notificação via email (se disponível)
   */
  private async enviarNotificacaoEmail(usuario: any, mensagem: any): Promise<void> {
    try {
      if (!usuario.email) {
        logger.info(`[Notificações] Email não disponível para usuário ${usuario.username}`);
        return;
      }

      // TODO: Implementar envio de email
      logger.info(`[Notificações] Email: ${mensagem.titulo} -> ${usuario.email}`);
      
      // Exemplo de implementação:
      /*
      const emailService = await import('../services/email');
      await emailService.enviarEmail({
        para: usuario.email,
        assunto: mensagem.titulo,
        conteudo: mensagem.mensagemCompleta,
        tipo: 'html'
      });
      */

    } catch (error) {
      logger.error(`[Notificações] Erro ao enviar email para ${usuario.username}: ${error}`);
    }
  }

  /**
   * Envia notificação via sistema interno
   */
  private async enviarNotificacaoSistema(
    usuario: any, 
    mensagem: any, 
    clienteId: number, 
    leadId?: number
  ): Promise<void> {
    try {
      // TODO: Implementar sistema de notificações internas
      // Pode ser via WebSocket, banco de dados de notificações, etc.
      
      logger.info(`[Notificações] Sistema: ${mensagem.titulo} -> ${usuario.username}`);
      
      // Exemplo de notificação para dashboard/interface:
      const notificacaoInterna = {
        usuarioId: usuario.id,
        tipo: mensagem.tipo,
        titulo: mensagem.titulo,
        mensagem: mensagem.mensagemCurta,
        clienteId: clienteId,
        leadId: leadId,
        prioridade: mensagem.prioridade,
        lida: false,
        criadaEm: new Date()
      };

      // Aqui você salvaria no banco ou enviaria via WebSocket
      logger.info(`[Notificações] Notificação interna criada:`, notificacaoInterna);

    } catch (error) {
      logger.error(`[Notificações] Erro ao criar notificação sistema para ${usuario.username}: ${error}`);
    }
  }

  /**
   * Notifica sobre finalização de cascata
   */
  async notificarFinalizacaoCascata(
    clienteId: number, 
    usuarioQueAgendou: number, 
    outrosUsuarios: number[]
  ): Promise<void> {
    try {
      logger.info(`[Notificações] Notificando finalização de cascata - Cliente ${clienteId}`);

      const [cliente, usuarioVencedor] = await Promise.all([
        this.buscarCliente(clienteId),
        this.buscarUsuario(usuarioQueAgendou)
      ]);

      if (!cliente || !usuarioVencedor) {
        logger.warn(`[Notificações] Dados não encontrados para notificação de finalização`);
        return;
      }

      // Notificar o usuário que conseguiu o agendamento
      const mensagemSucesso = {
        titulo: '🎉 Parabéns! Cliente agendado',
        mensagemCompleta: `🎉 *Parabéns!*\n\n` +
          `Você conseguiu agendar o cliente *${cliente.fullName}*!\n\n` +
          `📱 *Telefone:* ${cliente.phone}\n` +
          `⏰ *Agendado em:* ${new Date().toLocaleString('pt-BR')}\n\n` +
          `🏆 *Resultado:* Todas as outras duplicatas foram automaticamente finalizadas.\n\n` +
          `Continue assim! 💪`,
        tipo: 'SUCESSO_AGENDAMENTO',
        prioridade: 'ALTA'
      };

      await this.enviarNotificacaoSistema(usuarioVencedor, mensagemSucesso, clienteId);

      // Notificar outros usuários que perderam a oportunidade
      for (const outroUserId of outrosUsuarios) {
        if (outroUserId !== usuarioQueAgendou) {
          const outroUsuario = await this.buscarUsuario(outroUserId);
          if (outroUsuario) {
            const mensagemPerda = {
              titulo: '📋 Cliente foi agendado por outro consultor',
              mensagemCompleta: `📋 *Cliente Agendado*\n\n` +
                `O cliente *${cliente.fullName}* foi agendado por ${usuarioVencedor.fullName}.\n\n` +
                `📱 *Cliente:* ${cliente.phone}\n` +
                `👤 *Agendado por:* ${usuarioVencedor.fullName}\n` +
                `⏰ *Data:* ${new Date().toLocaleString('pt-BR')}\n\n` +
                `✅ *Status:* Sua duplicata foi automaticamente finalizada.\n\n` +
                `Continue focado nos próximos leads! 🚀`,
              tipo: 'CASCATA_FINALIZADA',
              prioridade: 'MEDIA'
            };

            await this.enviarNotificacaoSistema(outroUsuario, mensagemPerda, clienteId);
          }
        }
      }

    } catch (error) {
      logger.error(`[Notificações] Erro ao notificar finalização de cascata: ${error}`);
    }
  }

  /**
   * Envia resumo diário de performance para gestores
   */
  async enviarResumoPerformance(userId: number, metricas: any): Promise<void> {
    try {
      const usuario = await this.buscarUsuario(userId);
      if (!usuario) return;

      const mensagem = {
        titulo: '📊 Resumo Diário - SLA Cascata',
        mensagemCompleta: `📊 *Resumo do Sistema SLA Cascata*\n\n` +
          `📅 *Período:* ${new Date().toLocaleDateString('pt-BR')}\n\n` +
          `📈 *Estatísticas:*\n` +
          `• Total de atendimentos: ${metricas.resumo.totalAtendimentos}\n` +
          `• Finalizados: ${metricas.resumo.atendimentosFinalizados}\n` +
          `• Expirados: ${metricas.resumo.atendimentosExpirados}\n` +
          `• Taxa de conversão: ${metricas.resumo.taxaConversao}%\n\n` +
          `💡 *Sistema funcionando em modo paralelo*`,
        tipo: 'RESUMO_PERFORMANCE',
        prioridade: 'BAIXA'
      };

      await this.enviarNotificacaoEmail(usuario, mensagem);
      await this.enviarNotificacaoSistema(usuario, mensagem, 0);

    } catch (error) {
      logger.error(`[Notificações] Erro ao enviar resumo de performance: ${error}`);
    }
  }
}

// Exportar instância singleton
export const notificationService = NotificationService.getInstance();

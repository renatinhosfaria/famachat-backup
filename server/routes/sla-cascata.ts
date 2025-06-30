import { Router } from 'express';
import { slaCascataService } from '../services/sla-cascata-simple.service';
import { auth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Schema para iniciar SLA em cascata
const iniciarSLASchema = z.object({
  leadId: z.number(),
  clienteId: z.number()
});

// Schema para finalizar atendimento
const finalizarAtendimentoSchema = z.object({
  clienteId: z.number(),
  userId: z.number()
});

/**
 * Inicia SLA em cascata para um lead específico
 */
router.post('/iniciar', auth, async (req, res) => {
  try {
    const { leadId, clienteId } = iniciarSLASchema.parse(req.body);
    
    await slaCascataService.iniciarSLACascata(leadId, clienteId);
    
    res.json({ 
      success: true, 
      message: 'SLA em cascata iniciado com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao iniciar SLA cascata:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao iniciar SLA em cascata' 
    });
  }
});

/**
 * Finaliza atendimento com sucesso (quando agendamento é criado)
 */
router.post('/finalizar', auth, async (req, res) => {
  try {
    const { clienteId, userId } = finalizarAtendimentoSchema.parse(req.body);
    
    await slaCascataService.finalizarAtendimentoComSucesso(clienteId, userId);
    
    res.json({ 
      success: true, 
      message: 'Atendimento finalizado com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao finalizar atendimento:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao finalizar atendimento' 
    });
  }
});

/**
 * Busca atendimentos ativos para o usuário logado
 */
router.get('/meus-atendimentos', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não identificado' 
      });
    }

    const atendimentos = await slaCascataService.buscarAtendimentosAtivos(userId);
    
    res.json({ 
      success: true, 
      atendimentos 
    });
  } catch (error) {
    console.error('Erro ao buscar atendimentos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar atendimentos' 
    });
  }
});

/**
 * Força processamento de SLAs expirados (apenas para gestores)
 */
router.post('/processar-expirados', auth, async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'Gestor') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado. Apenas gestores podem executar esta ação.' 
      });
    }

    await slaCascataService.processarSLAsExpirados();
    
    res.json({ 
      success: true, 
      message: 'Processamento de SLAs expirados executado com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao processar SLAs expirados:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar SLAs expirados' 
    });
  }
});

/**
 * Busca estatísticas de SLA para o usuário logado
 */
router.get('/estatisticas', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não identificado' 
      });
    }

    const periodo = req.query.periodo as string || 'month';
    
    // Para agora, retornar estatísticas básicas
    // Pode ser expandido com o método de estatísticas do serviço
    const atendimentosAtivos = await slaCascataService.buscarAtendimentosAtivos(userId);
    
    res.json({ 
      success: true, 
      estatisticas: {
        atendimentos_ativos: atendimentosAtivos.length,
        periodo
      }
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar estatísticas' 
    });
  }
});

export default router;
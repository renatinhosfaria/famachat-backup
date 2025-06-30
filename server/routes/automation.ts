/**
 * Rotas para gerenciamento de configurações de automação de leads
 */
import express from 'express';
import { z } from 'zod';
import { checkAuth, checkRole } from '../middlewares/auth';
import { 
  insertLeadAutomationConfigSchema, 
  updateLeadAutomationConfigSchema 
} from '@shared/schema';
import { 
  getAutomationConfig,
  getAllAutomationConfigs,
  getAutomationConfigById,
  createAutomationConfig, 
  updateAutomationConfig,
  deleteAutomationConfig
} from '../services/automation-config.service';
import { logger } from '../utils/logger';

// Inicializa o logger para o módulo de automação
const automationLogger = logger.createLogger('AutomationAPI');

const router = express.Router();

// Parâmetro de ID validado com Zod
const idParamSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10))
});

// Obtém a configuração ativa
router.get('/', async (req, res) => {
  try {
    const config = await getAutomationConfig();
    res.json(config);
  } catch (error) {
    automationLogger.error('Erro ao obter configuração de automação:', error);
    res.status(500).json({ 
      message: 'Erro ao obter configuração de automação'
    });
  }
});

// Obtém todas as configurações
router.get('/all', async (req, res) => {
  try {
    const configs = await getAllAutomationConfigs();
    res.json(configs);
  } catch (error) {
    automationLogger.error('Erro ao obter todas as configurações:', error);
    res.status(500).json({ 
      message: 'Erro ao obter configurações de automação'
    });
  }
});

// Obtém uma configuração específica
router.get('/:id', async (req, res) => {
  try {
    // Valida e converte o parâmetro ID
    const { id } = idParamSchema.parse(req.params);

    const config = await getAutomationConfigById(id);
    if (!config) {
      return res.status(404).json({ 
        message: 'Configuração não encontrada'
      });
    }

    res.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'ID inválido',
        errors: error.errors 
      });
    }

    automationLogger.error('Erro ao obter configuração de automação:', error);
    res.status(500).json({ 
      message: 'Erro ao obter configuração de automação'
    });
  }
});

// Cria uma nova configuração
router.post('/', async (req, res) => {
  try {
    // Log do corpo da requisição para depuração
    logger.debug('Body da requisição POST /automation:', JSON.stringify(req.body, null, 2));
    
    // Extrair os IDs de usuários selecionados antes da validação
    const { selectedUsers, rotationUsers, ...restData } = req.body;
    
    // Usar rotationUsers ou selectedUsers (priorizando rotationUsers se ambos estiverem presentes)
    const usersList = Array.isArray(rotationUsers) ? rotationUsers : 
                      (Array.isArray(selectedUsers) ? selectedUsers : []);
    
    // Log para depuração da extração de usuários
    logger.debug('Lista de usuários extraída:', usersList);
    
    // Mapear selectedUsers para rotationUsers
    const dataToValidate = {
      ...restData,
      rotationUsers: usersList,
    };
    
    // Valida o corpo da requisição usando o schema
    const validatedData = insertLeadAutomationConfigSchema.parse(dataToValidate);

    // Código comentado para evitar erro de tipo - não temos autenticação implementada
    // if (req.user?.id) {
    //   validatedData.createdBy = req.user.id;
    // }

    logger.debug('Criando configuração com usuários selecionados:', validatedData.rotationUsers);
    const newConfig = await createAutomationConfig(validatedData);
    res.status(201).json(newConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Dados de configuração inválidos',
        errors: error.errors 
      });
    }

    automationLogger.error('Erro ao criar configuração de automação:', error);
    res.status(500).json({ 
      message: 'Erro ao criar configuração de automação'
    });
  }
});

// Atualiza uma configuração existente
router.put('/:id', async (req, res) => {
  try {
    // Valida e converte o parâmetro ID
    const { id } = idParamSchema.parse(req.params);

    // Log do corpo da requisição para depuração
    logger.debug('Body da requisição PUT /automation/' + id + ':', JSON.stringify(req.body, null, 2));
    
    // Extrair os IDs de usuários selecionados antes da validação
    const { selectedUsers, rotationUsers, ...restData } = req.body;
    
    // Usar rotationUsers ou selectedUsers (priorizando rotationUsers se ambos estiverem presentes)
    const usersList = Array.isArray(rotationUsers) ? rotationUsers : 
                      (Array.isArray(selectedUsers) ? selectedUsers : []);
    
    // Log para depuração da extração de usuários
    logger.debug('Lista de usuários extraída para atualização:', usersList);
    
    // Mapear selectedUsers para rotationUsers
    const dataToValidate = {
      ...restData,
      rotationUsers: usersList,
    };
    
    // Valida o corpo da requisição usando o schema
    const validatedData = updateLeadAutomationConfigSchema.parse(dataToValidate);

    logger.debug('Atualizando configuração com usuários selecionados:', validatedData.rotationUsers);
    const updatedConfig = await updateAutomationConfig(id, validatedData);
    if (!updatedConfig) {
      return res.status(404).json({ 
        message: 'Configuração não encontrada'
      });
    }

    res.json(updatedConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Dados de configuração inválidos',
        errors: error.errors 
      });
    }

    automationLogger.error('Erro ao atualizar configuração de automação:', error);
    res.status(500).json({ 
      message: 'Erro ao atualizar configuração de automação'
    });
  }
});

// Exclui uma configuração
router.delete('/:id', async (req, res) => {
  try {
    // Valida e converte o parâmetro ID
    const { id } = idParamSchema.parse(req.params);

    const success = await deleteAutomationConfig(id);
    if (!success) {
      return res.status(404).json({ 
        message: 'Configuração não encontrada'
      });
    }

    res.status(204).end();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'ID inválido',
        errors: error.errors 
      });
    }

    automationLogger.error('Erro ao excluir configuração de automação:', error);
    res.status(500).json({ 
      message: 'Erro ao excluir configuração de automação'
    });
  }
});

export default router;
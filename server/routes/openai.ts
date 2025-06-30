import express from 'express';
import { openAIService } from '../services/openai.service';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Gera conteúdo diário
 * POST /api/openai/generate-content
 */
router.post('/generate-content', async (req, res) => {
  try {
    const { category = 'mercado_imobiliario' } = req.body;
    logger.info(`Solicitação para gerar conteúdo na categoria: ${category}`);
    
    const content = await openAIService.generateDailyContent(category);
    
    if (!content) {
      return res.status(200).json({ 
        message: 'Conteúdo para hoje já existe ou não foi possível gerar', 
        success: false 
      });
    }
    
    return res.status(201).json({
      message: 'Conteúdo gerado com sucesso',
      success: true,
      data: content
    });
  } catch (error) {
    logger.error('Erro ao gerar conteúdo diário:', error);
    return res.status(500).json({ 
      message: 'Erro ao gerar conteúdo diário', 
      success: false,
      error: error.message 
    });
  }
});

/**
 * Recupera o conteúdo diário mais recente
 * GET /api/openai/daily-content?category=mercado_imobiliario
 */
router.get('/daily-content', async (req, res) => {
  try {
    const { category = 'mercado_imobiliario' } = req.query;
    logger.info(`Solicitação para obter conteúdo na categoria: ${category}`);
    
    const content = await openAIService.getLatestContent(category as string);
    
    if (!content) {
      return res.status(404).json({ 
        message: 'Nenhum conteúdo encontrado', 
        success: false 
      });
    }
    
    return res.status(200).json({
      message: 'Conteúdo recuperado com sucesso',
      success: true,
      data: content
    });
  } catch (error) {
    logger.error('Erro ao recuperar conteúdo diário:', error);
    return res.status(500).json({ 
      message: 'Erro ao recuperar conteúdo diário', 
      success: false,
      error: error.message 
    });
  }
});

export default router;
import express from 'express';
import { z } from 'zod';
import { db } from '../database';
import { sistemaUsersHorarios } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

// Inicializa o logger específico para este módulo
const horariosLogger = logger.createLogger("HorariosAPI");

const router = express.Router();

// Schema para validar os dados do horário
const HorarioSchema = z.object({
  dia: z.string(),
  inicio: z.string(),
  fim: z.string(),
  diaTodo: z.boolean().optional().default(false)
});

// Schema para validar o array de horários
const HorariosSchema = z.array(HorarioSchema);

// Endpoint para salvar horários de um usuário
router.post('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      horariosLogger.error(`ID de usuário inválido: ${req.params.userId}`);
      return res.status(400).json({ message: 'ID de usuário inválido' });
    }

    horariosLogger.debug(`Recebendo horários para usuário ${userId}:`, { body: req.body });
    horariosLogger.debug(`Tipo dos dados recebidos: ${typeof req.body}, ${Array.isArray(req.body) ? 'Array' : 'Não é array'}`);
    
    // Garantir que req.body seja um array
    let dadosHorarios = req.body;
    if (!Array.isArray(dadosHorarios)) {
      horariosLogger.warn(`Dados recebidos não são um array, tentando converter...`);
      try {
        // Tenta converter de string para objeto, caso seja necessário
        if (typeof dadosHorarios === 'string') {
          dadosHorarios = JSON.parse(dadosHorarios);
        }
        
        // Se ainda não for array após conversão, envia erro
        if (!Array.isArray(dadosHorarios)) {
          horariosLogger.error(`Dados ainda não são um array após conversão`, { dadosRecebidos: dadosHorarios });
          return res.status(400).json({ 
            message: 'Formato de dados inválido, esperava um array de horários',
            received: dadosHorarios 
          });
        }
      } catch (parseError) {
        horariosLogger.error(`Erro ao tentar converter dados`, { error: parseError });
        return res.status(400).json({ 
          message: 'Erro ao processar dados de horário',
          error: String(parseError) 
        });
      }
    }
    
    // Validar os dados recebidos
    const horariosResult = HorariosSchema.safeParse(dadosHorarios);
    if (!horariosResult.success) {
      horariosLogger.error('Erro de validação', { errors: horariosResult.error });
      return res.status(400).json({ 
        message: 'Dados de horário inválidos', 
        errors: horariosResult.error.errors 
      });
    }

    const horarios = horariosResult.data;
    horariosLogger.debug(`Dados validados, encontrados ${horarios.length} registros`);

    if (horarios.length === 0) {
      horariosLogger.debug(`Nenhum horário para inserir, retornando sucesso vazio`);
      return res.status(200).json({
        message: 'Nenhum horário para salvar',
        horarios: []
      });
    }

    // Remover horários existentes primeiro
    horariosLogger.debug(`Removendo horários existentes para o usuário ${userId}`);
    try {
      await db.delete(sistemaUsersHorarios)
        .where(eq(sistemaUsersHorarios.userId, userId));
      horariosLogger.debug(`Remoção de horários existentes concluída com sucesso`);
    } catch (deleteError) {
      horariosLogger.error(`Erro ao remover horários existentes`, { error: deleteError });
      // Continua mesmo com erro na remoção
    }

    // Inserir os novos horários
    const insertedHorarios = [];
    let errorOccurred = false;

    for (const h of horarios) {
      try {
        horariosLogger.debug(`Processando horário: ${JSON.stringify(h)}`);
        
        // Validar cada campo individualmente
        if (!h.dia) {
          horariosLogger.error(`Dia da semana ausente ou inválido`, { diaRecebido: h.dia });
          continue;
        }
        
        const horarioData = {
          userId,
          diaSemana: h.dia,
          horarioInicio: h.inicio || "09:00:00",
          horarioFim: h.fim || "18:00:00",
          diaTodo: h.diaTodo ?? false,
        };
        
        horariosLogger.debug(`Dados formatados para inserção: ${JSON.stringify(horarioData)}`);
        
        const result = await db.insert(sistemaUsersHorarios)
          .values(horarioData)
          .returning();
          
        horariosLogger.debug(`Horário inserido com sucesso: ${JSON.stringify(result)}`);
        
        if (result && result.length > 0) {
          insertedHorarios.push(result[0]);
        } else {
          horariosLogger.warn(`Inserção não retornou dados`);
        }
      } catch (insertError) {
        horariosLogger.error(`Erro ao inserir horário`, { error: insertError });
        errorOccurred = true;
      }
    }

    if (errorOccurred && insertedHorarios.length === 0) {
      // Se ocorreram erros e nenhum horário foi inserido, retorna erro
      horariosLogger.error(`Falha completa na inserção de horários`);
      return res.status(500).json({
        message: 'Falha ao salvar horários',
      });
    }

    // Mesmo com alguns erros, se pelo menos um horário foi inserido, considera sucesso parcial
    return res.status(200).json({
      message: errorOccurred 
        ? `Horários salvos parcialmente (${insertedHorarios.length}/${horarios.length})` 
        : 'Horários salvos com sucesso',
      horarios: insertedHorarios
    });
  } catch (error) {
    horariosLogger.error('Erro ao salvar horários', { error });
    return res.status(500).json({ 
      message: 'Erro ao salvar horários de usuário',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint para obter horários de um usuário
router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      horariosLogger.error(`ID de usuário inválido na requisição GET: ${req.params.userId}`);
      return res.status(400).json({ message: 'ID de usuário inválido' });
    }

    horariosLogger.debug(`Buscando horários do usuário ${userId}`);
    const horarios = await db.select()
      .from(sistemaUsersHorarios)
      .where(eq(sistemaUsersHorarios.userId, userId));
    
    horariosLogger.debug(`Encontrados ${horarios.length} registros de horários para o usuário ${userId}`);
    return res.status(200).json(horarios);
  } catch (error) {
    horariosLogger.error('Erro ao buscar horários', { error, userId: req.params.userId });
    return res.status(500).json({ 
      message: 'Erro ao buscar horários de usuário',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
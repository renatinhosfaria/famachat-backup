import { Router } from 'express';
import { metasService } from '../services/metas.service';
import { z } from 'zod';

const router = Router();

// Schema para validação de parâmetros de rota
const metaParamSchema = z.object({
  id: z.coerce.number()
});

// Schema para validação de parâmetros de consulta
const metaQuerySchema = z.object({
  ano: z.coerce.number(),
  mes: z.coerce.number().min(1).max(12),
});

// Schema para validação do corpo da requisição
const metaBodySchema = z.object({
  userId: z.coerce.number(),
  periodo: z.enum(['mensal', 'trimestral', 'semestral', 'anual']).default('mensal'),
  ano: z.coerce.number(),
  mes: z.coerce.number().min(1).max(12),
  agendamentos: z.coerce.number().optional(),
  visitas: z.coerce.number().optional(),
  vendas: z.coerce.number().optional(),
  conversaoClientes: z.coerce.number().optional(),
  // Campos que foram renomeados no banco de dados
  conversaoAgendamentos: z.coerce.number().optional(), // map -> conversao_agendamentos no BD
  conversaoVisitas: z.coerce.number().optional(), // map -> conversao_visitas no BD
  conversaoVendas: z.coerce.number().optional(), // map -> conversao_vendas no BD
});

// Schema para validação do corpo de atualização (todos os campos são opcionais)
const metaUpdateSchema = z.object({
  userId: z.coerce.number().optional(),
  periodo: z.enum(['mensal', 'trimestral', 'semestral', 'anual']).optional(),
  ano: z.coerce.number().optional(),
  mes: z.coerce.number().min(1).max(12).optional(),
  agendamentos: z.coerce.number().optional(),
  visitas: z.coerce.number().optional(),
  vendas: z.coerce.number().optional(),
  conversaoClientes: z.coerce.number().optional(),
  conversaoAgendamentos: z.coerce.number().optional(),
  conversaoVisitas: z.coerce.number().optional(),
  conversaoVendas: z.coerce.number().optional(),
});

/**
 * Rota para buscar metas de um usuário específico
 * GET /api/metas/usuario/:userId
 */
router.get('/usuario/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { ano, mes } = metaQuerySchema.parse({
      ano: req.query.ano || new Date().getFullYear(),
      mes: req.query.mes || new Date().getMonth() + 1
    });

    const meta = await metasService.getMetasByUserId(userId, ano, mes);
    return res.json(meta || {});
  } catch (error) {
    console.error('Erro ao buscar metas do usuário:', error);
    return res.status(500).json({ error: 'Falha ao buscar metas do usuário' });
  }
});

/**
 * Rota para buscar todas as metas (para visualização em tabela)
 * GET /api/metas/todas
 */
router.get('/todas', async (req, res) => {
  try {
    // Configurar cabeçalhos para evitar cache
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    
    // Adicionar timestamp para log
    console.log(`Requisição /metas/todas recebida em ${new Date().toISOString()}`);
    
    const { ano, mes } = metaQuerySchema.parse({
      ano: req.query.ano || new Date().getFullYear(),
      mes: req.query.mes || new Date().getMonth() + 1
    });

    const metas = await metasService.getAllMetas(ano, mes);
    console.log(`Retornando ${metas.length} metas`);
    
    // Retornar um array vazio se não houver metas
    return res.json(metas.length > 0 ? metas : []);
  } catch (error) {
    console.error('Erro ao buscar todas as metas:', error);
    return res.status(500).json({ error: 'Falha ao buscar todas as metas' });
  }
});

/**
 * Rota para salvar ou atualizar meta
 * POST /api/metas/salvar
 */
router.post('/salvar', async (req, res) => {
  try {
    console.log('Dados recebidos para salvar meta:', JSON.stringify(req.body));
    const metaData = metaBodySchema.parse(req.body);
    console.log('Dados validados para salvar meta:', JSON.stringify(metaData));
    const meta = await metasService.upsertMeta(metaData);
    return res.status(201).json(meta);
  } catch (error) {
    console.error('Erro ao salvar meta:', error);
    if (error instanceof z.ZodError) {
      console.error('Erro de validação Zod:', JSON.stringify(error.errors));
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    return res.status(500).json({ error: 'Falha ao salvar meta' });
  }
});

/**
 * Rota para atualizar meta existente
 * PUT /api/metas/:id
 */
router.put('/:id', async (req, res) => {
  try {
    // Validar ID da meta
    const { id } = metaParamSchema.parse({
      id: req.params.id
    });
    
    console.log(`Atualizando meta ID ${id} com dados:`, JSON.stringify(req.body));
    
    // Validar corpo da requisição
    const metaData = metaUpdateSchema.parse(req.body);
    
    // Atualizar meta no banco de dados
    const meta = await metasService.updateMeta(id, metaData);
    
    // Retornar meta atualizada
    return res.json(meta);
  } catch (error) {
    console.error('Erro ao atualizar meta:', error);
    if (error instanceof z.ZodError) {
      console.error('Erro de validação Zod:', JSON.stringify(error.errors));
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    return res.status(500).json({ error: 'Falha ao atualizar meta' });
  }
});

/**
 * Rota para excluir meta
 * DELETE /api/metas/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    // Validar ID da meta
    const { id } = metaParamSchema.parse({
      id: req.params.id
    });
    
    console.log(`Excluindo meta ID ${id}`);
    
    // Excluir meta do banco de dados
    await metasService.deleteMeta(id);
    
    // Retornar código 204 (No Content) para indicar sucesso sem conteúdo
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir meta:', error);
    if (error instanceof z.ZodError) {
      console.error('Erro de validação Zod:', JSON.stringify(error.errors));
      return res.status(400).json({ error: 'ID inválido', details: error.errors });
    }
    return res.status(500).json({ error: 'Falha ao excluir meta' });
  }
});

// Rotas específicas para métricas de Consultor
router.get('/consultor/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { ano, mes } = metaQuerySchema.parse({
      ano: req.query.ano || new Date().getFullYear(),
      mes: req.query.mes || new Date().getMonth() + 1
    });

    const meta = await metasService.getMetasByUserId(userId, ano, mes);
    
    // Retorna apenas as métricas relevantes para consultores
    // Importante: usa o campo conversaoAgendamentos no lugar do campo conversaoClientes que não existe mais
    return res.json({
      agendamentos: meta?.agendamentos || 0,
      conversaoClientes: meta?.conversaoAgendamentos || 0, // Usando o campo existente
    });
  } catch (error) {
    console.error('Erro ao buscar metas do consultor:', error);
    return res.status(500).json({ error: 'Falha ao buscar metas do consultor' });
  }
});

// Rotas específicas para métricas de Corretor
router.get('/corretor/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { ano, mes } = metaQuerySchema.parse({
      ano: req.query.ano || new Date().getFullYear(),
      mes: req.query.mes || new Date().getMonth() + 1
    });

    const meta = await metasService.getMetasByUserId(userId, ano, mes);
    
    // Retorna apenas as métricas relevantes para corretores
    return res.json({
      visitas: meta?.visitas || 0,
      vendas: meta?.vendas || 0,
      conversaoAgendamentos: meta?.conversaoAgendamentos || 0,
      conversaoVisitas: meta?.conversaoVisitas || 0,
    });
  } catch (error) {
    console.error('Erro ao buscar metas do corretor:', error);
    return res.status(500).json({ error: 'Falha ao buscar metas do corretor' });
  }
});

export default router;
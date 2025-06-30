import express from 'express';
import { db } from '../database';
import { apartamentoSchema, criarApartamentoSchema, atualizarApartamentoSchema } from '../models/apartamentos-schema';
import { ZodError } from 'zod';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Rota pública para listar apartamentos de um empreendimento
router.get('/publico/empreendimento/:id', async (req, res) => {
  try {
    const id_empreendimento = parseInt(req.params.id);
    if (isNaN(id_empreendimento)) {
      return res.status(400).json({ erro: 'ID do empreendimento inválido' });
    }

    // Verificar se o empreendimento existe
    const empreendimentoResult = await db.execute(
      sql`SELECT * FROM imoveis_empreendimentos WHERE id_empreendimento = ${id_empreendimento}`
    );
    if (empreendimentoResult.length === 0) {
      return res.status(404).json({ erro: 'Empreendimento não encontrado' });
    }

    // Buscar apartamentos
    const apartamentosResult = await db.execute(
      sql`SELECT a.*, e.zona_empreendimento, e.bairro_empreendimento, e.cidade_empreendimento, e.nome_empreendimento, e.url_foto_capa_empreendimento
          FROM imoveis_apartamentos a
          JOIN imoveis_empreendimentos e ON a.id_empreendimento = e.id_empreendimento
          WHERE a.id_empreendimento = ${id_empreendimento}
          ORDER BY a.id_apartamento`
    );

    res.json(apartamentosResult);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter apartamentos' });
  }
});

// Obter todos os apartamentos
router.get('/', async (req, res) => {
  try {
    
    
    const query = `
      SELECT a.*, 
             e.nome_empreendimento, 
             e.bairro_empreendimento, 
             e.cidade_empreendimento,
             e.zona_empreendimento,
             e.url_foto_capa_empreendimento,
             e.prazo_entrega_empreendimento
      FROM imoveis_apartamentos a
      JOIN imoveis_empreendimentos e ON a.id_empreendimento = e.id_empreendimento
      ORDER BY a.id_apartamento DESC
    `;
    
    const result = await pool.query(query);
    
    
    res.json(result.rows);
  } catch (error) {
    
    res.status(500).json({ erro: 'Erro ao obter apartamentos' });
  }
});

// Obter todos os apartamentos de um empreendimento
router.get('/empreendimento/:id', async (req, res) => {
  try {
    const id_empreendimento = parseInt(req.params.id);
    
    if (isNaN(id_empreendimento)) {
      return res.status(400).json({ erro: 'ID do empreendimento inválido' });
    }

    // Verificar se o empreendimento existe
    const empreendimentoResult = await db.execute(
      sql`SELECT * FROM imoveis_empreendimentos WHERE id_empreendimento = ${id_empreendimento}`
    );

    if (empreendimentoResult.length === 0) {
      return res.status(404).json({ erro: 'Empreendimento não encontrado' });
    }

    const apartamentosResult = await db.execute(
      sql`SELECT a.*, e.zona_empreendimento, e.bairro_empreendimento, e.cidade_empreendimento, e.nome_empreendimento, e.url_foto_capa_empreendimento
           FROM imoveis_apartamentos a
           JOIN imoveis_empreendimentos e ON a.id_empreendimento = e.id_empreendimento
           WHERE a.id_empreendimento = ${id_empreendimento} 
           ORDER BY a.id_apartamento`
    );

    res.json(apartamentosResult);
  } catch (error) {
    
    res.status(500).json({ erro: 'Erro ao obter apartamentos' });
  }
});

// Obter um apartamento específico
router.get('/:id', async (req, res) => {
  try {
    const id_apartamento = parseInt(req.params.id);
    
    if (isNaN(id_apartamento)) {
      return res.status(400).json({ erro: 'ID do apartamento inválido' });
    }

    const result = await db.execute(
      sql`SELECT * FROM imoveis_apartamentos WHERE id_apartamento = ${id_apartamento}`
    );

    if (result.length === 0) {
      return res.status(404).json({ erro: 'Apartamento não encontrado' });
    }

    res.json(result[0]);
  } catch (error) {
    
    res.status(500).json({ erro: 'Erro ao obter apartamento' });
  }
});

// Criar novo apartamento
router.post('/', async (req, res) => {
  try {
    // Validar os dados recebidos
    const apartamentoData = req.body;
    
    // Verificar se o empreendimento existe
    const empreendimentoResult = await db.execute(
      sql`SELECT * FROM imoveis_empreendimentos WHERE id_empreendimento = ${apartamentoData.id_empreendimento}`
    );

    if (empreendimentoResult.length === 0) {
      
      return res.status(404).json({ erro: 'Empreendimento não encontrado' });
    }

    // Garantir que valores numéricos sejam tratados corretamente
    if (typeof apartamentoData.valor_venda_apartamento === 'string') {
      apartamentoData.valor_venda_apartamento = apartamentoData.valor_venda_apartamento === '' ? null : Number(apartamentoData.valor_venda_apartamento);
    }
    
    // Verificar se o campo caracteristicas_apartamento é um array e convertê-lo para string JSON
    if (Array.isArray(apartamentoData.caracteristicas_apartamento)) {
      apartamentoData.caracteristicas_apartamento = JSON.stringify(apartamentoData.caracteristicas_apartamento);
    }

    // Inserir o apartamento no banco de dados
    const result = await db.execute(
      sql`INSERT INTO imoveis_apartamentos (
        id_empreendimento, 
        status_apartamento, 
        area_privativa_apartamento, 
        quartos_apartamento, 
        suites_apartamento, 
        banheiros_apartamento, 
        vagas_garagem_apartamento, 
        tipo_garagem_apartamento, 
        sacada_varanda_apartamento, 
        caracteristicas_apartamento, 
        valor_venda_apartamento, 
        titulo_descritivo_apartamento, 
        descricao_apartamento, 
        status_publicacao_apartamento
      ) VALUES (
        ${apartamentoData.id_empreendimento}, 
        ${apartamentoData.status_apartamento || 'Disponível'}, 
        ${apartamentoData.area_privativa_apartamento || null}, 
        ${apartamentoData.quartos_apartamento || null}, 
        ${apartamentoData.suites_apartamento || null}, 
        ${apartamentoData.banheiros_apartamento || null}, 
        ${apartamentoData.vagas_garagem_apartamento || null}, 
        ${apartamentoData.tipo_garagem_apartamento || ''}, 
        ${apartamentoData.sacada_varanda_apartamento === true || apartamentoData.sacada_varanda_apartamento === 'true'}, 
        ${apartamentoData.caracteristicas_apartamento || ''}, 
        ${apartamentoData.valor_venda_apartamento || null}, 
        ${apartamentoData.titulo_descritivo_apartamento || ''}, 
        ${apartamentoData.descricao_apartamento || ''}, 
        ${apartamentoData.status_publicacao_apartamento || 'Não publicado'}
      ) RETURNING *`
    );
    
    res.status(201).json(result[0]);
  } catch (error) {
    
    
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        erro: 'Dados inválidos', 
        detalhes: error.errors 
      });
    }
    
    res.status(500).json({ 
      erro: 'Erro ao criar apartamento',
      detalhes: error instanceof Error ? error.message : String(error)
    });
  }
});

// Atualizar apartamento
router.put('/:id', async (req, res) => {
  try {
    const id_apartamento = parseInt(req.params.id);
    
    if (isNaN(id_apartamento)) {
      return res.status(400).json({ erro: 'ID do apartamento inválido' });
    }
    
    // Verificar se o apartamento existe
    const checkApartamento = await pool.query(
      'SELECT * FROM imoveis_apartamentos WHERE id_apartamento = $1', 
      [id_apartamento]
    );

    if (checkApartamento.rows.length === 0) {
      return res.status(404).json({ erro: 'Apartamento não encontrado' });
    }

    // Validar os dados recebidos
    const apartamentoData = req.body;

    // Se tiver id_empreendimento, verificar se o empreendimento existe
    if (apartamentoData.id_empreendimento) {
      const checkEmpreendimento = await pool.query(
        'SELECT * FROM imoveis_empreendimentos WHERE id_empreendimento = $1',
        [apartamentoData.id_empreendimento]
      );

      if (checkEmpreendimento.rows.length === 0) {
        return res.status(404).json({ erro: 'Empreendimento não encontrado' });
      }
    }

    // Verificar se há dados para atualizar
    if (Object.keys(apartamentoData).length === 0) {
      return res.status(400).json({ erro: 'Nenhum dado fornecido para atualização' });
    }
    
    // Formatação de dados sensíveis
    if (typeof apartamentoData.valor_venda_apartamento === 'string') {
      apartamentoData.valor_venda_apartamento = apartamentoData.valor_venda_apartamento === '' ? null : Number(apartamentoData.valor_venda_apartamento);
    }
    
    if (Array.isArray(apartamentoData.caracteristicas_apartamento)) {
      apartamentoData.caracteristicas_apartamento = JSON.stringify(apartamentoData.caracteristicas_apartamento);
    }
    
    // Preparar campos e valores para a atualização
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    // Adicionar cada campo presente no request
    if (apartamentoData.status_apartamento !== undefined) {
      setClauses.push(`status_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.status_apartamento);
    }
    
    if (apartamentoData.area_privativa_apartamento !== undefined) {
      setClauses.push(`area_privativa_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.area_privativa_apartamento);
    }
    
    if (apartamentoData.quartos_apartamento !== undefined) {
      setClauses.push(`quartos_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.quartos_apartamento);
    }
    
    if (apartamentoData.suites_apartamento !== undefined) {
      setClauses.push(`suites_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.suites_apartamento);
    }
    
    if (apartamentoData.banheiros_apartamento !== undefined) {
      setClauses.push(`banheiros_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.banheiros_apartamento);
    }
    
    if (apartamentoData.vagas_garagem_apartamento !== undefined) {
      setClauses.push(`vagas_garagem_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.vagas_garagem_apartamento);
    }
    
    if (apartamentoData.tipo_garagem_apartamento !== undefined) {
      setClauses.push(`tipo_garagem_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.tipo_garagem_apartamento);
    }
    
    if (apartamentoData.sacada_varanda_apartamento !== undefined) {
      setClauses.push(`sacada_varanda_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.sacada_varanda_apartamento);
    }
    
    if (apartamentoData.caracteristicas_apartamento !== undefined) {
      setClauses.push(`caracteristicas_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.caracteristicas_apartamento);
    }
    
    if (apartamentoData.valor_venda_apartamento !== undefined) {
      setClauses.push(`valor_venda_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.valor_venda_apartamento);
    }
    
    if (apartamentoData.titulo_descritivo_apartamento !== undefined) {
      setClauses.push(`titulo_descritivo_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.titulo_descritivo_apartamento);
    }
    
    if (apartamentoData.descricao_apartamento !== undefined) {
      setClauses.push(`descricao_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.descricao_apartamento);
    }
    
    if (apartamentoData.status_publicacao_apartamento !== undefined) {
      setClauses.push(`status_publicacao_apartamento = $${paramIndex++}`);
      values.push(apartamentoData.status_publicacao_apartamento);
    }
    
    // Se não há campos para atualizar, retornamos erro
    if (setClauses.length === 0) {
      return res.status(400).json({ erro: 'Nenhum dado válido fornecido para atualização' });
    }
    
    // Adicionar ID do apartamento para o WHERE
    values.push(id_apartamento);
    
    // Montar a query de atualização
    const updateQuery = `
      UPDATE imoveis_apartamentos 
      SET ${setClauses.join(', ')}
      WHERE id_apartamento = $${values.length}
      RETURNING *
    `;
    
    // Executar a query de atualização
    const result = await pool.query(updateQuery, values);

    // Verificar se a consulta retornou algum resultado
    if (result.rows && result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(500).json({ erro: 'Erro ao atualizar apartamento: nenhum registro retornado' });
    }
  } catch (error) {
    
    
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        erro: 'Dados inválidos', 
        detalhes: error.errors 
      });
    }
    
    res.status(500).json({ erro: 'Erro ao atualizar apartamento' });
  }
});

// Excluir apartamento
router.delete('/:id', async (req, res) => {
  try {
    const id_apartamento = parseInt(req.params.id);
    
    if (isNaN(id_apartamento)) {
      return res.status(400).json({ erro: 'ID do apartamento inválido' });
    }

    // Verificar se o apartamento existe
    const apartamentoExistente = await pool.query(
      'SELECT * FROM imoveis_apartamentos WHERE id_apartamento = $1',
      [id_apartamento]
    );

    if (apartamentoExistente.rows.length === 0) {
      return res.status(404).json({ erro: 'Apartamento não encontrado' });
    }

    // Excluir o apartamento
    await pool.query(
      'DELETE FROM imoveis_apartamentos WHERE id_apartamento = $1',
      [id_apartamento]
    );

    res.status(204).send();
  } catch (error) {
    
    res.status(500).json({ erro: 'Erro ao excluir apartamento' });
  }
});

export default router;
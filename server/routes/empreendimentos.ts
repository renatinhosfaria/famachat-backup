import express from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../database';
import { empreendimentosTable, insertEmpreendimentoSchema } from '../models/empreendimentos-schema';
import { apartamentos } from '../models/apartamentos';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { logger } from '../utils/logger';

// Definindo __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB para fotos e vídeos
  }
});

// GET todos os empreendimentos
router.get('/', async (req, res) => {
  try {
    
    const result = await db.select().from(empreendimentosTable);
    res.json(result);
  } catch (error) {
    
    res.status(500).json({ error: 'Erro ao buscar empreendimentos' });
  }
});

// GET: Buscar empreendimentos por termo
router.get('/buscar', async (req, res) => {
  try {
    const { termo } = req.query;
    
    if (!termo || typeof termo !== 'string') {
      return res.status(400).json({ error: 'Termo de busca é obrigatório' });
    }

    
    
    const result = await db
      .select()
      .from(empreendimentosTable)
      .where(sql`LOWER(nome_empreendimento) LIKE LOWER(${'%' + termo + '%'})`);
    
    
    
    res.json(result);
  } catch (error) {
    
    res.status(500).json({ error: 'Erro ao buscar empreendimentos' });
  }
});

// POST cadastrar novo empreendimento
router.post('/', async (req, res) => {
  try {
    
    const dadosEmpreendimento = req.body;
    
    // Validar dados utilizando o schema
    try {
      insertEmpreendimentoSchema.parse(dadosEmpreendimento);
    } catch (err) {
      
      return res.status(400).json({ 
        error: 'Dados inválidos para cadastro de empreendimento',
        details: err 
      });
    }
    
    // Inserir no banco de dados
    try {
      const [created] = await db.insert(empreendimentosTable)
        .values(dadosEmpreendimento)
        .returning();
      
      res.status(201).json(created);
    } catch (dbError) {
      
      return res.status(500).json({ 
        error: 'Erro ao salvar empreendimento no banco de dados', 
        details: dbError instanceof Error ? dbError.message : String(dbError)
      });
    }
  } catch (err) {
    
    res.status(500).json({ 
      error: 'Erro ao cadastrar empreendimento',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// POST para cadastrar empreendimento completo com apartamentos
router.post('/completo', upload.array('fotos', 20), async (req, res) => {
  try {
    
    
    // Extrair e validar dados do empreendimento
    let dadosEmpreendimento;
    let apartamentosData;
    
    try {
      if (typeof req.body.dadosEmpreendimento === 'string') {
        dadosEmpreendimento = JSON.parse(req.body.dadosEmpreendimento);
      } else {
        dadosEmpreendimento = req.body.dadosEmpreendimento;
      }
      
      if (typeof req.body.apartamentos === 'string') {
        apartamentosData = JSON.parse(req.body.apartamentos);
      } else {
        apartamentosData = req.body.apartamentos;
      }
    } catch (error) {
      
      return res.status(400).json({ error: 'Erro ao processar dados do formulário' });
    }
    
    // Verificar dados necessários
    if (!dadosEmpreendimento) {
      return res.status(400).json({ error: 'Dados do empreendimento são obrigatórios' });
    }
    
    // Inserção apenas do empreendimento (sem apartamentos por enquanto)
    try {
      // Inserir empreendimento
      const [empreendimentoCriado] = await db.insert(empreendimentosTable)
        .values(dadosEmpreendimento)
        .returning();
      
      // Como a tabela 'apartamentos' não existe, apenas registramos quantos seriam inseridos
      if (Array.isArray(apartamentosData) && apartamentosData.length > 0) {
        
      }
      
      // Retornar o resultado apenas com o empreendimento
      res.status(201).json({
        empreendimento: empreendimentoCriado,
        apartamentos: [] // Lista vazia por enquanto
      });
    } catch (dbError) {
      
      
      return res.status(500).json({ 
        error: 'Erro ao salvar dados no banco', 
        details: dbError instanceof Error ? dbError.message : String(dbError)
      });
    }
  } catch (err) {
    
    res.status(500).json({ 
      error: 'Erro ao processar requisição de cadastro completo',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// PUT atualizar empreendimento
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Validar se o empreendimento existe
    const [existingEmpreendimento] = await db.select()
      .from(empreendimentosTable)
      .where(eq(empreendimentosTable.id, Number(id)));
      
    if (!existingEmpreendimento) {
      return res.status(404).json({ error: 'Empreendimento não encontrado' });
    }
    
    // Não permitir alteração de campos críticos
    delete updates.id;
    delete updates.dataCadastro;
    
    // Atualizar data de modificação
    updates.ultimaAtualizacao = new Date();
    
    // Realizar a atualização
    const [updated] = await db.update(empreendimentosTable)
      .set(updates)
      .where(eq(empreendimentosTable.id, Number(id)))
      .returning();
      
    res.json(updated);
  } catch (error) {
    
    res.status(500).json({ error: 'Erro ao atualizar empreendimento' });
  }
});

// GET: Buscar contatos da construtora de um empreendimento
router.get('/:id/contatos', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar dados de contato diretamente da tabela de empreendimentos
    const empreendimento = await db
      .select({
        nome: empreendimentosTable.contatoProprietario,
        telefone: empreendimentosTable.telefoneProprietario,
        nomeProprietario: empreendimentosTable.nomeProprietario
      })
      .from(empreendimentosTable)
      .where(eq(empreendimentosTable.id, parseInt(id)))
      .limit(1);

    if (!empreendimento || empreendimento.length === 0) {
      return res.status(404).json({ error: 'Empreendimento não encontrado' });
    }

    const dados = empreendimento[0];
    
    // Montar array de contatos com os dados disponíveis
    const contatos = [];
    
    if (dados.nome || dados.telefone || dados.nomeProprietario) {
      contatos.push({
        nome: dados.nome || dados.nomeProprietario || 'Contato Principal',
        telefone: dados.telefone || '',
        email: '' // Campo email não existe na estrutura atual
      });
    }

    res.json(contatos);
  } catch (error) {
    logger.error('Erro ao buscar contatos do empreendimento:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar contatos do empreendimento',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET: Buscar detalhes de um empreendimento específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    
    const empreendimento = await db
      .select()
      .from(empreendimentosTable)
      .where(eq(empreendimentosTable.id, parseInt(id)))
      .limit(1);

    if (!empreendimento || empreendimento.length === 0) {
      
      return res.status(404).json({ error: 'Empreendimento não encontrado' });
    }

    // Como a tabela 'apartamentos' ainda não existe, apenas retornamos o empreendimento
    const resultado = {
      ...empreendimento[0],
      apartamentos: [] // Lista vazia por enquanto
    };

    res.json(resultado);
  } catch (error) {
    
    res.status(500).json({ 
      error: 'Erro ao buscar detalhes do empreendimento',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Rota pública para buscar empreendimento por ID (sem autenticação)
router.get('/publico/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const empreendimento = await db
      .select()
      .from(empreendimentosTable)
      .where(eq(empreendimentosTable.id, parseInt(id)))
      .limit(1);

    if (!empreendimento || empreendimento.length === 0) {
      return res.status(404).json({ error: 'Empreendimento não encontrado' });
    }

    res.json(empreendimento[0]);
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao buscar detalhes do empreendimento',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// DELETE remover empreendimento
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar empreendimento para obter a referência
    const [empreendimento] = await db.select()
      .from(empreendimentosTable)
      .where(eq(empreendimentosTable.id, Number(id)));
      
    if (!empreendimento) {
      return res.status(404).json({ error: 'Empreendimento não encontrado' });
    }
    
    // Excluir o empreendimento (sem excluir apartamentos por enquanto, já que a tabela não existe)
    await db.delete(empreendimentosTable)
      .where(eq(empreendimentosTable.id, Number(id)));
    
    res.status(204).send();
  } catch (error) {
    
    res.status(500).json({ error: 'Erro ao excluir empreendimento' });
  }
});

export default router;
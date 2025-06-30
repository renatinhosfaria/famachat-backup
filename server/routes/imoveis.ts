import { Router } from 'express';
import { db } from '../database';
import { imoveis } from '../models/imoveis';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// Inicializa o logger específico para o módulo de imóveis
const imoveisLogger = logger.createLogger('ImoveisAPI');

const router = Router();

// Configuração do multer para upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // O diretório será definido após criar o imóvel (ver lógica abaixo)
    cb(null, '/tmp'); // temporário, será movido depois
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
  },
});
const upload = multer({ storage });

router.get('/', async (req, res) => {
  try {
    imoveisLogger.info('Solicitação de listagem de todos os imóveis');
    const result = await db.select().from(imoveis);
    imoveisLogger.debug(`Retornando ${result.length} imóveis na listagem`);
    res.json(result);
  } catch (error) {
    imoveisLogger.error('Erro ao listar imóveis', { error });
    res.status(500).json({
      error: 'Erro ao listar imóveis',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/', upload.fields([
  { name: 'fotos', maxCount: 20 },
  { name: 'videos', maxCount: 10 },
]), async (req, res) => {
  try {
    imoveisLogger.info('Iniciando cadastro de novo imóvel');
    
    // 1. Receber dados do imóvel (exceto arquivos)
    let dados;
    try {
      const dadosOriginais = JSON.parse(req.body.dadosImovel);
      imoveisLogger.debug('Dados do imóvel recebidos com sucesso');
      
      // Montar endereço completo
      const ruaNumero = dadosOriginais.rua ? `${dadosOriginais.rua}${dadosOriginais.numero ? `, ${dadosOriginais.numero}` : ''}` : '';
      const complementoBairro = `${dadosOriginais.complemento ? `${dadosOriginais.complemento}, ` : ''}${dadosOriginais.bairro || ''}`;
      const cidadeEstado = `${dadosOriginais.cidade ? `${dadosOriginais.cidade}` : ''}${dadosOriginais.estado ? ` - ${dadosOriginais.estado}` : ''}`;
      const endereco = [ruaNumero, complementoBairro, cidadeEstado].filter(Boolean).join(', ');
      
      // Mapear os campos do formulário para a estrutura do banco
      dados = {
        tipo: dadosOriginais.tipoImovel,
        nome_empreendimento: dadosOriginais.nomeEmpreendimento,
        referencia: dadosOriginais.nomeEmpreendimento || dadosOriginais.tituloDescritivo || `Imóvel ${new Date().toISOString().substring(0, 10)}`,
        rua: dadosOriginais.rua,
        numero: dadosOriginais.numero,
        complemento: dadosOriginais.complemento,
        bairro: dadosOriginais.bairro,
        cidade: dadosOriginais.cidade,
        estado: dadosOriginais.estado,
        cep: dadosOriginais.cep,
        blocos: dadosOriginais.blocos,
        andares: dadosOriginais.andares,
        aptos_por_andar: dadosOriginais.aptosPorAndar,
        valor_condominio: dadosOriginais.valorCondominio,
        proprietario_id: dadosOriginais.proprietarioId,
        servicos: dadosOriginais.servicosSelecionados,
        lazer: dadosOriginais.lazerSelecionados,
        apartamentos: dadosOriginais.apartamentos,
        valor_venda: dadosOriginais.valorVenda,
        titulo_descritivo: dadosOriginais.tituloDescritivo,
        descricao_completa: dadosOriginais.descricaoCompleta,
        status_publicacao: dadosOriginais.statusPublicacao,
        foto_capa_idx: dadosOriginais.fotoCapaIdx,
        status: 'Ativo',
        tipo_proprietario: dadosOriginais.tipoProprietario || 'Construtora',
        endereco: endereco || '', // Campo obrigatório no banco
        fotos: [],
        videos: []
      };
    } catch (error) {
      const parseError = error as Error;
      
      return res.status(400).json({ error: 'Erro ao processar dados do imóvel', details: parseError.message });
    }
    
    // 2. Criar o imóvel no banco para obter o id
    
    let created;
    try {
      // Garantir valores padrão para campos obrigatórios
      if (!dados.tipo_proprietario) {
        dados.tipo_proprietario = 'Construtora';
      }
      
      // Garantir que valor_venda não seja nulo
      if (!dados.valor_venda) {
        dados.valor_venda = '0';
      }
      
      
      
      
      const valoresParaInserir = {
        ...dados,
        fotos: [],
        videos: [],
      };
      
      [created] = await db.insert(imoveis).values(valoresParaInserir).returning();
      imoveisLogger.info(`Imóvel salvo no banco de dados com ID: ${created.id}`);
    } catch (error) {
      const dbError = error as Error;
      imoveisLogger.error('Erro ao salvar imóvel no banco de dados', { error: dbError });
      return res.status(500).json({ error: 'Erro ao salvar imóvel no banco de dados', details: dbError.message });
    }
    const imovelId = created.id;
    
    
    // 3. Criar pasta para o imóvel
    try {
      const pastaUpload = path.join(__dirname, '../upload', imovelId);
      
      
      if (!fs.existsSync(pastaUpload)) {
        fs.mkdirSync(pastaUpload, { recursive: true });
        imoveisLogger.debug(`Pasta para o imóvel ${imovelId} criada: ${pastaUpload}`);
      } else {
        imoveisLogger.debug(`Pasta para o imóvel ${imovelId} já existe: ${pastaUpload}`);
      }
      
      // 4. Mover arquivos enviados para a pasta correta e salvar caminhos
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      
      const fotos = (files?.fotos ?? []).map((file) => {
        try {
          const dest = path.join(pastaUpload, file.filename);
          
          fs.renameSync(file.path, dest);
          imoveisLogger.debug(`Foto movida: ${file.path} -> ${dest}`);
          return `/uploads/${imovelId}/${file.filename}`;
        } catch (fileError) {
          imoveisLogger.error(`Erro ao mover foto: ${file.path}`, { error: fileError });
          throw fileError;
        }
      });
      
      const videos = (files?.videos ?? []).map((file) => {
        try {
          const dest = path.join(pastaUpload, file.filename);
          
          fs.renameSync(file.path, dest);
          imoveisLogger.debug(`Vídeo movido: ${file.path} -> ${dest}`);
          return `/uploads/${imovelId}/${file.filename}`;
        } catch (fileError) {
          imoveisLogger.error(`Erro ao mover vídeo: ${file.path}`, { error: fileError });
          throw fileError;
        }
      });
      // 5. Atualizar o imóvel com os caminhos das fotos e vídeos
      try {
        imoveisLogger.info(`Atualizando imóvel ${imovelId} com ${fotos.length} fotos e ${videos.length} vídeos`);
        await db.update(imoveis).set({ fotos, videos }).where(eq(imoveis.id, imovelId));
        
        
        // 6. Retornar o imóvel criado
        const [finalImovel] = await db.select().from(imoveis).where(eq(imoveis.id, imovelId));
        imoveisLogger.info(`Imóvel ${imovelId} cadastrado com sucesso`);
        res.status(201).json(finalImovel);
      } catch (updateError) {
        imoveisLogger.error('Erro ao atualizar imóvel com mídia', { error: updateError });
        throw updateError;
      }
    } catch (fileSystemError) {
      
      // Remover o imóvel se houver erro no processamento de arquivos
      try {
        imoveisLogger.warn(`Removendo imóvel ${imovelId} devido a erro no processamento de arquivos`);
        await db.delete(imoveis).where(eq(imoveis.id, imovelId));
        imoveisLogger.debug(`Imóvel ${imovelId} removido com sucesso após falha`);
      } catch (deleteError) {
        imoveisLogger.error(`Falha ao remover imóvel ${imovelId} após erro`, { error: deleteError });
      }
      throw fileSystemError;
    }
  } catch (err) {
    imoveisLogger.error('Erro geral ao cadastrar imóvel', { error: err });
    
    if (err instanceof Error) {
      res.status(500).json({ 
        error: 'Erro ao cadastrar imóvel',
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
      });
    } else {
      res.status(500).json({ 
        error: 'Erro ao cadastrar imóvel',
        message: String(err)
      });
    }
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    
    imoveisLogger.info(`Atualizando imóvel com ID: ${id}`);
    imoveisLogger.debug(`Dados de atualização: ${JSON.stringify(update)}`);
    
    const [updated] = await db.update(imoveis).set(update).where(eq(imoveis.id, id)).returning();
    
    imoveisLogger.info(`Imóvel ${id} atualizado com sucesso`);
    res.json(updated);
  } catch (error) {
    imoveisLogger.error(`Erro ao atualizar imóvel`, { error });
    res.status(500).json({ 
      error: 'Erro ao atualizar imóvel',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    imoveisLogger.info(`Solicitação de exclusão do imóvel ${id}`);
    
    await db.delete(imoveis).where(eq(imoveis.id, id));
    
    imoveisLogger.info(`Imóvel ${id} excluído com sucesso`);
    res.status(204).send();
  } catch (error) {
    imoveisLogger.error(`Erro ao excluir imóvel ${req.params.id}`, { error });
    res.status(500).json({
      error: 'Erro ao excluir imóvel',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 
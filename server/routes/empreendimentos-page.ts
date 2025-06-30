import { Router } from 'express';
import { db } from '../database';
import { eq, desc, asc, sql } from 'drizzle-orm';
import { empreendimentosTable } from '../models/empreendimentos-schema';
import { logger } from "../utils/logger";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Inicializa o logger para o módulo de Empreendimentos
const empreendimentosLogger = logger.createLogger("EmpreendimentosAPI");

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
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB por arquivo (para suportar vídeos grandes)
    fieldSize: 10 * 1024 * 1024, // 10MB para campos de formulário
    fields: 100, // Número de campos permitidos
    files: 50 // Máximo 40 arquivos (30 fotos + 10 vídeos)
  },
  fileFilter: (req, file, cb) => {
    console.log(`[Multer] Processando arquivo: ${file.originalname}, tamanho: ${file.size}, tipo: ${file.mimetype}`);
    
    // Validar tipos de arquivo e tamanhos específicos
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'];
    
    // Limites específicos por tipo
    const maxImageSize = 50 * 1024 * 1024; // 50MB para fotos
    const maxVideoSize = 2 * 1024 * 1024 * 1024; // 2GB para vídeos
    
    if (file.fieldname === 'fotos' && allowedImageTypes.includes(file.mimetype)) {
      if (file.size && file.size > maxImageSize) {
        cb(new Error(`Foto muito grande. Tamanho máximo: 50MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`));
      } else {
        cb(null, true);
      }
    } else if (file.fieldname === 'videos' && allowedVideoTypes.includes(file.mimetype)) {
      if (file.size && file.size > maxVideoSize) {
        cb(new Error(`Vídeo muito grande. Tamanho máximo: 2GB. Tamanho atual: ${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB`));
      } else {
        cb(null, true);
      }
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype} para campo ${file.fieldname}`));
    }
  }
});

// GET: Listar todos os empreendimentos
router.get('/', async (req, res) => {
  try {
    const empreendimentos = await db.select().from(empreendimentosTable);
    
    // Formatar os dados para retornar no formato esperado pelo frontend
    const empreendimentosFormatados = empreendimentos.map(emp => {
      // Construa o endereço com verificação para campos nulos
      const parteRua = emp.ruaAvenidaEmpreendimento || '';
      const parteNumero = emp.numeroEmpreendimento ? `, ${emp.numeroEmpreendimento}` : '';
      const parteBairro = emp.bairroEmpreendimento ? ` - ${emp.bairroEmpreendimento}` : '';
      const parteCidade = emp.cidadeEmpreendimento || '';
      const parteEstado = emp.estadoEmpreendimento ? `/${emp.estadoEmpreendimento}` : '';
      
      const endereco = `${parteRua}${parteNumero}${parteBairro}, ${parteCidade}${parteEstado}`;
      
      return {
        id: emp.id,
        nome: emp.nomeEmpreendimento,
        tipo: emp.tipoImovel || 'Apartamento',
        proprietario: emp.nomeProprietario || 'Não informado',
        endereco: endereco,
        status: emp.statusEmpreendimento || 'Não informado'
      };
    });
    
    res.json(empreendimentosFormatados);
  } catch (error) {
    logger.error(`Erro ao buscar empreendimentos:`, error);
    res.status(500).json({ 
      error: 'Erro ao buscar empreendimentos',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET: Buscar empreendimento por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [empreendimento] = await db.select().from(empreendimentosTable)
      .where(eq(empreendimentosTable.id, parseInt(id)));
    
    if (!empreendimento) {
      return res.status(404).json({ error: 'Empreendimento não encontrado' });
    }
    
    res.json(empreendimento);
  } catch (error) {
    logger.error(`Erro ao buscar empreendimento com ID ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erro ao buscar empreendimento',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST: Criar novo empreendimento
router.post('/', (req, res, next) => {
  // Middleware personalizado para capturar erros do multer
  const uploadMiddleware = upload.fields([
    { name: 'fotos', maxCount: 30 }, // Máximo 30 fotos
    { name: 'videos', maxCount: 10 } // Máximo 10 vídeos
  ]);

  uploadMiddleware(req, res, (err) => {
    if (err) {
      logger.error(`[UPLOAD ERROR] Erro no middleware de upload:`, {
        error: err.message,
        code: err.code,
        field: err.field,
        path: req.path,
        contentLength: req.get('content-length')
      });

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: "Arquivo muito grande. Tamanho máximo: 50MB para fotos, 2GB para vídeos.",
          code: 'FILE_TOO_LARGE',
          errorId: Math.random().toString(36).substring(2, 15)
        });
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({
          success: false,
          message: "Muitos arquivos. Máximo permitido: 30 fotos e 10 vídeos.",
          code: 'TOO_MANY_FILES',
          errorId: Math.random().toString(36).substring(2, 15)
        });
      }

      if (err.code === 'LIMIT_FIELD_VALUE') {
        return res.status(413).json({
          success: false,
          message: "Dados do formulário muito grandes. Reduza o tamanho dos dados enviados.",
          code: 'FIELD_TOO_LARGE',
          errorId: Math.random().toString(36).substring(2, 15)
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: `Campo '${err.field}' não é aceito para upload. Use apenas 'fotos' ou 'videos'.`,
          code: 'UNEXPECTED_FIELD',
          field: err.field,
          errorId: Math.random().toString(36).substring(2, 15)
        });
      }

      return res.status(400).json({
        success: false,
        message: `Erro no upload: ${err.message}`,
        code: err.code || 'UPLOAD_ERROR',
        errorId: Math.random().toString(36).substring(2, 15)
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    logger.debug('Iniciando cadastro de empreendimento');
    
    let dadosEmpreendimento;
    try {
      if (typeof req.body.dadosEmpreendimento === 'string') {
        dadosEmpreendimento = JSON.parse(req.body.dadosEmpreendimento);
      } else {
        dadosEmpreendimento = req.body.dadosEmpreendimento || req.body;
      }
      
      logger.debug(`Dados do empreendimento recebidos: ${JSON.stringify(dadosEmpreendimento)}`);
      logger.debug(`Valor do prazo de entrega: ${dadosEmpreendimento.prazoEntregaEmpreendimento}`);
    } catch (error) {
      logger.error(`Erro ao processar dados do empreendimento:`, error);
      return res.status(400).json({ 
        error: 'Erro ao processar dados do empreendimento',
        details: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Validação básica
    if (!dadosEmpreendimento.nomeEmpreendimento) {
      return res.status(400).json({ error: 'Nome do empreendimento é obrigatório' });
    }
    
    // Criar referência temporária para organização de arquivos
    const referenciaTemp = `EMPR-${new Date().getTime()}`;
    
    // Processar arquivos (fotos e vídeos)
    const files = req.files as { 
      fotos?: Express.Multer.File[], 
      videos?: Express.Multer.File[] 
    } | undefined;
    
    let urlFotos = null;
    let urlVideos = null;
    
    try {
      // Usar uma referência única para organização do diretório de arquivos
      const referencia = referenciaTemp;
      const uploadDir = path.join(__dirname, '../uploads/empreendimentos', referencia);
      const fotosDir = path.join(uploadDir, 'fotos');
      const videosDir = path.join(uploadDir, 'videos');
      
      // Criar diretórios se não existirem
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Processar fotos se houver
      if (files?.fotos && files.fotos.length > 0) {
        // Criar diretório de fotos
        if (!fs.existsSync(fotosDir)) {
          fs.mkdirSync(fotosDir, { recursive: true });
        }
        
        // Mover arquivos e coletar URLs
        const fotosUrls = [];
        for (const file of files.fotos) {
          const destPath = path.join(fotosDir, file.filename);
          fs.renameSync(file.path, destPath);
          fotosUrls.push(`/uploads/empreendimentos/${referencia}/fotos/${file.filename}`);
        }
        
        // Verificar se foi definida uma foto de capa
        const fotoCapaIndex = req.body.fotoCapaIndex ? parseInt(req.body.fotoCapaIndex) : 0;
        
        // Armazenar a URL da foto de capa (ou primeira foto) se houver fotos
        if (fotosUrls.length > 0) {
          const capaUrl = fotosUrls[fotoCapaIndex] || fotosUrls[0];
          dadosEmpreendimento.urlFotoCapaEmpreendimento = capaUrl;
          // Em vez de armazenar apenas a foto de capa, armazenar todas as fotos
          dadosEmpreendimento.urlFotoEmpreendimento = JSON.stringify(fotosUrls);
        }
        
        urlFotos = fotosUrls;
        dadosEmpreendimento.urlFotosEmpreendimento = JSON.stringify(fotosUrls);
      }
      
      // Processar vídeos se houver
      if (files?.videos && files.videos.length > 0) {
        // Criar diretório de vídeos
        if (!fs.existsSync(videosDir)) {
          fs.mkdirSync(videosDir, { recursive: true });
        }
        
        // Mover arquivos e coletar URLs
        const videosUrls = [];
        for (const file of files.videos) {
          const destPath = path.join(videosDir, file.filename);
          fs.renameSync(file.path, destPath);
          videosUrls.push(`/uploads/empreendimentos/${referencia}/videos/${file.filename}`);
        }
        
        urlVideos = videosUrls;
        dadosEmpreendimento.urlVideosEmpreendimento = JSON.stringify(videosUrls);
        
        // Se houver ao menos um vídeo, salvar o primeiro como o vídeo principal
        if (videosUrls.length > 0) {
          dadosEmpreendimento.urlVideoEmpreendimento = videosUrls[0];
        }
      }
      
      // Inserir no banco de dados
      const [novoEmpreendimento] = await db.insert(empreendimentosTable)
        .values(dadosEmpreendimento)
        .returning();
      
      logger.debug(`Empreendimento cadastrado com sucesso: ${JSON.stringify(novoEmpreendimento)}`);
      
      res.status(201).json({
        ...novoEmpreendimento,
        urlFotos,
        urlVideos
      });
    } catch (fileError) {
      logger.error(`Erro ao processar arquivos:`, fileError);
      throw fileError;
    }
  } catch (error) {
    logger.error(`Erro ao cadastrar empreendimento:`, error);
    res.status(500).json({ 
      error: 'Erro ao cadastrar empreendimento',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// PUT: Atualizar empreendimento
router.put('/:id', upload.fields([
  { name: 'fotos', maxCount: 30 }, // Máximo 30 fotos
  { name: 'videos', maxCount: 10 } // Máximo 10 vídeos
]), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Extrair dados do empreendimento
    let dadosAtualizados;
    try {
      if (typeof req.body.dadosEmpreendimento === 'string') {
        dadosAtualizados = JSON.parse(req.body.dadosEmpreendimento);
      } else {
        dadosAtualizados = req.body.dadosEmpreendimento || req.body;
      }
      
      logger.debug(`Dados atualizados do empreendimento: ${JSON.stringify(dadosAtualizados)}`);
      logger.debug(`Valor do prazo de entrega atualizado: ${dadosAtualizados.prazoEntregaEmpreendimento}`);
    } catch (error) {
      logger.error(`Erro ao processar dados do empreendimento:`, error);
      return res.status(400).json({ 
        error: 'Erro ao processar dados do empreendimento',
        details: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Não permitir atualizar ID ou datas de criação
    delete dadosAtualizados.id;
    delete dadosAtualizados.dataCadastro;
    
    // Atualizar data de última atualização
    dadosAtualizados.ultimaAtualizacao = new Date();
    
    // Verificar se o empreendimento existe
    const [empreendimentoExistente] = await db.select().from(empreendimentosTable)
      .where(eq(empreendimentosTable.id, parseInt(id)));
    
    if (!empreendimentoExistente) {
      return res.status(404).json({ error: 'Empreendimento não encontrado' });
    }
    
    // Criar uma referência única para gerenciar uploads
    const referencia = `EMPR-${empreendimentoExistente.id}-${new Date().getTime()}`;
    
    // Processar arquivos (fotos e vídeos) se houver
    const files = req.files as { 
      fotos?: Express.Multer.File[], 
      videos?: Express.Multer.File[] 
    } | undefined;
    
    // Se houver novas fotos ou vídeos, processar
    if ((files?.fotos && files.fotos.length > 0) || (files?.videos && files.videos.length > 0)) {
      // Criar pasta para o empreendimento
      const uploadDir = path.join(__dirname, '../uploads/empreendimentos', referencia);
      const fotosDir = path.join(uploadDir, 'fotos');
      const videosDir = path.join(uploadDir, 'videos');
      
      // Criar diretórios se não existirem
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Processar fotos se houver
      if (files?.fotos && files.fotos.length > 0) {
        // Criar diretório de fotos
        if (!fs.existsSync(fotosDir)) {
          fs.mkdirSync(fotosDir, { recursive: true });
        }
        
        // Mover arquivos e coletar URLs
        const fotosUrls = [];
        for (const file of files.fotos) {
          const destPath = path.join(fotosDir, file.filename);
          fs.renameSync(file.path, destPath);
          fotosUrls.push(`/uploads/empreendimentos/${referencia}/fotos/${file.filename}`);
        }
        
        // Verificar se foi definida uma foto de capa
        const fotoCapaIndex = req.body.fotoCapaIndex ? parseInt(req.body.fotoCapaIndex) : 0;
        
        // Verificar se já existem fotos no empreendimento
        let fotosAtuais = [];
        if (empreendimentoExistente.urlFotoEmpreendimento) {
          try {
            // Verificar o tipo antes de fazer parse
            if (typeof empreendimentoExistente.urlFotoEmpreendimento === 'string') {
              fotosAtuais = JSON.parse(empreendimentoExistente.urlFotoEmpreendimento);
            } else if (Array.isArray(empreendimentoExistente.urlFotoEmpreendimento)) {
              fotosAtuais = empreendimentoExistente.urlFotoEmpreendimento;
            }
          } catch (e) {
            fotosAtuais = [];
          }
        }
        
        // Adicionar novas fotos às existentes
        const todasFotos = [...fotosAtuais, ...fotosUrls];
        
        // Atualizar a URL da foto de capa se necessário
        if (fotosUrls.length > 0 && req.body.atualizarCapa === 'true') {
          const capaUrl = fotosUrls[fotoCapaIndex] || fotosUrls[0];
          dadosAtualizados.urlFotoCapaEmpreendimento = capaUrl;
        }
        
        // Armazenar todas as fotos no campo urlFotoEmpreendimento
        dadosAtualizados.urlFotoEmpreendimento = JSON.stringify(todasFotos);
        
        dadosAtualizados.urlFotosEmpreendimento = JSON.stringify(todasFotos);
      }
      
      // Processar vídeos se houver
      if (files?.videos && files.videos.length > 0) {
        // Criar diretório de vídeos
        if (!fs.existsSync(videosDir)) {
          fs.mkdirSync(videosDir, { recursive: true });
        }
        
        // Mover arquivos e coletar URLs
        const videosUrls = [];
        for (const file of files.videos) {
          const destPath = path.join(videosDir, file.filename);
          fs.renameSync(file.path, destPath);
          videosUrls.push(`/uploads/empreendimentos/${referencia}/videos/${file.filename}`);
        }
        
        // Verificar se já existem vídeos no empreendimento
        let videosAtuais = [];
        if (empreendimentoExistente.urlVideoEmpreendimento) {
          // Se houver apenas um vídeo, colocá-lo em um array
          if (typeof empreendimentoExistente.urlVideoEmpreendimento === 'string') {
            videosAtuais = [empreendimentoExistente.urlVideoEmpreendimento];
          } else if (Array.isArray(empreendimentoExistente.urlVideoEmpreendimento)) {
            videosAtuais = empreendimentoExistente.urlVideoEmpreendimento;
          } else if (empreendimentoExistente.urlVideoEmpreendimento) {
            try {
              // Tentar fazer parse se for uma string JSON
              videosAtuais = JSON.parse(String(empreendimentoExistente.urlVideoEmpreendimento));
            } catch (e) {
              videosAtuais = [];
            }
          }
        }
        
        // Adicionar novos vídeos aos existentes
        const todosVideos = [...videosAtuais, ...videosUrls];
        dadosAtualizados.urlVideosEmpreendimento = JSON.stringify(todosVideos);
        
        // Se não houver vídeo principal definido, definir o primeiro vídeo novo
        if (!empreendimentoExistente.urlVideoEmpreendimento && videosUrls.length > 0) {
          dadosAtualizados.urlVideoEmpreendimento = videosUrls[0];
        }
      }
    }
    
    // Atualizar empreendimento no banco de dados
    const [empreendimentoAtualizado] = await db.update(empreendimentosTable)
      .set(dadosAtualizados)
      .where(eq(empreendimentosTable.id, parseInt(id)))
      .returning();
    
    res.json(empreendimentoAtualizado);
  } catch (error) {
    logger.error(`Erro ao atualizar empreendimento com ID ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erro ao atualizar empreendimento',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// DELETE: Excluir empreendimento
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o empreendimento existe
    // Tenta primeiro pela coluna id, mas se for UUID, busca alternativa
    let empreendimento;
    try {
      // Tenta primeiro convertendo para número
      const [result] = await db.select().from(empreendimentosTable)
        .where(eq(empreendimentosTable.id, parseInt(id)));
      
      empreendimento = result;
    } catch (error) {
      // Se falhar, tenta buscar pelo id como texto (pode ser um UUID)
      logger.debug(`Erro ao buscar empreendimento por ID numérico, tentando como UUID: ${error}`);
      const [resultByUUID] = await db.select().from(empreendimentosTable)
        .where(sql`${empreendimentosTable.id}::text = ${id}`);
      
      empreendimento = resultByUUID;
    }
    
    if (!empreendimento) {
      return res.status(404).json({ error: 'Empreendimento não encontrado' });
    }
    
    // Tentar remover os arquivos associados
    try {
      const referencia = `EMPR-${empreendimento.id}`;
      const uploadDir = path.join(__dirname, '../uploads/empreendimentos', referencia);
      
      if (fs.existsSync(uploadDir)) {
        // Função auxiliar para remover diretório recursivamente
        const removeDir = (dirPath: string) => {
          if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach((file) => {
              const curPath = path.join(dirPath, file);
              if (fs.lstatSync(curPath).isDirectory()) {
                // Se for um diretório, chama recursivamente
                removeDir(curPath);
              } else {
                // Se for um arquivo, remove
                fs.unlinkSync(curPath);
              }
            });
            // Remove o diretório vazio
            fs.rmdirSync(dirPath);
          }
        };
        
        // Remover o diretório e todo seu conteúdo
        removeDir(uploadDir);
        logger.info(`Arquivos do empreendimento removidos em: ${uploadDir}`);
      }
    } catch (fileError) {
      logger.error(`Erro ao remover arquivos do empreendimento:`, fileError);
      // Continua mesmo em caso de erro de remoção de arquivos
    }
    
    // Remover o empreendimento do banco de dados
    try {
      // Tenta excluir usando ID como número
      await db.delete(empreendimentosTable)
        .where(eq(empreendimentosTable.id, parseInt(id)));
    } catch (deleteError) {
      // Se falhar, tenta excluir usando ID como string (UUID)
      logger.debug(`Erro ao excluir por ID numérico, tentando como UUID: ${deleteError}`);
      await db.delete(empreendimentosTable)
        .where(sql`${empreendimentosTable.id}::text = ${id}`);
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error(`Erro ao excluir empreendimento com ID ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erro ao excluir empreendimento',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST: Upload sequencial de fotos individuais
router.post('/upload-foto', upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma foto foi enviada',
        code: 'NO_FILE'
      });
    }

    const { empreendimentoId } = req.body;
    
    if (!empreendimentoId) {
      return res.status(400).json({
        success: false,
        message: 'ID do empreendimento é obrigatório',
        code: 'MISSING_EMPREENDIMENTO_ID'
      });
    }

    // Criar estrutura de diretórios
    const referencia = `EMPR-${empreendimentoId}`;
    const uploadDir = path.join(__dirname, '../uploads/empreendimentos', referencia);
    const fotosDir = path.join(uploadDir, 'fotos');
    
    if (!fs.existsSync(fotosDir)) {
      fs.mkdirSync(fotosDir, { recursive: true });
    }

    // Mover arquivo para diretório final
    const destPath = path.join(fotosDir, req.file.filename);
    fs.renameSync(req.file.path, destPath);
    
    const fotoUrl = `/uploads/empreendimentos/${referencia}/fotos/${req.file.filename}`;
    
    logger.info(`Foto uploaded com sucesso: ${fotoUrl}`);
    
    res.json({
      success: true,
      message: 'Foto enviada com sucesso',
      fotoUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
    
  } catch (error) {
    logger.error('Erro no upload de foto individual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor no upload',
      code: 'INTERNAL_ERROR'
    });
  }
});

// POST: Upload sequencial de vídeos individuais
router.post('/upload-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum vídeo foi enviado',
        code: 'NO_FILE'
      });
    }

    const { empreendimentoId } = req.body;
    
    if (!empreendimentoId) {
      return res.status(400).json({
        success: false,
        message: 'ID do empreendimento é obrigatório',
        code: 'MISSING_EMPREENDIMENTO_ID'
      });
    }

    // Criar estrutura de diretórios
    const referencia = `EMPR-${empreendimentoId}`;
    const uploadDir = path.join(__dirname, '../uploads/empreendimentos', referencia);
    const videosDir = path.join(uploadDir, 'videos');
    
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    // Mover arquivo para diretório final
    const destPath = path.join(videosDir, req.file.filename);
    fs.renameSync(req.file.path, destPath);
    
    const videoUrl = `/uploads/empreendimentos/${referencia}/videos/${req.file.filename}`;
    
    logger.info(`Vídeo uploaded com sucesso: ${videoUrl}`);
    
    res.json({
      success: true,
      message: 'Vídeo enviado com sucesso',
      videoUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
    
  } catch (error) {
    logger.error('Erro no upload de vídeo individual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor no upload',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
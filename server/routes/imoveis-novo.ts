import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../database';
import { imoveisNovo, insertImoveisNovoSchema } from '../models/imoveis-novo';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Definindo __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

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
    fileSize: 100 * 1024 * 1024, // 100MB para fotos
  }
});

// Configuração do middleware de upload para vários arquivos
const uploadFields = upload.fields([
  { name: 'fotos', maxCount: 20 },
  { name: 'videos', maxCount: 5 }
]);

// GET todos os imóveis
router.get('/', async (req, res) => {
  try {
    const result = await db.select().from(imoveisNovo);
    res.json(result);
  } catch (error) {
    
    res.status(500).json({ error: 'Erro ao buscar imóveis' });
  }
});

// GET imóvel pelo ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.select().from(imoveisNovo).where(eq(imoveisNovo.id, id));
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }
    
    res.json(result[0]);
  } catch (error) {
    
    res.status(500).json({ error: 'Erro ao buscar imóvel' });
  }
});

// POST: cadastrar novo imóvel
router.post('/', uploadFields, async (req, res) => {
  try {
    
    
    if (!req.body.dadosImovel) {
      return res.status(400).json({ error: 'Dados do imóvel não fornecidos' });
    }
    
    let dadosImovel;
    try {
      dadosImovel = JSON.parse(req.body.dadosImovel);
    } catch (error) {
      
      return res.status(400).json({ error: 'Erro ao processar dados do imóvel' });
    }
    
    // Garantir que campos obrigatórios estejam preenchidos
    if (!dadosImovel.tipoImovel) {
      return res.status(400).json({ error: 'Tipo de imóvel é obrigatório' });
    }
    
    if (!dadosImovel.referencia) {
      // Gerar referência automática se não fornecida
      dadosImovel.referencia = dadosImovel.nomeEmpreendimento || 
                              dadosImovel.tituloDescritivoComerciais || 
                              `Imóvel ${new Date().toISOString().substring(0, 10)}`;
    }
    
    // Garantir valores padrão para campos obrigatórios
    if (!dadosImovel.tipoProprietario) {
      dadosImovel.tipoProprietario = 'Construtora';
    }
    
    if (!dadosImovel.valorVendaComerciais) {
      dadosImovel.valorVendaComerciais = '0';
    }
    
    if (!dadosImovel.statusPublicacaoComerciais) {
      dadosImovel.statusPublicacaoComerciais = 'Ativo';
    }
    
    
    
    // Inserir no banco de dados
    try {
      const [created] = await db.insert(imoveisNovo).values(dadosImovel).returning();
      
      const imovelId = created.id;
      
      // Processar arquivos (fotos e vídeos)
      try {
        const uploadDir = path.join(__dirname, '../uploads', imovelId);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Processar fotos
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        
        // Arrays para armazenar URLs
        const fotoUrls: string[] = [];
        const videoUrls: string[] = [];
        
        // Processar fotos
        if (files?.fotos) {
          for (const file of files.fotos) {
            const destPath = path.join(uploadDir, file.filename);
            fs.renameSync(file.path, destPath);
            fotoUrls.push(`/uploads/${imovelId}/${file.filename}`);
          }
        }
        
        // Processar vídeos
        if (files?.videos) {
          for (const file of files.videos) {
            const destPath = path.join(uploadDir, file.filename);
            fs.renameSync(file.path, destPath);
            videoUrls.push(`/uploads/${imovelId}/${file.filename}`);
          }
        }
        
        // Atualizar imóvel com URLs de fotos e vídeos
        if (fotoUrls.length > 0 || videoUrls.length > 0) {
          const updateData: any = {};
          
          if (fotoUrls.length > 0) {
            updateData.urlFotoApartamento = fotoUrls;
            // Definir a primeira foto como foto de capa se não foi especificada
            if (!created.urlFotoCapaApartamento && fotoUrls.length > 0) {
              updateData.urlFotoCapaApartamento = fotoUrls[0];
            }
          }
          
          if (videoUrls.length > 0) {
            updateData.urlVideoApartamento = videoUrls;
          }
          
          await db.update(imoveisNovo)
            .set(updateData)
            .where(eq(imoveisNovo.id, imovelId));
            
          
        }
        
        // Buscar imóvel atualizado
        const [finalImovel] = await db.select().from(imoveisNovo).where(eq(imoveisNovo.id, imovelId));
        
        
        res.status(201).json(finalImovel);
      } catch (fileError) {
        
        
        // Remover imóvel se houver erro no processamento de arquivos
        await db.delete(imoveisNovo).where(eq(imoveisNovo.id, imovelId));
        
        throw fileError;
      }
    } catch (dbError) {
      
      return res.status(500).json({ 
        error: 'Erro ao salvar imóvel no banco de dados', 
        details: dbError instanceof Error ? dbError.message : String(dbError)
      });
    }
  } catch (err) {
    
    res.status(500).json({ 
      error: 'Erro ao cadastrar imóvel',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// PUT: atualizar imóvel existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Validar e processar atualizações
    delete updates.id; // Garantir que o ID não seja alterado
    delete updates.dataCadastro; // Não permitir alterar a data de cadastro
    
    // Definir data de atualização
    updates.ultimaAtualizacao = new Date();
    
    const [updated] = await db.update(imoveisNovo)
      .set(updates)
      .where(eq(imoveisNovo.id, id))
      .returning();
      
    if (!updated) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }
    
    res.json(updated);
  } catch (error) {
    
    res.status(500).json({ error: 'Erro ao atualizar imóvel' });
  }
});

// DELETE: remover imóvel
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o imóvel existe
    const [imovel] = await db.select().from(imoveisNovo).where(eq(imoveisNovo.id, id));
    
    if (!imovel) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }
    
    // Remover arquivos associados
    const uploadDir = path.join(__dirname, '../uploads', id);
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
    
    // Remover registro do banco
    await db.delete(imoveisNovo).where(eq(imoveisNovo.id, id));
    
    res.status(204).send();
  } catch (error) {
    
    res.status(500).json({ error: 'Erro ao excluir imóvel' });
  }
});

export default router;
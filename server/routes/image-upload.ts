import { Router } from 'express';
import { upload, getPublicImageUrl } from '../services/image-upload';
import { logger } from '../utils/logger';

const router = Router();

// Rota para upload de imagem de perfil
router.post('/uploads/profile-picture', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        message: 'Nenhum arquivo enviado',
        error: 'É necessário enviar um arquivo de imagem'
      });
    }

    // Obter o nome do arquivo que foi salvo
    const filename = req.file.filename;
    
    // Criar a URL para acessar a imagem
    const imageUrl = getPublicImageUrl(filename);
    
    logger.info(`Imagem de perfil enviada com sucesso: ${filename}`);
    
    // Retornar a URL da imagem para o cliente
    return res.status(200).json({
      message: 'Imagem enviada com sucesso',
      imageUrl,
      filename
    });
  } catch (error) {
    logger.error(`Erro ao processar upload de imagem: ${error}`);
    return res.status(500).json({ 
      message: 'Erro ao processar o upload da imagem',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
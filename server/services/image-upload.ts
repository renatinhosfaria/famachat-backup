import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configurar o diretório de uploads
const uploadDir = path.resolve(process.cwd(), 'uploads');

// Garantir que o diretório exista
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Função para filtrar arquivos de imagem e vídeo
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Aceitar apenas imagens e vídeos
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm)$/i)) {
    return cb(new Error('Apenas arquivos de imagem ou vídeo são permitidos!'));
  }
  cb(null, true);
};

// Função para criar storage dinâmico por imóvel
export function getImovelUpload(imovelId: string) {
  const imovelDir = path.resolve(process.cwd(), 'uploads', imovelId);
  if (!fs.existsSync(imovelDir)) {
    fs.mkdirSync(imovelDir, { recursive: true });
  }
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, imovelDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
  return multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB para vídeos
    fileFilter
});
}

// Função para gerar URL completa para o arquivo enviado
export const getImageUrl = (req: any, filename: string): string => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  
  // Construir URL completa
  return `${protocol}://${host}/uploads/${filename}`;
};
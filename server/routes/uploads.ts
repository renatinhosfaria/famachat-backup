import express from 'express';
import { getImageUrl, getImovelUpload } from '../services/image-upload';
import { log } from '../vite';

// Rota para upload de imagens
export function registerUploadRoutes(app: express.Express) {
  // Rota para upload de fotos e vídeos de imóvel
  app.post('/api/uploads/imovel/:imovelId', (req, res, next) => {
    const { imovelId } = req.params;
    if (!imovelId) {
      return res.status(400).json({ success: false, message: 'Código do imóvel não informado' });
      }
    // Middleware dinâmico do multer
    const upload = getImovelUpload(imovelId).array('files', 20); // até 20 arquivos por vez
    upload(req, res, function (err) {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      if (!req.files || !(req.files instanceof Array) || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
      }
      // URLs dos arquivos salvos
      const files = req.files.map((file: any) => ({
        originalname: file.originalname,
        filename: file.filename,
        url: `/uploads/${imovelId}/${file.filename}`
      }));
      return res.status(200).json({ success: true, message: 'Arquivos enviados com sucesso', files });
    });
  });
}
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Upload, Loader2 } from 'lucide-react';

interface UploadSequencialProps {
  empreendimentoId?: number;
  onUploadComplete?: (urls: string[]) => void;
  onUploadProgress?: (progress: number) => void;
  maxFiles?: number;
  acceptedTypes?: string;
  uploadType: 'fotos' | 'videos';
}

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
  progress?: number;
}

export const UploadSequencial: React.FC<UploadSequencialProps> = ({
  empreendimentoId,
  onUploadComplete,
  onUploadProgress,
  maxFiles = 30,
  acceptedTypes = 'image/*',
  uploadType = 'fotos'
}) => {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUpload, setCurrentUpload] = useState(0);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const fileArray = Array.from(selectedFiles);
    
    // Verificar limite de arquivos
    if (fileArray.length > maxFiles) {
      alert(`Máximo de ${maxFiles} arquivos permitidos`);
      return;
    }

    // Verificar tamanho individual dos arquivos (100MB cada)
    const maxSize = 100 * 1024 * 1024; // 100MB
    const oversizedFiles = fileArray.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      alert(`Os seguintes arquivos são muito grandes (máximo 100MB cada): ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    const newFiles: FileUploadStatus[] = fileArray.map(file => ({
      file,
      status: 'pending'
    }));

    setFiles(newFiles);
    setUploadedUrls([]);
  }, [maxFiles]);

  const uploadSingleFile = async (fileStatus: FileUploadStatus): Promise<string> => {
    const formData = new FormData();
    const endpoint = uploadType === 'fotos' ? '/api/empreendimentos-page/upload-foto' : '/api/empreendimentos-page/upload-video';
    const fieldName = uploadType === 'fotos' ? 'foto' : 'video';
    
    formData.append(fieldName, fileStatus.file);
    if (empreendimentoId) {
      formData.append('empreendimentoId', empreendimentoId.toString());
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include' // Para incluir cookies de autenticação
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro no upload');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Upload falhou');
      }

      return result.fotoUrl || result.videoUrl;
    } catch (error) {
      console.error('Erro no upload:', error);
      throw error;
    }
  };

  const startUpload = async () => {
    if (!empreendimentoId) {
      alert('É necessário criar o empreendimento antes de fazer upload dos arquivos');
      return;
    }

    setIsUploading(true);
    setCurrentUpload(0);
    const newUploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setCurrentUpload(i + 1);
        
        // Atualizar status para uploading
        setFiles(prev => prev.map((file, index) => 
          index === i ? { ...file, status: 'uploading' } : file
        ));

        try {
          const url = await uploadSingleFile(files[i]);
          
          // Sucesso
          setFiles(prev => prev.map((file, index) => 
            index === i ? { ...file, status: 'success', url } : file
          ));
          
          newUploadedUrls.push(url);
          
          // Atualizar progresso
          const progress = ((i + 1) / files.length) * 100;
          onUploadProgress?.(progress);
          
        } catch (error) {
          // Erro no upload individual
          setFiles(prev => prev.map((file, index) => 
            index === i ? { 
              ...file, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Erro desconhecido' 
            } : file
          ));
          
          console.error(`Erro no upload do arquivo ${files[i].file.name}:`, error);
          // Continua com o próximo arquivo mesmo se um falhar
        }

        // Pequena pausa entre uploads para não sobrecarregar o servidor
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setUploadedUrls(newUploadedUrls);
      onUploadComplete?.(newUploadedUrls);
      
    } finally {
      setIsUploading(false);
      setCurrentUpload(0);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetUpload = () => {
    setFiles([]);
    setUploadedUrls([]);
    setCurrentUpload(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            accept={acceptedTypes}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <Button 
            type="button" 
            variant="outline" 
            disabled={isUploading}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Selecionar {uploadType === 'fotos' ? 'Fotos' : 'Vídeos'}
          </Button>
        </label>

        {files.length > 0 && !isUploading && (
          <Button onClick={startUpload} className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Fazer Upload ({files.length} arquivo{files.length > 1 ? 's' : ''})
          </Button>
        )}

        {files.length > 0 && (
          <Button 
            variant="outline" 
            onClick={resetUpload}
            disabled={isUploading}
          >
            Limpar
          </Button>
        )}
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Enviando arquivo {currentUpload} de {files.length}...</span>
          </div>
          <Progress value={(currentUpload / files.length) * 100} className="w-full" />
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Arquivos selecionados:</h4>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {files.map((fileStatus, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  {fileStatus.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {fileStatus.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                  {fileStatus.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {fileStatus.status === 'pending' && <div className="h-4 w-4 border rounded-full" />}
                  
                  <span className="text-sm truncate max-w-xs">
                    {fileStatus.file.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({(fileStatus.file.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>

                {fileStatus.status === 'pending' && !isUploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    Remover
                  </Button>
                )}

                {fileStatus.status === 'error' && (
                  <div className="text-xs text-red-500 max-w-xs truncate">
                    {fileStatus.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadedUrls.length > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {uploadedUrls.length} arquivo{uploadedUrls.length > 1 ? 's' : ''} enviado{uploadedUrls.length > 1 ? 's' : ''} com sucesso!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default UploadSequencial;

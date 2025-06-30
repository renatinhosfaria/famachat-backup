import { useState, useRef, ChangeEvent } from "react";
import { X, FileText, ImageIcon, Video, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MediaUploadProps {
  onSubmit: (file: File, caption: string) => Promise<void>;
  isUploading: boolean;
  onCancel: () => void;
  mediaType: "image" | "video" | "document";
  file: File | null;
}

const MediaUpload: React.FC<MediaUploadProps> = ({
  onSubmit,
  isUploading,
  onCancel,
  mediaType,
  file
}) => {
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  // Efeito para criar preview da mídia
  useState(() => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  });

  // Função para submeter o upload
  const handleSubmit = async () => {
    if (!file) return;
    await onSubmit(file, caption);
  };

  // Renderizar ícone adequado para o tipo de mídia
  const renderIcon = () => {
    switch (mediaType) {
      case "image":
        return <ImageIcon className="h-10 w-10 text-blue-500" />;
      case "video":
        return <Video className="h-10 w-10 text-purple-500" />;
      case "document":
      default:
        return <FileText className="h-10 w-10 text-red-500" />;
    }
  };

  // Renderizar preview da mídia selecionada
  const renderPreview = () => {
    if (!preview) return null;
    
    if (mediaType === "image") {
      return (
        <div className="mt-4 relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-auto rounded-md max-h-[300px] object-contain"
          />
        </div>
      );
    } else if (mediaType === "video") {
      return (
        <div className="mt-4 relative">
          <video
            src={preview}
            controls
            className="w-full h-auto rounded-md max-h-[300px]"
          />
        </div>
      );
    } else {
      return (
        <div className="mt-4 p-4 border rounded-md flex items-center">
          {renderIcon()}
          <div className="ml-3 overflow-hidden">
            <p className="font-medium truncate">{file?.name}</p>
            <p className="text-sm text-gray-500">
              {(file?.size && (file.size / 1024 / 1024).toFixed(2)) || "0"} MB
            </p>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-4">
      {renderPreview()}
      
      {/* Campo de legenda para imagens e vídeos */}
      {(mediaType === "image" || mediaType === "video") && (
        <div className="mt-4">
          <Label htmlFor="caption">Legenda (opcional)</Label>
          <Textarea
            id="caption"
            ref={captionRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Adicione uma legenda..."
            className="resize-none h-20"
          />
        </div>
      )}
      
      {/* Informações e tamanho do arquivo */}
      <div className="text-sm text-gray-500">
        {file && (
          <p>
            Arquivo: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
        {mediaType === "image" && <p>Formatos suportados: JPG, PNG, GIF</p>}
        {mediaType === "video" && <p>Formatos suportados: MP4, MOV, AVI</p>}
        {mediaType === "document" && <p>Formatos suportados: PDF, DOC, DOCX, XLS, XLSX, TXT</p>}
      </div>
      
      {/* Botões de ação */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onCancel} disabled={isUploading}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        
        <Button onClick={handleSubmit} disabled={isUploading}>
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Enviar
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default MediaUpload;
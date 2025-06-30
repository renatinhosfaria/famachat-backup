import * as React from "react";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface QrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCodeData: string | null;
}

export function QrCodeDialog({ open, onOpenChange, qrCodeData }: QrCodeDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  
  // Atualizar o qrCode interno quando qrCodeData mudar
  // Usando uma ref para evitar processamentos duplicados do mesmo QR code
  const lastProcessedQrCode = useRef<string | null>(null);
  
  useEffect(() => {
    if (qrCodeData && qrCodeData !== lastProcessedQrCode.current) {
      // Armazenar o QR code atual para não processar novamente
      lastProcessedQrCode.current = qrCodeData;
      setQrCode(qrCodeData);
      
      // Log menos verboso
      
    }
  }, [qrCodeData]);
  
  // Reset error state when opening the dialog
  useEffect(() => {
    if (open) {
      setQrError(null);
    } else {
      // Quando o diálogo fechar, resetar o estado
      lastProcessedQrCode.current = null;
    }
  }, [open]);

  // Cache para URL processada para evitar processamento repetitivo
  const processedUrlCache = useRef<string | null>(null);
  
  // Criar uma URL segura para o QR code
  const getImageUrl = (qrCode: string) => {
    try {
      // Se estamos processando o mesmo QR code e já temos uma URL processada, retornar do cache
      if (qrCode === lastProcessedQrCode.current && processedUrlCache.current) {
        return processedUrlCache.current;
      }
      
      // Se a string estiver vazia ou não for string
      if (!qrCode || typeof qrCode !== 'string') {
        throw new Error("QR code inválido");
      }
      
      let result: string;
      
      // Se já começa com data:image, use diretamente
      if (qrCode.startsWith("data:image")) {
        result = qrCode;
      }
      // Se contém data:image em algum lugar no meio da string, extraia
      else if (qrCode.includes("data:image/png;base64,")) {
        const dataIndex = qrCode.indexOf("data:image/png;base64,");
        result = qrCode.substring(dataIndex);
      }
      // Caso contrário, assuma que é base64 puro e adicione o prefixo
      else {
        result = `data:image/png;base64,${qrCode}`;
      }
      
      // Armazenar no cache
      processedUrlCache.current = result;
      return result;
    } catch (err) {
      
      setQrError("Erro ao processar o formato do QR Code.");
      toast({
        variant: "destructive",
        title: "Erro no QR Code",
        description: "Formato do QR Code é inválido ou corrompido.",
      });
      return "";
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[485px]">
        <DialogHeader>
          <DialogTitle className="text-center text-lg text-[#128C7E]">
            Conecte seu WhatsApp
          </DialogTitle>
          <DialogDescription className="text-center">
            Escaneie o QR Code para conectar seu WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 flex flex-col items-center justify-center">
          {qrCode && !qrError && (
            <div className="flex flex-col items-center">
              <img
                src={getImageUrl(qrCode)}
                alt="QR Code WhatsApp"
                className="w-64 h-64 border border-gray-200 p-2 bg-white"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  setQrError("Não foi possível exibir o QR Code. Formato inválido.");
                  toast({
                    variant: "destructive",
                    title: "Erro no QR Code",
                    description: "Não foi possível carregar a imagem do QR Code.",
                  });
                }}
              />
              <p className="text-sm text-gray-500 mt-2">
                Escaneie este QR Code com seu aplicativo WhatsApp para conectar.
              </p>
            </div>
          )}

          {qrError && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-md w-full max-w-sm">
              <p className="text-red-600 font-medium">{qrError}</p>
              <p className="text-sm text-gray-600 mt-2">
                Não foi possível exibir o QR Code. Tente novamente.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4">
            Este QR Code expira em poucos minutos.
          </p>
        </div>

        <DialogFooter className="flex flex-col space-y-2 sm:space-y-0">
          <Button 
            variant="secondary" 
            className="w-full" 
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
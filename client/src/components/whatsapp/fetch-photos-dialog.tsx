import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

// Interface para o status retornado pela API
interface ProfilePicStatus {
  operation: string;
  batchCurrent: number;
  batchTotal: number;
  clientsProcessed: number;
  clientsTotal: number;
  isRunning: boolean;
  isFinished: boolean;
  startTime: string;
  endTime: string | null;
  updatedPhotos: number;
  elapsedTimeInSeconds: number;
}

export function FetchPhotosDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [updateMissingJids, setUpdateMissingJids] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [processingDetails, setProcessingDetails] = useState<string>("");
  
  // Referência para o intervalo de verificação de status
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // Verificar periodicamente o status do processo
  const checkStatus = async () => {
    try {
      // Obter instâncias de WhatsApp para encontrar a primeira ativa
      const instancesResponse = await fetch("/api/whatsapp/instances");
      const instances = await instancesResponse.json();
      
      if (!instances || !Array.isArray(instances) || instances.length === 0) {
        
        return;
      }
      
      // Usar a primeira instância (normalmente é a principal)
      const primaryInstance = instances[0];
      
      // Verificar o status da operação
      const statusResponse = await fetch(`/api/whatsapp/check-status/${primaryInstance.id}`);
      const status = await statusResponse.json();
      
      if (status.isFinished) {
        // Se o processo terminou, atualizar a UI
        setLoading(false);
        setCompleted(true);
        
        // Limpar o intervalo de verificação
        if (statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current);
          statusCheckIntervalRef.current = null;
        }
        
        // Atualizar mensagem de status
        const message = `${status.updatedPhotos} fotos atualizadas em ${status.elapsedTimeInSeconds}s`;
        setProcessingDetails(message);
        
        toast({
          title: "Busca de fotos concluída",
          description: message,
        });
      } else if (status.isRunning) {
        // Atualizar mensagem de status durante o processamento
        setStatusMessage(`Processando lote ${status.batchCurrent}/${status.batchTotal}`);
        setProcessingDetails(`${status.clientsProcessed}/${status.clientsTotal} clientes processados`);
      }
    } catch (error) {
      
    }
  };

  // Resetar o estado quando o diálogo for aberto ou fechado
  useEffect(() => {
    if (!open) {
      setLoading(false);
      setCompleted(false);
      setStatusMessage("");
      setProcessingDetails("");
      
      // Limpar o intervalo de verificação quando o diálogo for fechado
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
    }
  }, [open]);
  
  // Limpar o intervalo ao desmontar o componente
  useEffect(() => {
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, []);;

  const startFetchingPhotos = async () => {
    setLoading(true);
    setCompleted(false);
    setStatusMessage("Iniciando processo...");
    
    try {
      // Iniciar o processo no backend
      await apiRequest({
        url: "/api/whatsapp/batch-fetch-profile-pictures",
        method: "POST",
        body: {
          updateMissingJids: updateMissingJids,
          forceUpdate: forceUpdate
        }
      });
      
      toast({
        title: "Processo iniciado",
        description: "A busca de fotos de perfil foi iniciada com sucesso",
      });
      
      // Iniciar verificação periódica do status (a cada 3 segundos)
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
      
      // Executar verificação imediatamente e depois a cada 3 segundos
      checkStatus();
      statusCheckIntervalRef.current = setInterval(checkStatus, 3000);
      
    } catch (error: any) {
      
      
      toast({
        title: "Erro ao iniciar o processo",
        description: error.message || "Não foi possível iniciar a busca de fotos de perfil",
        variant: "destructive",
      });
      
      setLoading(false);
      setStatusMessage("");
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setOpen(true)}
        className="whitespace-nowrap"
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Buscar Fotos de Perfil
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Buscar Fotos de Perfil do WhatsApp</DialogTitle>
            <DialogDescription>
              Este processo irá buscar as fotos de perfil de todos os clientes que têm WhatsApp
              validado. Isso pode levar algum tempo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="updateJids" 
                checked={updateMissingJids} 
                onCheckedChange={(checked) => setUpdateMissingJids(checked as boolean)}
                disabled={loading}
              />
              <Label htmlFor="updateJids" className="text-sm">
                Atualizar JIDs faltantes antes de buscar fotos
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="forceUpdate" 
                checked={forceUpdate} 
                onCheckedChange={(checked) => setForceUpdate(checked as boolean)}
                disabled={loading}
              />
              <Label htmlFor="forceUpdate" className="text-sm">
                Atualizar todas as fotos (mesmo as que já existem)
              </Label>
            </div>

            <div className="space-y-2">
              {/* Durante o processamento, mostrar mensagem de "Em andamento" */}
              {loading && !completed && (
                <div className="text-sm font-medium p-4 bg-blue-50 rounded-md">
                  <div className="text-center">
                    <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                    <p>{statusMessage || "Buscando fotos de perfil..."}</p>
                    {processingDetails && (
                      <p className="text-xs text-muted-foreground">
                        {processingDetails}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Quando concluído, mostrar resumo */}
              {completed && (
                <div className="text-sm font-medium p-4 bg-green-50 rounded-md">
                  <p className="text-center font-semibold">Processo finalizado</p>
                  {processingDetails ? (
                    <p className="text-center">{processingDetails}</p>
                  ) : (
                    <p className="text-center">Fotos de perfil atualizadas com sucesso</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            {completed || loading ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} className="mr-2">
                  Cancelar
                </Button>
                <Button onClick={startFetchingPhotos}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Iniciar busca
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
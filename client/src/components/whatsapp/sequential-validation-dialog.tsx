import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, Wifi } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

// Interface para o status da validação
interface ValidationQueueStatus {
  isProcessing: boolean;
  currentIndex: number;
  totalClients: number;
  completedCount: number;
  successCount: number;
  failureCount: number;
  startTime: string | null;
  endTime: string | null;
  lastUpdated: string | null;
  currentClientId: number | null;
  currentClientName: string | null;
  lastResult: ValidationResult | null;
  percentComplete: number;
  estimatedTimeRemaining: number | null;
  errorMessage: string | null;
  recentResults: ValidationResult[];
}

// Interface para o resultado da validação
interface ValidationResult {
  clienteId: number;
  clienteName: string;
  phoneNumber: string;
  isRegistered: boolean;
  timestamp: string;
  errorMessage?: string;
  formattedNumber?: string;
  jid?: string | null;
}

interface SequentialValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SequentialValidationDialog({ open, onOpenChange }: SequentialValidationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ValidationQueueStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectionRequired, setReconnectionRequired] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Formatar tempo estimado em formato legível
  const formatRemainingTime = (seconds: number | null): string => {
    if (seconds === null) return "Calculando...";
    if (seconds <= 0) return "Concluído";
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  // Verificar conexão da instância (com mecanismo anti-flood)
  const reconnectInstance = async () => {
    // Impedir múltiplas tentativas de reconexão simultâneas
    if (isReconnecting) return;
    
    setIsReconnecting(true);
    setConnectionError(null);
    
    try {
      // Adicionar timestamp para evitar cache de navegador
      const cacheBuster = new Date().getTime();
      
      // Força a verificação do status diretamente com a API
      const response = await fetch(`/api/whatsapp/force-check-status?t=${cacheBuster}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        // Usar uma maior espera para permitir que a API se recupere
        // e evitar que tentativas frequentes sobrecarreguem o servidor
        signal: AbortSignal.timeout(10000) // 10 segundos
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errorMessage || `Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Verificar diversos formatos de status que indicam conexão
      const connectedStates = ["open", "connected", "CONNECTED", "ONLINE", "online", "ready"];
      if (connectedStates.includes(data.status)) {
        setReconnectionRequired(false);
        toast({
          title: "Conexão restaurada",
          description: "A instância do WhatsApp foi reconectada com sucesso.",
        });
        
        // Invalidar consultas de instâncias para atualizar o status
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/instances'] });
        
        // Buscar o status atual da validação após reconexão bem-sucedida
        fetchStatus(true);
      } else {
        setConnectionError("A instância ainda não está conectada. Verifique se o WhatsApp está aberto no dispositivo.");
        setReconnectionRequired(true);
      }
    } catch (error) {
      
      setConnectionError(error instanceof Error ? error.message : "Ocorreu um erro ao tentar reconectar.");
      
      // Se a mensagem de erro contém "não está conectada", manter a flag de reconexão
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("não está conectada") || errorMsg.includes("not connected")) {
        setReconnectionRequired(true);
      }
    } finally {
      setIsReconnecting(false);
    }
  };

  // Iniciar validação sequencial
  const startValidation = async () => {
    setIsStarting(true);
    try {
      const response = await fetch("/api/whatsapp/sequential-validation/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Verificar se o erro está relacionado à conexão da instância
        if (errorData.error === "not_connected" || 
            errorData.errorMessage?.includes("não está conectada") ||
            (errorData.errorMessage && errorData.errorMessage.includes("instância"))) {
          setReconnectionRequired(true);
          setConnectionError(errorData.errorMessage || "A instância do WhatsApp não está conectada.");
          throw new Error(errorData.errorMessage || "A instância do WhatsApp não está conectada.");
        }
        
        throw new Error(errorData.errorMessage || `Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status) {
        setStatus(data.status);
        setReconnectionRequired(false);
        setConnectionError(null);
        
        toast({
          title: "Validação iniciada",
          description: "O processo de validação foi iniciado com sucesso.",
        });
        
        // Iniciar polling para atualizar o status
        startPolling();
      }
    } catch (error) {
      
      
      // Se for erro de conexão, já foi tratado acima
      if (!connectionError) {
        toast({
          title: "Erro ao iniciar validação",
          description: error instanceof Error ? error.message : "Ocorreu um erro ao iniciar a validação.",
          variant: "destructive",
        });
      }
    } finally {
      setIsStarting(false);
    }
  };

  // Parar validação sequencial
  const stopValidation = async () => {
    setIsStopping(true);
    try {
      const response = await fetch("/api/whatsapp/sequential-validation/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status) {
        setStatus(data.status);
        toast({
          title: "Validação interrompida",
          description: "O processo de validação foi interrompido com sucesso.",
        });
      }
    } catch (error) {
      
      toast({
        title: "Erro ao parar validação",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao parar a validação.",
        variant: "destructive",
      });
    } finally {
      setIsStopping(false);
      // Parar polling
      stopPolling();
    }
  };

  // Buscar status atual da validação
  const fetchStatus = async (forceRefresh = false) => {
    try {
      // Adicionar parâmetro force=true apenas quando necessário para evitar cache
      const url = forceRefresh 
        ? "/api/whatsapp/sequential-validation/status?force=true"
        : "/api/whatsapp/sequential-validation/status";
        
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status) {
        setStatus(data.status);
        
        // Se a validação foi concluída ou interrompida, parar o polling
        if (!data.status.isProcessing) {
          stopPolling();
        }
      }
    } catch (error) {
      
      // Não mostrar toast para não poluir a interface
    }
  };

  // Iniciar polling para atualizar o status
  const startPolling = () => {
    // Parar qualquer polling existente primeiro
    stopPolling();
    
    // Iniciar novo polling a cada 3 segundos (aumentado de 2 para 3 segundos)
    // Isso reduz o número de requisições ao servidor em 33%
    const interval = setInterval(fetchStatus, 3000);
    setPollingInterval(interval);
  };

  // Parar polling
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  // Quando o diálogo é aberto, buscar o status atual
  useEffect(() => {
    if (open) {
      // Buscar o status inicial apenas uma vez quando o diálogo é aberto (com refresh forçado)
      fetchStatus(true); // Usar force=true para garantir dados atualizados
      
      // Iniciar polling apenas se um processo já estiver em andamento
      // Isso evita requisições desnecessárias quando nenhuma validação está ocorrendo
      if (status?.isProcessing) {
        startPolling();
      }
    } else {
      stopPolling();
    }
    
    // Cleanup ao desmontar o componente
    return () => {
      stopPolling();
    };
  }, [open]);
  
  // Iniciar/parar polling quando o status de processamento mudar
  useEffect(() => {
    if (open) {
      if (status?.isProcessing) {
        // Se começou a processar, iniciar polling
        startPolling();
      } else {
        // Se parou de processar, parar polling
        stopPolling();
      }
    }
  }, [status?.isProcessing, open]);

  // Renderizar a tabela de resultados recentes
  const renderRecentResults = () => {
    if (!status?.recentResults || status.recentResults.length === 0) {
      return <p className="text-sm text-gray-500">Nenhum resultado disponível</p>;
    }

    return (
      <div className="border rounded-md overflow-hidden h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {status.recentResults.map((result, index) => (
              <tr key={`${result.clienteId}-${index}`}>
                <td className="px-2 py-1 whitespace-nowrap text-sm">
                  {result.clienteName}
                </td>
                <td className="px-2 py-1 whitespace-nowrap text-sm">
                  {result.formattedNumber || result.phoneNumber}
                </td>
                <td className="px-2 py-1 whitespace-nowrap text-center">
                  {result.errorMessage ? (
                    <div className="relative group">
                      <AlertTriangle className="inline h-5 w-5 text-amber-500" />
                      <span className="absolute hidden group-hover:block bg-black text-white text-xs p-1 rounded -mt-1 ml-6 max-w-xs z-10">
                        {result.errorMessage}
                      </span>
                    </div>
                  ) : result.isRegistered ? (
                    <CheckCircle className="inline h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="inline h-5 w-5 text-red-500" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Validação Sequencial de Números</DialogTitle>
          <DialogDescription>
            Validação de números de WhatsApp um cliente por vez, evitando sobrecarga na API.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-3">
          {/* Status atual */}
          {status ? (
            <div className="space-y-4">
              {/* Progresso */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso: {status.completedCount} de {status.totalClients} ({status.percentComplete}%)</span>
                  {status.estimatedTimeRemaining !== null && (
                    <span>Tempo restante: {formatRemainingTime(status.estimatedTimeRemaining)}</span>
                  )}
                </div>
                <Progress value={status.percentComplete} className="h-2" />
              </div>
              
              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-2">
                <div className="border p-2 rounded-md bg-gray-50">
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="text-lg font-semibold">{status.completedCount}</div>
                </div>
                <div className="border p-2 rounded-md bg-green-50">
                  <div className="text-xs text-gray-500">Validados</div>
                  <div className="text-lg font-semibold text-green-600">{status.successCount}</div>
                </div>
                <div className="border p-2 rounded-md bg-red-50">
                  <div className="text-xs text-gray-500">Não Validados</div>
                  <div className="text-lg font-semibold text-red-600">{status.failureCount}</div>
                </div>
              </div>
              
              {/* Cliente atual */}
              {status.isProcessing && status.currentClientName && (
                <div className="border p-3 rounded-md bg-blue-50">
                  <div className="text-xs text-gray-500">Processando:</div>
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="font-medium">
                      {status.currentClientName} (ID: {status.currentClientId})
                    </span>
                  </div>
                </div>
              )}
              
              {/* Último resultado */}
              {status.lastResult && (
                <div className={cn(
                  "border p-3 rounded-md",
                  status.lastResult.isRegistered ? "bg-green-50" : "bg-red-50"
                )}>
                  <div className="text-xs text-gray-500">Último cliente validado:</div>
                  <div className="flex items-center space-x-2">
                    {status.lastResult.isRegistered ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">{status.lastResult.clienteName}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {status.lastResult.formattedNumber || status.lastResult.phoneNumber}
                    {status.lastResult.errorMessage && (
                      <span className="text-red-500 block mt-1">{status.lastResult.errorMessage}</span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Mensagem de erro */}
              {status.errorMessage && (
                <div className="border border-red-200 p-3 rounded-md bg-red-50 text-red-600">
                  <div className="font-medium">Erro:</div>
                  <div>{status.errorMessage}</div>
                </div>
              )}
              
              {/* Resultados recentes */}
              <div>
                <h4 className="text-sm font-medium mb-2">Resultados Recentes</h4>
                {renderRecentResults()}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Carregando status da validação...</p>
            </div>
          )}
        </div>

        {/* Mensagem de erro de conexão */}
        {connectionError && (
          <div className="border border-red-300 bg-red-50 p-4 rounded-md flex flex-col gap-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-800">Problema de conexão</h4>
                <p className="text-sm text-red-700">{connectionError}</p>
              </div>
            </div>
            <Button 
              onClick={reconnectInstance} 
              disabled={isReconnecting}
              variant="outline"
              className="ml-auto bg-white border-red-300 hover:bg-red-50 text-red-700"
            >
              {isReconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reconectando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reconectar Instância
                </>
              )}
            </Button>
          </div>
        )}

        <DialogFooter>
          {!status?.isProcessing ? (
            <Button
              onClick={startValidation}
              disabled={isStarting || isReconnecting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Wifi className="mr-2 h-4 w-4" />
                  Iniciar Validação
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={stopValidation}
              disabled={isStopping}
              variant="destructive"
            >
              {isStopping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parando...
                </>
              ) : (
                "Parar Validação"
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
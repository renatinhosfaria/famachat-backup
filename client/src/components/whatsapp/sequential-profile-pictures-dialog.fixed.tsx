import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { User, CheckCircle2, Loader2, AlertTriangle, StopCircle, Clock, RefreshCw } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow, formatDuration, intervalToDuration } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SequentialProfilePicturesDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ProfilePicStatus {
  operation: string;
  isRunning: boolean;
  isFinished: boolean;
  clientsProcessed: number;
  clientsTotal: number;
  updatedPhotos: number;
  startTime: string;
  endTime: string | null;
  elapsedTimeInSeconds: number;
  error?: string;
}

export function SequentialProfilePicturesDialog({
  open,
  onOpenChange
}: SequentialProfilePicturesDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const actualOpen = open !== undefined ? open : dialogOpen;
  const actualOnOpenChange = onOpenChange || setDialogOpen;
  
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [processingDetails, setProcessingDetails] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [statusData, setStatusData] = useState<ProfilePicStatus | null>(null);
  
  // Referência para o intervalo de verificação de status
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  
  // Função para atualizar os logs
  const updateLogs = useCallback((data: any[]) => {
    // Já estamos recebendo apenas logs relacionados a fotos de perfil do endpoint específico
    const profilePicLogs = data
      .map((log: any) => log.message)
      .reverse()
      .slice(0, 50);
    
    setLogs(profilePicLogs);
  }, []);
  
  // Consulta para buscar logs específicos de fotos de perfil
  const {
    data: whatsappLogs = [],
    refetch: refetchLogs
  } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/logs/profile-pics"],
    refetchInterval: loading ? 2000 : false,
    enabled: loading
  });
  
  // Efeito para atualizar logs quando os dados mudam
  useEffect(() => {
    if (whatsappLogs && whatsappLogs.length > 0) {
      updateLogs(whatsappLogs);
    }
  }, [whatsappLogs, updateLogs]);
  
  // Limpar intervalo quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, []);
  
  // Função para verificar o status do processo
  const checkStatus = async () => {
    try {
      const response = await apiRequest({
        url: "/api/whatsapp/sequential-profile-pictures/status",
        method: "GET"
      });
      
      const data = response as ProfilePicStatus;
      setStatusData(data);
      
      // Calcular progresso
      const progress = data.clientsTotal > 0 
        ? Math.round((data.clientsProcessed / data.clientsTotal) * 100) 
        : 0;
      
      // Formatar mensagem de status
      let statusMsg = "";
      if (data.isRunning) {
        statusMsg = `Processando ${data.clientsProcessed} de ${data.clientsTotal} clientes (${progress}%)`;
      } else if (data.isFinished) {
        statusMsg = `Processamento concluído! ${data.updatedPhotos} fotos atualizadas de ${data.clientsTotal} clientes`;
        setCompleted(true);
        setLoading(false);
        
        // Limpar o intervalo quando concluído
        if (statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current);
          statusCheckIntervalRef.current = null;
        }
        
        toast({
          title: "Busca de fotos concluída",
          description: `${data.updatedPhotos} fotos de perfil atualizadas com sucesso`,
        });
      }
      
      setStatusMessage(statusMsg);
      
      // Formatar detalhes adicionais
      let details = "";
      if (data.startTime) {
        const startDate = new Date(data.startTime);
        const timeAgo = formatDistanceToNow(startDate, { addSuffix: true, locale: ptBR });
        
        details += `Início: ${timeAgo}\n`;
        
        if (data.elapsedTimeInSeconds > 0) {
          // Formatar duração
          const duration = intervalToDuration({ start: 0, end: data.elapsedTimeInSeconds * 1000 });
          const formattedDuration = formatDuration(duration, { locale: ptBR });
          
          details += `Tempo decorrido: ${formattedDuration}\n`;
        }
        
        // Estimar tempo restante
        if (data.isRunning && data.clientsProcessed > 0 && data.clientsTotal > 0) {
          const percentComplete = data.clientsProcessed / data.clientsTotal;
          if (percentComplete > 0) {
            const estimatedTotalSeconds = data.elapsedTimeInSeconds / percentComplete;
            const remainingSeconds = estimatedTotalSeconds - data.elapsedTimeInSeconds;
            
            if (remainingSeconds > 0) {
              const remainingDuration = intervalToDuration({ start: 0, end: remainingSeconds * 1000 });
              const formattedRemaining = formatDuration(remainingDuration, { locale: ptBR });
              
              details += `Tempo restante estimado: ${formattedRemaining}\n`;
            }
          }
        }
        
        details += `\nFotos atualizadas: ${data.updatedPhotos} de ${data.clientsProcessed} processados`;
      }
      
      setProcessingDetails(details);
      
      // Se houver erro, mostrar alerta
      if (data.error) {
        toast({
          title: "Erro no processamento",
          description: data.error,
          variant: "destructive",
        });
        
        setLoading(false);
        if (statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current);
          statusCheckIntervalRef.current = null;
        }
      }
      
    } catch (error: any) {
      
      setStatusMessage("Erro ao verificar status do processamento");
      
      // Em caso de erro persistente, parar de verificar
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
      
      setLoading(false);
    }
  };
  
  // Mutation para iniciar o processo
  const startProcessMutation = useMutation({
    mutationFn: async () => {
      // Limpar intervalo existente para garantir que não haja duplicação
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
      
      // Limpar logs locais para novos resultados
      setLogs([]);
      
      // Chamar API para iniciar processo
      return await apiRequest({
        url: "/api/whatsapp/sequential-profile-pictures/start",
        method: "POST"
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Processo iniciado",
        description: "A busca sequencial de fotos de perfil foi iniciada com sucesso",
      });
      
      // Executar imediatamente e depois a cada 3 segundos
      checkStatus();
      statusCheckIntervalRef.current = setInterval(checkStatus, 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao iniciar processo",
        description: error.message || "Não foi possível iniciar a busca de fotos de perfil",
        variant: "destructive",
      });
      setLoading(false);
    }
  });
  
  // Mutation para parar o processo
  const stopProcessMutation = useMutation({
    mutationFn: () => apiRequest({
      url: "/api/whatsapp/sequential-profile-pictures/stop",
      method: "POST"
    }),
    onSuccess: (data) => {
      toast({
        title: "Processo interrompido",
        description: "A busca de fotos de perfil foi interrompida com sucesso",
      });
      
      setLoading(false);
      
      // Atualizar status uma última vez
      checkStatus();
      
      // Limpar o intervalo
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao interromper processo",
        description: error.message || "Não foi possível interromper a busca de fotos de perfil",
        variant: "destructive",
      });
    }
  });
  
  // Iniciar o processo de busca sequencial
  const startProcess = async () => {
    // Se já houver um processo em andamento, primeiro interrompê-lo
    if (loading) {
      try {
        // Mostrar estado intermediário
        setStatusMessage("Interrompendo o processo atual...");
        
        // Primeiro interromper o processo atual
        await stopProcessMutation.mutateAsync();
        
        // Aguardar um momento para garantir que o processo foi encerrado
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Verificar novamente o status para ter certeza
        await checkStatus();
        
        // Outro breve intervalo antes de iniciar o novo processo
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        
        // Continuar mesmo se houver erro ao parar o processo atual
      }
    }
    
    // Iniciar um novo processo
    setLoading(true);
    setCompleted(false);
    setStatusMessage("Iniciando processo...");
    setProcessingDetails("");
    
    startProcessMutation.mutate();
  };
  
  // Interromper o processo
  const stopProcess = async () => {
    stopProcessMutation.mutate();
  };
  
  // Verificar status inicial ao abrir o diálogo
  useEffect(() => {
    if (actualOpen) {
      checkStatus();
    }
  }, [actualOpen]);
  
  // Renderizar progresso
  const renderProgress = () => {
    if (!statusMessage) return null;
    
    const isError = statusMessage.toLowerCase().includes("erro");
    
    return (
      <div className="space-y-4 mt-4">
        {isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{statusMessage}</span>
              {loading && (
                <Badge variant="outline" className="bg-blue-50">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Em andamento
                </Badge>
              )}
              {completed && (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Concluído
                </Badge>
              )}
            </div>
            
            <Progress value={loading ? undefined : 100} className={loading ? "animate-pulse" : ""} />
            
            {processingDetails && (
              <div className="mt-4 text-sm text-gray-600 whitespace-pre-line">
                {processingDetails}
              </div>
            )}
            
            {/* Relatório detalhado semelhante à página de validação sequencial */}
            {(loading || completed) && statusData && (
              <div className="mt-8">
                <h3 className="font-semibold text-base mb-4">Relatório Detalhado</h3>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm font-medium text-gray-500">Total</div>
                      <div className="text-2xl font-bold">
                        {statusData.clientsProcessed}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-green-50">
                    <CardContent className="pt-4">
                      <div className="text-sm font-medium text-green-700">Atualizadas</div>
                      <div className="text-2xl font-bold text-green-700">
                        {statusData.updatedPhotos}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-orange-50">
                    <CardContent className="pt-4">
                      <div className="text-sm font-medium text-orange-700">Não Encontradas</div>
                      <div className="text-2xl font-bold text-orange-700">
                        {statusData.clientsProcessed - statusData.updatedPhotos}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Cliente em processamento */}
                {loading && (
                  <Card className="bg-blue-50 mb-4">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center">
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin text-blue-600" />
                        <div>
                          <div className="text-sm font-medium text-blue-700">Processando:</div>
                          <div className="text-base font-medium">
                            {(() => {
                              const currentLog = whatsappLogs?.find(log => 
                                log.message?.includes("Buscando foto"));
                              if (currentLog?.message) {
                                const match = currentLog.message.match(/cliente (\d+)(?:\s+\((.*?)\))?/);
                                if (match) {
                                  return match[2] || `Cliente ${match[1]}`;
                                }
                                return currentLog.message.replace("Buscando foto de perfil para cliente ", "");
                              }
                              return "Aguardando...";
                            })()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Último cliente processado com sucesso */}
                {whatsappLogs?.some(log => log.message?.includes("Foto de perfil atualizada")) && (
                  <Card className="bg-green-50 mb-4">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center">
                        <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                        <div>
                          <div className="text-sm font-medium text-green-700">Última foto atualizada:</div>
                          <div className="text-base font-medium">
                            {(() => {
                              const successLog = whatsappLogs?.find(log => 
                                log.message?.includes("Foto de perfil atualizada"));
                              if (successLog?.message) {
                                const match = successLog.message.match(/cliente (\d+)(?:\s+\((.*?)\))?/);
                                if (match) {
                                  return match[2] || `Cliente ${match[1]}`;
                                }
                                return successLog.message.replace("Foto de perfil atualizada para cliente ", "");
                              }
                              return "";
                            })()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Tabela de resultados recentes */}
                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-2">Resultados Recentes</h4>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CLIENTE</TableHead>
                          <TableHead>TELEFONE</TableHead>
                          <TableHead className="text-right">FOTO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {whatsappLogs
                          ?.filter(log => 
                            log.message?.includes("Foto de perfil atualizada") || 
                            log.message?.includes("número não existe") ||
                            log.message?.includes("mas sem foto"))
                          .slice(0, 5)
                          .map((log, index) => {
                            const isSuccess = log.message?.includes("Foto de perfil atualizada");
                            let name = "";
                            const msg = log.message || "";
                            
                            if (isSuccess) {
                              name = msg.replace("Foto de perfil atualizada para cliente ", "");
                            } else if (msg.includes("número não existe")) {
                              name = msg.replace("O número não existe no WhatsApp: ", "");
                            } else if (msg.includes("mas sem foto")) {
                              name = msg.replace("Número existe no WhatsApp, mas sem foto de perfil para cliente ", "");
                            }
                            
                            // Extrair o nome e o telefone dos logs
                            const clientMatch = msg.match(/cliente (\d+)(?:\s+\((.*?)\))?/);
                            if (clientMatch) {
                              const clientId = clientMatch[1];
                              const clientName = clientMatch[2] || `Cliente ${clientId}`;
                              name = clientName;
                            }
                            
                            // Extrair telefone do log com formato de número
                            const phoneMatch = msg.match(/número (\d+)/) || msg.match(/com número (\d+)/);
                            const phone = phoneMatch ? phoneMatch[1] : ""; 
                            
                            return (
                              <TableRow key={index}>
                                <TableCell>{name}</TableCell>
                                <TableCell>{phone}</TableCell>
                                <TableCell className="text-right">
                                  {isSuccess ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />
                                  ) : (
                                    <AlertTriangle className="h-5 w-5 text-orange-500 ml-auto" />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };
  
  return (
    <Dialog open={actualOpen} onOpenChange={actualOnOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <User className="mr-2 h-4 w-4" />
          Buscar Fotos Sequencial
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Busca Sequencial de Fotos de Perfil</DialogTitle>
          <DialogDescription>
            Busca e atualiza as fotos de perfil do WhatsApp para todos os clientes sem exceção, um de cada vez.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-start space-x-2 py-4">

        </div>
        
        {renderProgress()}
        
        <DialogFooter className="flex justify-between">
          <div>
            {loading && (
              <Button 
                variant="destructive" 
                onClick={stopProcess} 
                disabled={stopProcessMutation.isPending || !loading}
              >
                {stopProcessMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <StopCircle className="mr-2 h-4 w-4" />
                )}
                Interromper
              </Button>
            )}
          </div>
          <div>
            <Button 
              variant="outline" 
              onClick={() => actualOnOpenChange(false)}
              className="mr-2"
            >
              Fechar
            </Button>
            
            <Button 
              onClick={startProcess} 
              disabled={startProcessMutation.isPending}
            >
              {startProcessMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando...
                </>
              ) : loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reiniciar Processo
                </>
              ) : completed ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Iniciar Novamente
                </>
              ) : (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Iniciar Processo
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
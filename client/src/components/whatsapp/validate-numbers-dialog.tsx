import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FaWhatsapp } from "react-icons/fa";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, RefreshCw, CheckCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ValidateNumbersDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  expanded?: boolean;
}

interface ValidationResult {
  message: string;
  totalClientes: number;
  clientesComTelefone: number;
  clientesProcessados: number;
  clientesNoWhatsApp: number;
  percentualWhatsApp: number;
  instancia: string;
  results: {
    number: string;
    isRegistered: boolean;
    status: string;
    formattedNumber?: string;
    clienteId: number;
    clienteName: string;
    originalNumber: string;
  }[];
}

export function ValidateNumbersDialog({ trigger, onSuccess, expanded }: ValidateNumbersDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [selectedTab, setSelectedTab] = useState<"all" | "valid" | "invalid">("all");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [checkStatus, setCheckStatus] = useState<{
    currentBatch: number;
    totalBatches: number;
    isFinished: boolean;
  }>({
    currentBatch: 0,
    totalBatches: 0,
    isFinished: false
  });

  // Mutação para iniciar a validação de números
  const validateMutation = useMutation({
    mutationFn: async () => {
      setIsBusy(true);
      // Sempre usar validação completa (fullMode=true)
      const url = `/api/whatsapp/check-numbers?full=true&_timestamp=${Date.now()}`;
      const response = await apiRequest({
        url,
        method: "GET",
      });
      
      // Garantir que o objeto tem a estrutura esperada
      if (response && 
          typeof response === 'object' && 
          'clientesProcessados' in response && 
          'clientesNoWhatsApp' in response &&
          'results' in response) {
        const validatedResponse = response as unknown as ValidationResult;
        setValidationResults(validatedResponse);
        return validatedResponse;
      } else {
        throw new Error("Resposta inválida da API");
      }
    },
    onSuccess: (data: ValidationResult) => {
      toast({
        title: "Verificação concluída com sucesso",
        description: `${data.clientesNoWhatsApp} de ${data.clientesProcessados} clientes possuem WhatsApp (${data.percentualWhatsApp}%)`,
      });
      
      // Invalidar consultas relacionadas a clientes para atualizar o status do WhatsApp
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      
      if (onSuccess) {
        onSuccess();
      }
      
      setIsBusy(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro na verificação",
        description: `Não foi possível validar os números: ${error}`,
      });
      setIsBusy(false);
    },
  });

  // Verificar o status da verificação a cada 2 segundos quando estiver em andamento
  // Definindo o tipo da resposta da API
  interface BatchResponse {
    batchInfo: {
      currentBatch: number;
      totalBatches: number;
      isFinished: boolean;
      isRunning: boolean;
      startedAt: string;
      completedAt: string | null;
    }
  }
  
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (isBusy) {
      // Iniciar verificação de status
      intervalId = setInterval(async () => {
        try {
          const response = await apiRequest({
            url: `/api/whatsapp/check-status/5?_timestamp=${Date.now()}`,
            method: "GET"
          }) as unknown as BatchResponse;
          
          if (response && response.batchInfo) {
            const { currentBatch, totalBatches, isFinished } = response.batchInfo;
            
            setCheckStatus({
              currentBatch,
              totalBatches,
              isFinished
            });
            
            // Calcular o progresso (%)
            if (totalBatches > 0) {
              const progress = Math.round((currentBatch / totalBatches) * 100);
              setProcessingProgress(progress);
            }
            
            // Se terminou, limpar o intervalo
            if (isFinished) {
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
            }
          }
        } catch (error) {
          
        }
      }, 2000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isBusy]);

  const handleStartValidation = () => {
    // Resetar status
    setCheckStatus({
      currentBatch: 0,
      totalBatches: 0,
      isFinished: false
    });
    setProcessingProgress(0);
    
    validateMutation.mutate();
  };

  const handleClose = () => {
    setOpen(false);
    setValidationResults(null);
    setCheckStatus({
      currentBatch: 0,
      totalBatches: 0,
      isFinished: false
    });
    setProcessingProgress(0);
  };

  // Filtrar resultados com base na guia selecionada
  const filteredResults = validationResults?.results?.filter(result => {
    if (selectedTab === "valid") return result.isRegistered;
    if (selectedTab === "invalid") return !result.isRegistered;
    return true;
  }) || [];

  const getStatusColor = (isRegistered: boolean) => {
    return isRegistered ? "bg-green-500" : "bg-red-500";
  };

  // Se estivermos no modo expandido, renderizar apenas o conteúdo
  if (expanded) {
    return (
      <div className="flex flex-col w-full">
        <div className="py-6 space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Esta ferramenta irá verificar quais dos seus clientes possuem uma conta ativa no WhatsApp.
            A validação pode demorar alguns minutos, dependendo da quantidade de clientes.
          </p>
          
          {isBusy && (
            <div className="mb-6">
              <Alert className="mb-4">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                <AlertTitle>Validação em andamento</AlertTitle>
                <AlertDescription>
                  {checkStatus.totalBatches > 0 ? (
                    <div className="mt-2">
                      <p className="text-sm mb-2">
                        Processando lote {checkStatus.currentBatch} de {checkStatus.totalBatches}
                      </p>
                      <Progress value={processingProgress} className="h-2 mb-1" />
                      <p className="text-xs text-right text-muted-foreground">{processingProgress}% concluído</p>
                    </div>
                  ) : (
                    <p className="text-sm mt-2">Iniciando validação dos números...</p>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {checkStatus.isFinished && !validationResults && (
            <div className="mb-6">
              <Alert className="mb-4">
                <CheckCheck className="h-4 w-4 text-green-500 mr-2" />
                <AlertTitle>Validação concluída!</AlertTitle>
                <AlertDescription>
                  <p className="text-sm mt-2">Todos os números foram verificados com sucesso. Os resultados estarão disponíveis em instantes.</p>
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {!validationResults ? (
            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Badge variant="destructive">Validação Completa</Badge>
                    <p className="text-sm text-center text-muted-foreground">
                      Verifica todos os clientes cadastrados. Pode levar alguns minutos.
                    </p>
                    <Button 
                      variant="destructive"
                      onClick={() => handleStartValidation()} 
                      disabled={isBusy || validateMutation.isPending}
                      className="w-full md:w-auto"
                    >
                      {(isBusy || validateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Validação Completa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">Total de Clientes</p>
                  <p className="text-xl font-bold">{validationResults.totalClientes}</p>
                </div>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">Com Telefone</p>
                  <p className="text-xl font-bold">{validationResults.clientesComTelefone}</p>
                </div>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">Com WhatsApp</p>
                  <p className="text-xl font-bold">{validationResults.clientesNoWhatsApp}</p>
                </div>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">Percentual</p>
                  <p className="text-xl font-bold">{validationResults.percentualWhatsApp}%</p>
                </div>
              </div>
              
              <div className="relative pt-2">
                <div className="mb-1 flex justify-between text-xs">
                  <span>Percentual de clientes com WhatsApp</span>
                  <span>{validationResults.percentualWhatsApp}%</span>
                </div>
                <Progress value={validationResults.percentualWhatsApp} className="h-3" />
              </div>
              
              <Tabs defaultValue="all" value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">
                    Todos ({filteredResults.length})
                  </TabsTrigger>
                  <TabsTrigger value="valid">
                    <FaWhatsapp className="h-4 w-4 mr-1 text-green-600" />
                    Válidos ({validationResults.results?.filter(r => r.isRegistered)?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="invalid">
                    <XCircle className="h-4 w-4 mr-1" />
                    Inválidos ({validationResults.results?.filter(r => !r.isRegistered)?.length || 0})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="pt-2">
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {filteredResults.map((result) => (
                        <div 
                          key={result.clienteId} 
                          className="border rounded-md p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium">{result.clienteName}</p>
                            <p className="text-sm text-muted-foreground">{result.originalNumber}</p>
                          </div>
                          <Badge className={`${getStatusColor(result.isRegistered)} text-white`}>
                            {result.isRegistered ? 'WhatsApp' : 'Sem WhatsApp'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="valid" className="pt-2">
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {filteredResults.map((result) => (
                        <div 
                          key={result.clienteId} 
                          className="border rounded-md p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium">{result.clienteName}</p>
                            <p className="text-sm text-muted-foreground">{result.originalNumber}</p>
                          </div>
                          <Badge className="bg-green-500 text-white">
                            WhatsApp
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="invalid" className="pt-2">
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {filteredResults.map((result) => (
                        <div 
                          key={result.clienteId} 
                          className="border rounded-md p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium">{result.clienteName}</p>
                            <p className="text-sm text-muted-foreground">{result.originalNumber}</p>
                          </div>
                          <Badge className="bg-red-500 text-white">
                            Sem WhatsApp
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setValidationResults(null);
                  }}
                >
                  Voltar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Renderização normal em diálogo
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline">
            <FaWhatsapp className="mr-2 h-4 w-4 text-green-600" />
            Validar Números WhatsApp
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Validação de Números WhatsApp</DialogTitle>
          <DialogDescription>
            Verifique quais clientes possuem conta ativa no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {!validationResults ? (
          <div className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Esta ferramenta irá verificar quais dos seus clientes possuem uma conta ativa no WhatsApp.
              A validação pode demorar alguns minutos, dependendo da quantidade de clientes.
            </p>
            
            {isBusy && (
              <div className="mb-6">
                <Alert className="mb-4">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  <AlertTitle>Validação em andamento</AlertTitle>
                  <AlertDescription>
                    {checkStatus.totalBatches > 0 ? (
                      <div className="mt-2">
                        <p className="text-sm mb-2">
                          Processando lote {checkStatus.currentBatch} de {checkStatus.totalBatches}
                        </p>
                        <Progress value={processingProgress} className="h-2 mb-1" />
                        <p className="text-xs text-right text-muted-foreground">{processingProgress}% concluído</p>
                      </div>
                    ) : (
                      <p className="text-sm mt-2">Iniciando validação dos números...</p>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            
            {checkStatus.isFinished && !validationResults && (
              <div className="mb-6">
                <Alert className="mb-4">
                  <CheckCheck className="h-4 w-4 text-green-500 mr-2" />
                  <AlertTitle>Validação concluída!</AlertTitle>
                  <AlertDescription>
                    <p className="text-sm mt-2">Todos os números foram verificados com sucesso. Os resultados estarão disponíveis em instantes.</p>
                  </AlertDescription>
                </Alert>
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Badge variant="destructive">Validação Completa</Badge>
                    <p className="text-sm text-center text-muted-foreground">
                      Verifica todos os clientes cadastrados. Pode levar alguns minutos.
                    </p>
                    <Button 
                      variant="destructive"
                      onClick={() => handleStartValidation()} 
                      disabled={isBusy || validateMutation.isPending}
                      className="w-full md:w-auto"
                    >
                      {(isBusy || validateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Validação Completa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-xs text-muted-foreground">Total de Clientes</p>
                <p className="text-xl font-bold">{validationResults.totalClientes}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-xs text-muted-foreground">Com Telefone</p>
                <p className="text-xl font-bold">{validationResults.clientesComTelefone}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-xs text-muted-foreground">Com WhatsApp</p>
                <p className="text-xl font-bold">{validationResults.clientesNoWhatsApp}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-xs text-muted-foreground">Percentual</p>
                <p className="text-xl font-bold">{validationResults.percentualWhatsApp}%</p>
              </div>
            </div>
            
            <div className="relative pt-2">
              <div className="mb-1 flex justify-between text-xs">
                <span>Percentual de clientes com WhatsApp</span>
                <span>{validationResults.percentualWhatsApp}%</span>
              </div>
              <Progress value={validationResults.percentualWhatsApp} className="h-3" />
            </div>
            
            <Tabs defaultValue="all" value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">
                  Todos ({filteredResults.length})
                </TabsTrigger>
                <TabsTrigger value="valid">
                  <FaWhatsapp className="h-4 w-4 mr-1 text-green-600" />
                  Válidos ({validationResults.results?.filter(r => r.isRegistered)?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="invalid">
                  <XCircle className="h-4 w-4 mr-1" />
                  Inválidos ({validationResults.results?.filter(r => !r.isRegistered)?.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="pt-2">
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {filteredResults.map((result) => (
                      <div 
                        key={result.clienteId} 
                        className="border rounded-md p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{result.clienteName}</p>
                          <p className="text-sm text-muted-foreground">{result.originalNumber}</p>
                        </div>
                        <Badge variant={result.isRegistered ? "default" : "destructive"}>
                          {result.isRegistered ? (
                            <><FaWhatsapp className="mr-1 h-3 w-3" /> WhatsApp Ativo</>
                          ) : (
                            "Sem WhatsApp"
                          )}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="valid" className="pt-2">
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {filteredResults.map((result) => (
                      <div 
                        key={result.clienteId} 
                        className="border rounded-md p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{result.clienteName}</p>
                          <p className="text-sm text-muted-foreground">{result.originalNumber}</p>
                        </div>
                        <Badge>
                          <FaWhatsapp className="mr-1 h-3 w-3" /> WhatsApp Ativo
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="invalid" className="pt-2">
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {filteredResults.map((result) => (
                      <div 
                        key={result.clienteId} 
                        className="border rounded-md p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{result.clienteName}</p>
                          <p className="text-sm text-muted-foreground">{result.originalNumber}</p>
                        </div>
                        <Badge variant="destructive">Sem WhatsApp</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}

        <DialogFooter>
          {validationResults ? (
            <div className="flex w-full justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setValidationResults(null);
                }}
              >
                Voltar
              </Button>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          ) : (
            <Button onClick={handleClose} variant="outline">
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
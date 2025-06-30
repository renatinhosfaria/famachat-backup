import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { X, Filter, Settings, Check, Clock, AlertTriangle, RefreshCw } from "lucide-react";


import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

import { formatTimeAgo, formatDate } from "@/lib/utils";
import { Lead, User, Cliente, leadAutomationConfig as DBLeadAutomationConfig, ClienteStatus, SistemaConfigAutomacaoLeads, SistemaLeadsCascata } from "@shared/schema";

// Usando o mesmo tipo de status que os clientes
type LeadStatus = 
  | "Sem Atendimento"
  | "Não Respondeu"
  | "Em Atendimento"
  | "Agendamento"
  | "Visita"
  | "Venda";

type LeadDistributionMethod = 
  | "volume" 
  | "performance" 
  | "round-robin";

type LeadSource = 
  | "Facebook Ads"
  | "Site"
  | "Instagram"
  | "Indicação"
  | "Google Ads";

type LeadWithExtras = Lead & {
  timeInStage: string;
  lastInteraction: string;
  isRecurring: boolean;
  // Informações de cascata
  cascadeInfo?: {
    sequencia: number;
    originalLeadId: number;
    totalUsuariosAtivos: number;
    isOriginal: boolean;
    expiraEm?: string;
  };
};

// Interface para a resposta da API de automação
type AutomationConfigResponse = {
  id: number;
  name: string;
  active: boolean;
  distributionMethod: LeadDistributionMethod;
  byName: boolean;
  byPhone: boolean;
  byEmail: boolean;
  keepSameConsultant: boolean;
  assignNewConsultant: boolean;
  firstContactSLA: number;
  warningPercentage: number;
  criticalPercentage: number;
  autoRedistribute: boolean;
  rotationUsers: number[];
  createdAt: string;
  updatedAt: string;
};

// Definir o tipo correto para o estado local de automação
type AutomationConfig = {
  distribution: {
    method: string;
  };
  cascade: {
    slaHours: number;
    userOrder: number[];
  };
  selectedUsers: number[];
};

// Componente para exibir o tempo na etapa com cores adequadas
const TimeInStage: React.FC<{ time: string; timeLimit: number }> = ({ time, timeLimit }) => {
  const [hours, setHours] = useState<number>(0);
  
  useEffect(() => {
    // Transformar o tempo em horas para comparação
    const timeRegex = /(\d+)h/;
    if (typeof time === "string") {
      const match = time.match(timeRegex);
      if (match && match[1]) {
        setHours(parseInt(match[1]));
      }
    } else {
      setHours(0); // valor padrão caso time não seja string
    }
  }, [time]);

  const getStatusColor = () => {
    if (hours >= timeLimit * 0.9) return "text-red-500 font-bold";
    if (hours >= timeLimit * 0.75) return "text-amber-500 font-bold";
    return "text-green-500";
  };

  return (
    <span className={getStatusColor()}>
      {time}
      {hours >= timeLimit * 0.75 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-1 inline-block">
                {hours >= timeLimit * 0.9 ? (
                  <AlertTriangle className="h-4 w-4 inline" />
                ) : (
                  <Clock className="h-4 w-4 inline" />
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {hours >= timeLimit * 0.9
                  ? "Tempo crítico excedido"
                  : "Aproximando do tempo limite"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );
};

// Badge para fonte do lead
const SourceBadge: React.FC<{ source: LeadSource }> = ({ source }) => {
  const getSourceColor = () => {
    switch (source) {
      case "Facebook Ads":
        return "bg-blue-100 text-blue-800";
      case "Site":
        return "bg-purple-100 text-purple-800";
      case "Google Ads":
        return "bg-green-100 text-green-800";
      case "Instagram":
        return "bg-pink-100 text-pink-800";
      case "Indicação":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Badge variant="outline" className={`${getSourceColor()} font-medium`}>
      {source}
    </Badge>
  );
};

// Badge para status do lead
const StatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => {
  // Garantir que o status seja exatamente o que vem do banco
  const finalStatus = status || "Sem Atendimento";
  console.log(`Renderizando status badge para: "${finalStatus}"`);
  
  const getStatusColor = () => {
    switch (finalStatus) {
      case "Sem Atendimento":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Não Respondeu":
        return "bg-red-100 text-red-800 border-red-300";
      case "Em Atendimento":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "Agendamento":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Visita":
        return "bg-teal-100 text-teal-800 border-teal-300";
      case "Venda":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        console.warn(`Status desconhecido: "${finalStatus}"`);
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <Badge variant="outline" className={`${getStatusColor()} font-medium border`}>
      {finalStatus}
    </Badge>
  );
};

// Badge para informações de cascata
const CascadeBadge: React.FC<{ cascadeInfo: LeadWithExtras['cascadeInfo'] }> = ({ cascadeInfo }) => {
  if (!cascadeInfo) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="bg-purple-100 text-purple-800 border-purple-300 font-medium text-xs"
          >
            {cascadeInfo.isOriginal ? 'Original' : `Cópia ${cascadeInfo.sequencia}`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p><strong>Sequência:</strong> {cascadeInfo.sequencia}</p>
            <p><strong>Total de usuários atendendo:</strong> {cascadeInfo.totalUsuariosAtivos}</p>
            {cascadeInfo.expiraEm && (
              <p><strong>SLA expira em:</strong> {formatDate(cascadeInfo.expiraEm)}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Componente de configuração de automação
const AutomationConfigDialog: React.FC<{
  config: AutomationConfig;
  onSave: (config: AutomationConfig) => void;
  users: any[];
}> = ({ config, onSave, users }) => {
  const [localConfig, setLocalConfig] = useState<AutomationConfig>({ ...config });
  const [open, setOpen] = useState(false);

  // Atualiza o localConfig sempre que o config da prop mudar
  useEffect(() => {
    setLocalConfig({ ...config });
  }, [config]);

  const handleSave = () => {
    onSave(localConfig);
    setOpen(false); // Fecha o diálogo após salvar
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Settings className="mr-2 h-4 w-4" />
          Configurações de Automação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configurações de Automação de Leads</DialogTitle>
          <DialogDescription>
            Configure as regras de automação para distribuição e gerenciamento de leads.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="users" className="h-full flex flex-col">
            <TabsList className="w-full flex-shrink-0">
              <TabsTrigger value="users" className="relative">
                Usuários
                {localConfig.selectedUsers && localConfig.selectedUsers.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 text-xs">
                    {localConfig.selectedUsers.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="distribution">Distribuição</TabsTrigger>
              <TabsTrigger value="sla">Tempo para Atendimento</TabsTrigger>
            </TabsList>

            {/* Usuários */}
            <TabsContent value="users" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4 pb-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Selecione os usuários que participarão das regras de automação de leads</h3>
                    <p className="text-sm text-muted-foreground">
                      Escolha os consultores que receberão leads automaticamente do sistema.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {users && users.length > 0 ? (
                      [...users] // Cria uma cópia do array
                        .sort((a, b) => {
                          // Consultor de Atendimento primeiro, depois Corretor
                          if (a.role === b.role) return a.username.localeCompare(b.username);
                          if (a.role === 'Consultor de Atendimento') return -1;
                          if (b.role === 'Consultor de Atendimento') return 1;
                          return a.username.localeCompare(b.username);
                        })
                        .map((user: any) => {
                          const isSelected = localConfig.selectedUsers?.includes(user.id) || false;
                          return (
                            <div 
                              key={user.id} 
                              className={`flex items-center space-x-2 p-3 border rounded-md transition-all duration-200 ${
                                isSelected 
                                  ? 'border-blue-300 bg-blue-50 shadow-sm' 
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <Checkbox
                                id={`user-automation-${user.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  let updated = localConfig.selectedUsers ? [...localConfig.selectedUsers] : [];
                                  if (checked) {
                                    if (!updated.includes(user.id)) updated.push(user.id);
                                  } else {
                                    updated = updated.filter((id) => id !== user.id);
                                  }
                                  
                                  setLocalConfig({
                                    ...localConfig,
                                    selectedUsers: updated,
                                  });
                                }}
                              />
                              <label 
                                htmlFor={`user-automation-${user.id}`} 
                                className="text-sm font-medium leading-none cursor-pointer flex-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className={isSelected ? 'text-blue-700' : 'text-gray-900'}>
                                    {user.username}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    isSelected 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {user.role}
                                  </span>
                                </div>
                              </label>
                            </div>
                          );
                        })
                    ) : (
                      <div className="col-span-2 text-center p-4 border rounded-md">
                        Nenhum usuário disponível para seleção
                      </div>
                    )}
                  </div>

                  {/* Mensagem quando nenhum usuário está selecionado */}
                  {(!localConfig.selectedUsers || localConfig.selectedUsers.length === 0) && (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">!</span>
                      </div>
                      <div className="text-sm text-amber-700">
                        <strong>Nenhum usuário selecionado.</strong> Selecione pelo menos um usuário para ativar a automação de leads.
                      </div>
                    </div>
                  )}

                  {/* Ordem da Fila de Usuários Selecionados */}
                  {localConfig.selectedUsers && localConfig.selectedUsers.length > 0 && (
                    <div className="space-y-4 mt-6">
                      <Separator />
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">Ordem da Fila de Usuários</h3>
                        <Badge variant="secondary" className="text-xs">
                          {localConfig.selectedUsers.length} selecionado{localConfig.selectedUsers.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Defina a ordem em que os leads serão distribuídos entre os usuários selecionados.
                      </p>
                      
                      <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-white">
                        {localConfig.selectedUsers.map((userId, index) => {
                          const user = users.find(u => u.id === userId);
                          if (!user) return null;
                          
                          return (
                            <div key={userId} className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-blue-50 to-white hover:from-blue-100 hover:to-blue-50 transition-all duration-200">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full text-sm font-bold">
                                  {index + 1}
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-900">{user.username}</span>
                                  <span className="text-xs text-gray-500 ml-2 px-2 py-1 bg-gray-100 rounded">
                                    {user.role}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={index === 0}
                                  onClick={() => {
                                    const newOrder = [...localConfig.selectedUsers];
                                    [newOrder[index], newOrder[index - 1]] = 
                                    [newOrder[index - 1], newOrder[index]];
                                    setLocalConfig({
                                      ...localConfig,
                                      selectedUsers: newOrder,
                                    });
                                  }}
                                  className="h-8 w-8 p-0 hover:bg-blue-50"
                                >
                                  ↑
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={index === localConfig.selectedUsers.length - 1}
                                  onClick={() => {
                                    const newOrder = [...localConfig.selectedUsers];
                                    [newOrder[index], newOrder[index + 1]] = 
                                    [newOrder[index + 1], newOrder[index]];
                                    setLocalConfig({
                                      ...localConfig,
                                      selectedUsers: newOrder,
                                    });
                                  }}
                                  className="h-8 w-8 p-0 hover:bg-blue-50"
                                >
                                  ↓
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs">i</span>
                        </div>
                        <div className="text-sm text-blue-700">
                          <strong>Como funciona o SLA em Cascata:</strong> Quando um usuário não consegue agendar um lead dentro do prazo, uma cópia do lead é criada para o próximo usuário. Ambos continuam atendendo o mesmo cliente simultaneamente até que alguém consiga efetivar o agendamento.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Distribuição de Leads */}
            <TabsContent value="distribution" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4 pb-4">
                  <h3 className="text-lg font-medium">Método de Distribuição</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="volume"
                          name="distributionMethod"
                          checked={localConfig.distribution.method === "volume"}
                          onChange={() =>
                            setLocalConfig({
                              ...localConfig,
                              distribution: {
                                ...localConfig.distribution,
                                method: "volume",
                              },
                            })
                          }
                        />
                        <label htmlFor="volume" className="text-sm font-medium">
                          Balanceamento por volume
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">
                        Distribui equitativamente entre consultores
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="performance"
                          name="distributionMethod"
                          checked={localConfig.distribution.method === "performance"}
                          onChange={() =>
                            setLocalConfig({
                              ...localConfig,
                              distribution: {
                                ...localConfig.distribution,
                                method: "performance",
                              },
                            })
                          }
                        />
                        <label htmlFor="performance" className="text-sm font-medium">
                          Balanceamento por performance
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">
                        Prioriza consultores com melhor conversão
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="roundRobin"
                          name="distributionMethod"
                          checked={localConfig.distribution.method === "round-robin"}
                          onChange={() =>
                            setLocalConfig({
                              ...localConfig,
                              distribution: {
                                ...localConfig.distribution,
                                method: "round-robin",
                              },
                            })
                          }
                        />
                        <label htmlFor="roundRobin" className="text-sm font-medium">
                          Round-robin
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">
                        Distribuição sequencial entre consultores
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* SLA em Cascata */}
            <TabsContent value="sla" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4 pb-4">
                  <h3 className="text-lg font-medium">SLA em Cascata Paralelo</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure o tempo de exclusividade por usuário. Quando um usuário não consegue agendar, o lead é duplicado para o próximo da fila, permitindo atendimento simultâneo.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Tempo de SLA por usuário (horas)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        value={localConfig.cascade.slaHours}
                        onChange={(e) =>
                          setLocalConfig({
                            ...localConfig,
                            cascade: {
                              ...localConfig.cascade,
                              slaHours: parseInt(e.target.value) || 24,
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Cada usuário terá este tempo para conseguir um agendamento antes de uma cópia do lead ser criada para o próximo usuário da fila.
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={handleSave}
            disabled={!localConfig.selectedUsers || localConfig.selectedUsers.length === 0}
            className={
              !localConfig.selectedUsers || localConfig.selectedUsers.length === 0
                ? "opacity-50 cursor-not-allowed"
                : ""
            }
          >
            {!localConfig.selectedUsers || localConfig.selectedUsers.length === 0
              ? "Selecione usuários para salvar"
              : "Salvar Configurações"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Componente principal da página de Leads
const LeadsPage: React.FC = () => {
  // Dados de exemplo para demonstração
  const [leads, setLeads] = useState<LeadWithExtras[]>([]);
  
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [consultantFilter, setConsultantFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Configuração padrão para automação
  const defaultConfig: AutomationConfig = {
    distribution: {
      method: "volume",
    },
    cascade: {
      slaHours: 24,
      userOrder: [],
    },
    selectedUsers: [],
  };
  
  // Estado para armazenar a configuração de automação atual
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig>(defaultConfig);
  
  // Busca da configuração de automação atual da API
  const { data: automationConfigData } = useQuery<SistemaConfigAutomacaoLeads>({
    queryKey: ["/api/automation"],
  });
  
  // Atualiza o estado local quando os dados da API são carregados
  useEffect(() => {
    if (automationConfigData) {
      setAutomationConfig({
        distribution: {
          method: automationConfigData.distributionMethod ?? "volume",
        },
        cascade: {
          slaHours: (automationConfigData as any).cascadeSLAHours ?? 24,
          userOrder: (automationConfigData as any).cascadeUserOrder ?? [],
        },
        selectedUsers: Array.isArray(automationConfigData.rotationUsers) ? automationConfigData.rotationUsers as number[] : [],
      });
    }
  }, [automationConfigData]);

  // Busca de usuários
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    select: (data: User[]) => data.filter(user => user.isActive !== false),
  });

  // Busca de leads da tabela sistema_leads com dados de cascata
  const { data: leadsResponse, isLoading } = useQuery<{leads: Lead[], total: number, cascadeData: SistemaLeadsCascata[]}>({
    queryKey: ["/api/sistema-leads/all-with-cascade"],
  });

  // Efeito para preencher o estado de leads diretamente a partir da API
  useEffect(() => {
    if (leadsResponse?.leads) {
      const formattedLeads: LeadWithExtras[] = leadsResponse.leads.map((lead: Lead) => {
        // Buscar dados de cascata para este lead
        const cascadeEntries = leadsResponse.cascadeData?.filter(
          cascade => cascade.leadId === lead.id || cascade.clienteId === lead.clienteId
        ) || [];
        
        // Determinar informações de cascata
        let cascadeInfo: LeadWithExtras['cascadeInfo'] = undefined;
        
        if (cascadeEntries.length > 0) {
          const currentCascade = cascadeEntries.find(c => c.userId === lead.assignedTo);
          const isOriginal = cascadeEntries.find(c => c.sequencia === 1)?.userId === lead.assignedTo;
          
          if (currentCascade) {
            cascadeInfo = {
              sequencia: currentCascade.sequencia,
              originalLeadId: cascadeEntries.find(c => c.sequencia === 1)?.leadId || lead.id,
              totalUsuariosAtivos: cascadeEntries.filter(c => c.status === 'Ativo').length,
              isOriginal: isOriginal || false,
              expiraEm: currentCascade.expiraEm?.toString(),
            };
          }
        }

        return {
          ...lead,
          timeInStage: lead.createdAt ? formatTimeAgo(lead.createdAt) : "-",
          lastInteraction: lead.updatedAt ? formatDate(lead.updatedAt) : (lead.createdAt ? formatDate(lead.createdAt) : "-"),
          isRecurring: lead.isRecurring ?? false,
          cascadeInfo,
        };
      });
      setLeads(formattedLeads);
    }
  }, [leadsResponse?.leads, leadsResponse?.cascadeData]);

  // Filtrar os leads com base nos filtros selecionados
  const filteredLeads = leads.filter((lead) => {
    if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;
    if (statusFilter !== "all" && lead.status !== statusFilter) return false;
    if (consultantFilter !== "all" && lead.assignedTo !== parseInt(consultantFilter)) return false;
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        lead.fullName.toLowerCase().includes(searchLower) ||
        (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
        (lead.phone && lead.phone.toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });

  // Manipulador para seleção de leads
  const handleLeadSelection = (id: number) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((leadId) => leadId !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  // Manipulador para seleção de todos os leads
  const handleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map((lead) => lead.id));
    }
  };

  // Manipulador para salvar configurações de automação
  // Query client para manipulação do cache
  const queryClient = useQueryClient();
  
  // Função para salvar configurações de automação
  const handleSaveAutomationConfig = async (config: AutomationConfig) => {
    setAutomationConfig(config);
    try {
      const userIds = Array.isArray(config.selectedUsers)
        ? config.selectedUsers.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
        : [];
        
      // Log para depuração dos usuários selecionados
      console.log("Usuários selecionados para automação:", userIds);
      
      const apiData = {
        name: "Configuração Principal",
        active: true,
        distributionMethod: config.distribution.method,
        // Configurações padrão para leads recorrentes (sistema nunca bloqueia leads)
        byName: true,
        byPhone: true,
        byEmail: true,
        keepSameConsultant: true,
        assignNewConsultant: false,
        // Valores padrão para campos de SLA obrigatórios (mantidos para compatibilidade)
        firstContactSLA: 30,
        warningPercentage: 75,
        criticalPercentage: 90,
        autoRedistribute: false,
        rotationUsers: userIds,
        // Configurações de SLA em cascata paralelo
        cascadeSLAHours: config.cascade.slaHours,
        cascadeUserOrder: userIds, // Sincroniza a ordem com os usuários selecionados
        cascadeMode: "parallel", // Novo campo para indicar modo paralelo
        // Adicionamos selectedUsers também para garantir compatibilidade com a API
        selectedUsers: userIds
      };
      
      // Log para depuração dos dados enviados para a API
      console.log("Dados de configuração de automação enviados:", apiData);
      
      const response = await fetch("/api/automation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiData),
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao salvar configuração: ${response.status} ${response.statusText}`);
      }
      
      const updatedConfig = await response.json() as SistemaConfigAutomacaoLeads;
      
      // Log para depuração da resposta
      console.log("Configuração atualizada com sucesso:", updatedConfig);
      
      // Atualiza o estado com os dados da API
      setAutomationConfig({
        distribution: {
          method: updatedConfig.distributionMethod ?? "volume",
        },
        cascade: {
          slaHours: (updatedConfig as any).cascadeSLAHours ?? 24,
          userOrder: (updatedConfig as any).cascadeUserOrder ?? [],
        },
        selectedUsers: Array.isArray(updatedConfig.rotationUsers) ? updatedConfig.rotationUsers as number[] : [],
      });
      
      // Atualiza o cache para obter os dados mais recentes
      queryClient.invalidateQueries({ queryKey: ["/api/automation"] });
      
      // Exibe mensagem de sucesso no console
      console.log("Configurações de automação salvas com sucesso!");
      
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Helmet>
        <title>Leads | FamaChat</title>
      </Helmet>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Leads</h1>
        <div className="flex items-center">
          <Button variant="outline" size="sm" className="mr-2">
            <Filter className="mr-2 h-4 w-4" />
            Filtros Avançados
          </Button>
          <AutomationConfigDialog
            config={automationConfig}
            onSave={handleSaveAutomationConfig}
            users={users}
          />
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Filtros Rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fonte</label>
              <Select
                value={sourceFilter}
                onValueChange={setSourceFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as fontes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fontes</SelectItem>
                  <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
                  <SelectItem value="Site">Site</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Sem Atendimento">Sem Atendimento</SelectItem>
                  <SelectItem value="Não Respondeu">Não Respondeu</SelectItem>
                  <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
                  <SelectItem value="Agendamento">Agendamento</SelectItem>
                  <SelectItem value="Visita">Visita</SelectItem>
                  <SelectItem value="Venda">Venda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Usuario</label>
              <Select
                value={consultantFilter}
                onValueChange={setConsultantFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os usuarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuarios</SelectItem>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Busca</label>
              <div className="relative">
                <Input
                  placeholder="Buscar por nome, email ou telefone"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Data de Criação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando leads...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Nenhum lead encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => {
                    // Encontrar o consultor atribuído
                    const assignedConsultant = users?.find(
                      (user) => user.id === lead.assignedTo
                    );

                    return (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLeads.includes(lead.id)}
                            onCheckedChange={() => handleLeadSelection(lead.id)}
                            aria-label={`Selecionar lead ${lead.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{lead.fullName}</span>
                            <div className="flex items-center gap-1">
                              {lead.isRecurring && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <RefreshCw className="h-4 w-4 text-blue-500" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Lead recorrente</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <CascadeBadge cascadeInfo={lead.cascadeInfo} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{lead.phone || "-"}</TableCell>
                        <TableCell>
                          <SourceBadge source={lead.source as LeadSource} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={lead.status as LeadStatus} />
                        </TableCell>
                        <TableCell>
                          {assignedConsultant ? assignedConsultant.username : "-"}
                        </TableCell>
                        <TableCell>
                          {lead.createdAt ? formatDate(lead.createdAt, "dd/MM/yyyy") : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadsPage;
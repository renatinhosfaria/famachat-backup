import { useState, ReactNode, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Cliente, ClienteStatus, User, Role, Department } from "@shared/schema";
import { ClienteCard } from "./cliente-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Users, RefreshCcw, Search, Calendar, FilterX } from "lucide-react";
// Importar do fork compatível com React 18 em vez do react-beautiful-dnd original
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

interface KanbanBoardCentralProps {
  renderNewButton?: () => ReactNode;
}

export function KanbanBoardCentral({ renderNewButton }: KanbanBoardCentralProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [sortOrder, setSortOrder] = useState<string>("mais-novos");
  const [selectedUser, setSelectedUser] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Busca a lista de usuários
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
  
  // Filtrar apenas usuários do departamento Central de Atendimento
  const usuariosCentral = useMemo(() => {
    return (users as User[]).filter(user => 
      user.isActive && user.department === "Central de Atendimento"
    );
  }, [users]);

  const [isLoadingAllPages, setIsLoadingAllPages] = useState(false);
  const [allClientes, setAllClientes] = useState<Cliente[]>([]);
  
  const { data: clientes = [], isLoading: isLoadingFirstPage, isError, refetch } = useQuery({
    queryKey: ["/api/clientes", { order: sortOrder, search: debouncedSearchQuery, selectedUser, department: "central" }],
    queryFn: async () => {
      setIsLoadingAllPages(true);
      
      try {
        
        
        // Abordagem mais simples: buscar todos os clientes diretamente via fetch
        // sem usar o mecanismo padrão de paginação
        let allClientes: any[] = [];
        
        // Construir a URL com parâmetros de consulta
        const params = new URLSearchParams();
        if (sortOrder) params.append("order", sortOrder);
        if (selectedUser !== "todos") {
          // Para Central de Atendimento, sempre usar assignedTo
          params.append("assignedTo", selectedUser);
        }
        if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
        
        // Adicionar timestamp para evitar cache
        params.append("_timestamp", Date.now().toString());
        
        // Método 1: Buscar todos os clientes sem paginação
        
        try {
          const response = await fetch(`/api/clientes/all?${params.toString()}`, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            
            allClientes = data;
            setAllClientes(allClientes);
            setIsLoadingAllPages(false);
            return allClientes;
          }
          
        } catch (err) {
          
        }
          
        // Método 2: Buscar com tamanhos de página muito grandes
        const bigPageSize = 500; // Vamos tentar buscar 500 de uma vez
        params.append("pageSize", bigPageSize.toString());
        params.append("includeCount", "true");
        params.append("page", "1");
        
        
        const bigResponse = await fetch(`/api/clientes?${params.toString()}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (!bigResponse.ok) {
          throw new Error('Falha ao buscar clientes');
        }
        
        const bigData = await bigResponse.json();
        
        
        if (bigData.data && Array.isArray(bigData.data)) {
          allClientes = bigData.data;
          
          // Verificar se precisamos de mais páginas
          const total = bigData.pagination?.total || 0;
          if (total > bigPageSize) {
            
            
            // Buscar páginas adicionais se necessário
            const remainingPages = Math.ceil(total / bigPageSize) - 1;
            
            for (let page = 2; page <= remainingPages + 1; page++) {
              params.set("page", page.toString());
              
              const additionalResponse = await fetch(`/api/clientes?${params.toString()}`, {
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                  'Expires': '0'
                }
              });
              
              if (additionalResponse.ok) {
                const additionalData = await additionalResponse.json();
                if (additionalData.data && Array.isArray(additionalData.data)) {
                  allClientes = [...allClientes, ...additionalData.data];
                }
              }
            }
          }
          
          setAllClientes(allClientes);
          setIsLoadingAllPages(false);
          return allClientes;
        }
        
        
        
        
        // Se chegou até aqui, usar os dados retornados (possivelmente um array direto)
        if (Array.isArray(bigData)) {
          allClientes = bigData;
        } else {
          // Se for um objeto com diferentes estruturas, tentar extrair o array
          allClientes = bigData.clientes || bigData.data || [];
        }
        
        setAllClientes(allClientes);
        setIsLoadingAllPages(false);
        return allClientes;
        
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        setIsLoadingAllPages(false);
        throw error;
      }
    },
    retry: 2,
    staleTime: 30 * 1000, // 30 segundos
  });
  
  const isLoading = isLoadingFirstPage || isLoadingAllPages;

  const handleClienteClick = (cliente: Cliente) => {
    // Redirecionar para a página de detalhes do cliente
    navigate(`/clientes/${cliente.id}`);
  };

  // Obter o usuário logado do contexto de autenticação
  const { currentUser } = useAuth();
  
  // Verificar se há um filtro de usuário aplicado
  const hasUserFilter = selectedUser !== 'todos';
  
  // Filtrar clientes com base no papel do usuário e nos filtros selecionados
  // Para Central de Atendimento, filtrar apenas clientes atribuídos a usuários da Central
  const filteredAndSortedClientes = useMemo(() => {
    return [...(clientes as Cliente[])].filter(cliente => {
      // Primeiro filtro: mostrar apenas clientes atribuídos a usuários da Central de Atendimento
      if (cliente.assignedTo) {
        const assignedUser = usuariosCentral.find(u => u.id === cliente.assignedTo);
        if (!assignedUser) {
          return false; // Cliente não está atribuído a usuário da Central
        }
      }
      
      // Se houver um filtro de usuário específico, aplicá-lo
      if (hasUserFilter) {
        if (!cliente.assignedTo || cliente.assignedTo.toString() !== selectedUser) {
          return false;
        }
      }
      
      // Se não está filtrando por dropdown, aplicar permissões baseadas em papel
      if (!hasUserFilter) {
        // Se não houver usuário logado ou se o usuário for Gestor, mostra todos os clientes da Central
        if (!currentUser || currentUser.role === Role.MANAGER) {
          return true;
        }
        
        // Se o usuário for Consultor de Atendimento, mostra apenas seus clientes
        if (currentUser.role === Role.CONSULTANT) {
          return cliente.assignedTo === currentUser.id;
        }
      }
      
      return true; // Se passou por todos os filtros ou não há filtros específicos
    });
  }, [clientes, hasUserFilter, selectedUser, currentUser, usuariosCentral]);

  // Agrupar clientes por status
  const groupedClientes = useMemo(() => {
    const result: Record<string, Cliente[]> = {};
    
    // Certificar-se de que todas as colunas do funil estão presentes, mesmo que vazias
    const statuses = Object.values(ClienteStatus);
    statuses.forEach(status => {
      result[status] = [];
    });
    
    // Preencher com os clientes filtrados
    filteredAndSortedClientes.forEach(cliente => {
      const status = cliente.status || ClienteStatus.SEM_ATENDIMENTO;
      if (!result[status]) {
        result[status] = [];
      }
      result[status].push(cliente);
    });
    
    return result;
  }, [filteredAndSortedClientes]);

  const statuses = Object.values(ClienteStatus);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    // Se movido para a mesma posição, não fazer nada
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const clienteId = parseInt(draggableId);
    const newStatus = destination.droppableId;

    try {
      await apiRequest(`/api/clientes/${clienteId}`, {
        method: "PATCH",
        body: { status: newStatus },
      });

      // Invalidar queries relacionadas para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      
      toast({
        title: "Status atualizado",
        description: `Cliente movido para ${newStatus}`,
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível mover o cliente. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
    refetch();
    toast({
      title: "Atualizado",
      description: "Lista de clientes atualizada com sucesso!",
    });
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Erro ao carregar clientes</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4">
      {/* Filtros em desktop */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-[140px] sm:w-40">
            <Select
              value={sortOrder}
              onValueChange={setSortOrder}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ordenar" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mais-novos">Mais novos</SelectItem>
                <SelectItem value="mais-antigos">Mais antigos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-[160px] sm:w-48">
            <Select
              value={selectedUser}
              onValueChange={setSelectedUser}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Consultor" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {usuariosCentral.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.username} - {user.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-[200px] sm:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <FilterX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Botão para adicionar novo cliente no canto direito */}
        <div className="ml-auto">
          {renderNewButton ? renderNewButton() : null}
        </div>
      </div>

      {/* Layout mobile - filtros em linha separada */}
      <div className="md:hidden space-y-4">
        {/* Primeira linha: filtros de ordenação e usuário */}
        <div className="flex items-center space-x-4">
          <div className="w-[40px]">
            <Select
              value={sortOrder}
              onValueChange={setSortOrder}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mais-novos">Mais novos</SelectItem>
                <SelectItem value="mais-antigos">Mais antigos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-[40px]">
            <Select
              value={selectedUser}
              onValueChange={setSelectedUser}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  <Users className="h-4 w-4" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {usuariosCentral.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.username} - {user.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Segunda linha: campo de busca e botão lado a lado */}
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <FilterX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Botão novo cliente em mobile */}
          <div className="flex-shrink-0">
            {renderNewButton ? renderNewButton() : null}
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <ScrollArea className="w-full">
          <div className="flex space-x-4 pb-4 min-w-max">
            {statuses.map((status) => (
              <div key={status} className="flex flex-col min-w-[280px] w-[280px]">
                <div className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-t-md">
                  <h3 className="font-medium">{status}</h3>
                  <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                    {groupedClientes[status]?.length || 0}
                  </span>
                </div>
                
                <Droppable droppableId={status}>
                  {(provided: any) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="bg-secondary/20 rounded-b-md p-2 min-h-[calc(100vh-280px)] overflow-y-auto"
                    >
                      {groupedClientes[status]?.length > 0 ? (
                        groupedClientes[status].map((cliente, index) => (
                          <Draggable 
                            key={cliente.id} 
                            draggableId={cliente.id.toString()} 
                            index={index}
                          >
                            {(provided: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="mb-2"
                              >
                                <ClienteCard 
                                  cliente={cliente} 
                                  onCardClick={handleClienteClick}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))
                      ) : isLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="mb-2">
                            <Skeleton className="h-24 w-full rounded-md" />
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          Nenhum cliente
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DragDropContext>
    </div>
  );
}
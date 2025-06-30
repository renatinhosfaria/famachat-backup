import { useState, ReactNode, useMemo, useEffect } from "react";
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

interface KanbanBoardProps {
  renderNewButton?: () => ReactNode;
  filterByCurrentUser?: boolean; // Nova prop para filtrar pelo usuário atual
  hideUserFilter?: boolean; // Nova prop para ocultar o filtro de usuário
}

export function KanbanBoard({ renderNewButton, filterByCurrentUser = false, hideUserFilter = false }: KanbanBoardProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const [sortOrder, setSortOrder] = useState<string>("mais-novos");
  
  // Se filterByCurrentUser for true, inicializar com o usuário atual
  const [selectedUser, setSelectedUser] = useState<string>(
    filterByCurrentUser && currentUser ? currentUser.id.toString() : "todos"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Hook para detectar tamanho da tela
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  
  // Busca a lista de usuários
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
  
  // Filtrar todos os usuários ativos (gestores, consultores, corretores e executivos) usando useMemo para melhor performance
  const todosUsuarios = useMemo(() => {
    return (users as User[]).filter(user => 
      user.isActive && (
        user.role === "Gestor" ||
        (user.role === "Consultor de Atendimento" && user.department === "Central de Atendimento") ||
        (user.role === "Corretor" && user.department === "Vendas") ||
        user.role === "Corretor Senior" ||
        user.role === "Corretor Junior" ||
        user.role === "Corretor Trainee" ||
        user.role === "Executivo"
      )
    );
  }, [users]);

  const [isLoadingAllPages, setIsLoadingAllPages] = useState(false);
  const [allClientes, setAllClientes] = useState<Cliente[]>([]);
  
  const { data: clientes = [], isLoading: isLoadingFirstPage, isError, refetch } = useQuery({
    queryKey: ["/api/clientes", { order: sortOrder, search: debouncedSearchQuery, selectedUser }],
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
          // Quando filterByCurrentUser é true, usar busca dual (assigned_to OU broker_id)
          if (filterByCurrentUser && currentUser) {
            if (currentUser.role === "Consultor de Atendimento") {
              params.append("assignedTo", selectedUser);
            } else {
              // Para todos os outros usuários, usar busca combinada
              params.append("dualSearch", selectedUser);
            }
          } else {
            // Lógica normal para quando não é filterByCurrentUser
            const selectedUserData = todosUsuarios.find(u => u.id.toString() === selectedUser);
            if (selectedUserData?.role === "Consultor de Atendimento") {
              params.append("assignedTo", selectedUser);
            } else {
              // Para gestores, corretores e executivos, usar brokerId
              params.append("brokerId", selectedUser);
            }
          }
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
              const pageParams = new URLSearchParams(params);
              pageParams.set("page", page.toString());
              
              
              const pageResponse = await fetch(`/api/clientes?${pageParams.toString()}`, {
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                  'Expires': '0'
                }
              });
              
              if (pageResponse.ok) {
                const pageData = await pageResponse.json();
                if (pageData.data && Array.isArray(pageData.data)) {
                  allClientes = [...allClientes, ...pageData.data];
                  
                }
              }
            }
          }
        }
        
        
        
        setAllClientes(allClientes);
        setIsLoadingAllPages(false);
        return allClientes;
      } catch (error) {
        
        setIsLoadingAllPages(false);
        throw error;
      }
    },
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,  // Recarregar dados quando a janela ganhar foco
  });
  
  // Usar a variável combinada para o estado de carregamento
  const isLoading = isLoadingFirstPage || isLoadingAllPages;

  const handleClienteClick = (cliente: Cliente) => {
    // Redirecionar para a página de detalhes do cliente
    navigate(`/clientes/${cliente.id}`);
  };
  
  // Verificar se há um filtro de usuário aplicado
  const hasUserFilter = selectedUser !== 'todos';
  
  // Filtrar clientes com base no papel do usuário e nos filtros selecionados
  const filteredAndSortedClientes = useMemo(() => {
    // Se filterByCurrentUser está ativo, confiar na filtragem do backend
    if (filterByCurrentUser) {
      return [...(clientes as Cliente[])];
    }
    
    return [...(clientes as Cliente[])].filter(cliente => {
      // Filtros de dropdown têm precedência sobre as permissões de usuário
      
      // Se houver um filtro de usuário específico, aplicá-lo
      if (hasUserFilter) {
        const selectedUserData = todosUsuarios.find(u => u.id.toString() === selectedUser);
        if (selectedUserData?.role === "Consultor de Atendimento") {
          // Para consultores, verificar assignedTo
          if (!cliente.assignedTo || cliente.assignedTo.toString() !== selectedUser) {
            return false;
          }
        } else {
          // Para gestores, corretores e executivos, verificar brokerId
          if (!cliente.brokerId || cliente.brokerId.toString() !== selectedUser) {
            return false;
          }
        }
      }
      
      // Se não está filtrando por dropdown, aplicar permissões baseadas em papel
      if (!hasUserFilter) {
        // Se não houver usuário logado ou se o usuário for Gestor, mostra todos os clientes
        if (!currentUser || currentUser.role === Role.MANAGER) {
          return true;
        }
        
        // Se o usuário for Consultor de Atendimento, mostra apenas seus clientes
        if (currentUser.role === Role.CONSULTANT) {
          return cliente.assignedTo === currentUser.id;
        }
        
        // Se o usuário for Corretor ou Executivo, mostra apenas clientes que têm agendamento com ele
        if (currentUser.role === Role.BROKER_SENIOR || currentUser.role === Role.BROKER_JUNIOR || currentUser.role === Role.BROKER_TRAINEE || currentUser.role === Role.EXECUTIVE || currentUser.role === "Corretor") {
          return cliente.brokerId === currentUser.id;
        }
      }
      
      return true; // Se passou por todos os filtros ou não há filtros específicos
    });
  }, [clientes, hasUserFilter, selectedUser, currentUser, todosUsuarios, filterByCurrentUser]);

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
      const status = cliente.status || "Sem Atendimento";
      if (!result[status]) {
        result[status] = [];
      }
      result[status].push(cliente);
    });
    
    return result;
  }, [filteredAndSortedClientes]);

  // Função para lidar com o fim de um arrastar e soltar
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Se não tiver destino ou o destino for o mesmo que a origem
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return;
    }

    // Encontrar o cliente que está sendo arrastado
    const clienteId = parseInt(draggableId);
    const cliente = (clientes as Cliente[]).find(c => c.id === clienteId);
    
    if (!cliente) return;

    // Novo status é o ID do droppable (coluna) de destino
    const newStatus = destination.droppableId;

    try {
      // Cria uma cópia local atualizada do cliente
      const updatedCliente = { ...cliente, status: newStatus };
      
      // Atualizar o estado local para refletir a mudança imediatamente
      setAllClientes(prevClientes => 
        prevClientes.map(c => c.id === clienteId ? updatedCliente : c)
      );
      
      // Atualizar o status do cliente na UI imediatamente para feedback rápido
      // Atualiza a consulta principal
      queryClient.setQueryData(["/api/clientes"], (oldData: any) => {
        if (!oldData) return oldData;
        return (oldData as Cliente[]).map(c => 
          c.id === clienteId ? updatedCliente : c
        );
      });
      
      // Atualiza a consulta com parâmetros de order
      queryClient.setQueryData(["/api/clientes", { order: sortOrder, search: debouncedSearchQuery }], (oldData: any) => {
        if (!oldData) return oldData;
        return (oldData as Cliente[]).map(c => 
          c.id === clienteId ? updatedCliente : c
        );
      });
      
      // Atualiza consultas para diferentes filtros que possam estar em cache
      const cacheKeys = queryClient.getQueryCache().getAll()
        .filter(query => Array.isArray(query.queryKey) && query.queryKey[0] === '/api/clientes')
        .map(query => query.queryKey);
        
      cacheKeys.forEach(key => {
        queryClient.setQueryData(key, (oldData: any) => {
          if (!oldData) return oldData;
          if (Array.isArray(oldData)) {
            return (oldData as Cliente[]).map(c => 
              c.id === clienteId ? updatedCliente : c
            );
          }
          // Se for um objeto com dados paginados
          if (oldData?.data && Array.isArray(oldData.data)) {
            return {
              ...oldData,
              data: oldData.data.map((c: Cliente) => 
                c.id === clienteId ? updatedCliente : c
              )
            };
          }
          return oldData;
        });
      });

      // Fazer a chamada de API para atualizar o status do cliente
      await apiRequest({
        url: `/api/clientes/${clienteId}`,
        method: "PATCH",
        body: { status: newStatus },
      });

      // Invalida o cache para garantir que os dados mais recentes sejam buscados na próxima consulta
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });

      toast({
        title: "Status atualizado",
        description: `Status do cliente alterado para ${newStatus}`,
      });
    } catch (error) {
      // Reverter a mudança na UI se a API falhar
      await refetch();
      
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status. Tente novamente.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex space-x-4 p-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex-none w-[280px]">
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-[600px] w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-lg text-muted-foreground mb-4">Erro ao carregar clientes.</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const statuses = Object.values(ClienteStatus);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <div className="min-w-max">
          {/* Filtros, busca e botão lado a lado, alinhados à esquerda até 1279px */}
          <div className="mb-4">
            {/* Layout para até 1279px - todos os elementos lado a lado */}
            <div className="flex xl:hidden flex-wrap gap-2 sm:gap-3 items-center">
              {/* Filtro de ordenação */}
              <div className="w-[40px] sm:w-[120px] md:w-[140px]">
                <Select
                  value={sortOrder}
                  onValueChange={setSortOrder}
                >
                  <SelectTrigger className="w-full">
                    <div className="flex items-center">
                      <ArrowUpDown className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">
                        <SelectValue placeholder="Ordenar por" />
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mais-novos">Mais novos</SelectItem>
                    <SelectItem value="mais-antigos">Mais antigos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro de usuário */}
              {!hideUserFilter && (
                <div className="w-[40px] sm:w-[120px] md:w-[140px]">
                  <Select
                    value={selectedUser}
                    onValueChange={setSelectedUser}
                  >
                    <SelectTrigger className="w-full">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">
                          <SelectValue placeholder="Usuário" />
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {todosUsuarios.map((user: any) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.username} - {user.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Campo de busca */}
              <div className="flex-1 min-w-[80px] max-w-[140px] sm:max-w-[200px] md:max-w-[240px] lg:max-w-[280px]">
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
              
              {/* Botão novo cliente */}
              <div className="flex-shrink-0">
                {renderNewButton ? renderNewButton() : null}
              </div>
            </div>

            {/* Layout para ≥1280px - disposição mais espaçada */}
            <div className="hidden xl:flex flex-wrap mb-4 justify-between items-center gap-4">
              <div className="flex flex-wrap gap-4 items-center w-full xl:w-auto">
                <div className="w-[160px]">
                  <Select
                    value={sortOrder}
                    onValueChange={setSortOrder}
                  >
                    <SelectTrigger className="w-full">
                      <div className="flex items-center">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Ordenar por" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mais-novos">Mais novos</SelectItem>
                      <SelectItem value="mais-antigos">Mais antigos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {!hideUserFilter && (
                  <div className="w-[180px]">
                    <Select
                      value={selectedUser}
                      onValueChange={setSelectedUser}
                    >
                      <SelectTrigger className="w-full">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Usuário" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {todosUsuarios.map((user: any) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.username} - {user.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-[240px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente..."
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
                  
                  <div className="flex-shrink-0">
                    {renderNewButton ? renderNewButton() : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <ScrollArea className="w-full h-[calc(100vh-200px)]">
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
                          className="bg-secondary/20 rounded-b-md p-2 min-h-[calc(100vh-320px)] overflow-y-auto"
                        >
                          {groupedClientes[status]?.length > 0 ? (
                            groupedClientes[status].map((cliente, index) => (
                              <Draggable 
                                key={cliente.id} 
                                draggableId={cliente.id.toString()} 
                                index={index}
                              >
                                {(provided: any, snapshot: any) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{
                                      ...provided.draggableProps.style,
                                      opacity: snapshot.isDragging ? 0.8 : 1
                                    }}
                                  >
                                    <ClienteCard 
                                      cliente={cliente} 
                                      onCardClick={handleClienteClick}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))
                          ) : (
                            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-md">
                              Sem clientes
                            </div>
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="bg-gray-200" />
            </ScrollArea>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
}
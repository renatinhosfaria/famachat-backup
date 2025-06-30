import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useMetas, MetasData } from "@/hooks/use-metas";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient"; 
import { Role } from "@shared/schema";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Trash2, AlertCircle } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Array com os nomes abreviados dos meses
const MESES_ABREVIADOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MetaConsultor {
  agendamentos: number;
  conversaoAgendamentos: number; // Alterado de conversaoClientes para conversaoAgendamentos
}

interface MetaCorretor {
  visitas: number;
  vendas: number;
  conversaoAgendamentos: number;
  conversaoVisitas: number;
  conversaoVendas: number;
}

interface User {
  id: number;
  username: string;
  fullName?: string;
  role: string;
}

// Interface para os componentes de diálogo
interface MetaEditDialogProps {
  meta: MetasData;
  users: User[];
  onSuccess: () => void;
}

interface MetaDeleteDialogProps {
  metaId: number;
  onSuccess: () => void;
}

// Componente de diálogo para editar uma meta
// Helper para garantir que sempre temos um ID para edição
function assertMetaId(id: number | undefined): asserts id is number {
  if (id === undefined) {
    throw new Error("ID da meta não pode ser indefinido");
  }
}

function MetaEditDialog({ meta, users, onSuccess }: MetaEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [formValues, setFormValues] = useState({
    agendamentos: meta.agendamentos || 0,
    visitas: meta.visitas || 0,
    vendas: meta.vendas || 0,
    conversaoAgendamentos: meta.conversaoAgendamentos || 0,
    conversaoVisitas: meta.conversaoVisitas || 0,
    conversaoVendas: meta.conversaoVendas || 0
  });
  const { toast } = useToast();
  const { useAtualizarMetas } = useMetas();

  // Mutação para atualizar meta usando o hook personalizado
  const updateMutation = useAtualizarMetas();
  
  // Configurar efeito para fechar o diálogo quando a operação for bem-sucedida
  useEffect(() => {
    if (updateMutation.isSuccess) {
      setOpen(false);
      onSuccess();
    }
  }, [updateMutation.isSuccess, onSuccess]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Usar a função de asserção para garantir que o ID existe
      assertMetaId(meta.id);
      
      // Se chegar aqui, o TypeScript sabe que meta.id é um número
      updateMutation.mutate({ 
        id: meta.id, 
        data: formValues 
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar meta",
        description: "ID da meta não encontrado",
        variant: "destructive"
      });
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let numValue = parseFloat(value);
    
    // Se o valor não for um número válido, use 0
    if (isNaN(numValue)) {
      numValue = 0;
    }
    
    setFormValues({
      ...formValues,
      [name]: numValue
    });
  };
  
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Meta</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="usuario">Usuário</Label>
                <Input 
                  id="usuario" 
                  value={users.find(u => u.id === meta?.userId)?.username || 'Usuário não encontrado'} 
                  disabled 
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="mes">Mês</Label>
                <Input 
                  id="mes" 
                  value={meta?.mes || ''} 
                  disabled 
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="agendamentos">Agendamentos</Label>
                <Input 
                  id="agendamentos" 
                  name="agendamentos"
                  type="number" 
                  value={formValues.agendamentos} 
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="visitas">Visitas</Label>
                <Input 
                  id="visitas" 
                  name="visitas"
                  type="number" 
                  value={formValues.visitas} 
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="vendas">Vendas</Label>
                <Input 
                  id="vendas" 
                  name="vendas"
                  type="number" 
                  value={formValues.vendas} 
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="conversaoAgendamentos">Conversão de Agendamentos (%)</Label>
                <Input 
                  id="conversaoAgendamentos" 
                  name="conversaoAgendamentos"
                  type="number" 
                  value={formValues.conversaoAgendamentos} 
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="conversaoVisitas">Conversão de Visitas (%)</Label>
                <Input 
                  id="conversaoVisitas" 
                  name="conversaoVisitas"
                  type="number" 
                  value={formValues.conversaoVisitas} 
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="conversaoVendas">Conversão de Vendas (%)</Label>
                <Input 
                  id="conversaoVendas" 
                  name="conversaoVendas"
                  type="number" 
                  value={formValues.conversaoVendas} 
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Componente de diálogo para excluir uma meta
function MetaDeleteDialog({ metaId, onSuccess }: MetaDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { useExcluirMeta } = useMetas();

  // Mutação para excluir meta usando o hook personalizado
  const deleteMutation = useExcluirMeta();
  
  // Configurar efeito para fechar o diálogo quando a operação for bem-sucedida
  useEffect(() => {
    if (deleteMutation.isSuccess) {
      setOpen(false);
      onSuccess();
    }
  }, [deleteMutation.isSuccess, onSuccess]);
  
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
      
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate(metaId);
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Metas() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Buscar lista de usuários
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await api.get("/users");
      return response.data;
    }
  });

  // Estados para filtros de período e mês
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>("mes");
  const [mesSelecionado, setMesSelecionado] = useState<number>(new Date().getMonth()); // 0-11

  // Hooks para gerenciar metas
  const { 
    useMetasConsultor, 
    useMetasCorretor, 
    useTodasMetas,
    useSalvarMetas
  } = useMetas();

  // Consultar metas para o mês selecionado
  const { data: metaConsultor } = useMetasConsultor(
    selectedUserId || 0,
    new Date().getFullYear(),
    mesSelecionado + 1 // Mês no formato do banco (1-12)
  );
  const { data: metaCorretor } = useMetasCorretor(
    selectedUserId || 0,
    new Date().getFullYear(),
    mesSelecionado + 1 // Mês no formato do banco (1-12)
  );
  
  // Mutation para salvar metas
  const { mutateAsync: salvarMetas, isPending: isSavingMetas } = useSalvarMetas();

  const [metaConsultorForm, setMetaConsultorForm] = useState<MetaConsultor>({
    agendamentos: 0,
    conversaoAgendamentos: 0, // Alterado de conversaoClientes para conversaoAgendamentos
  });

  const [metaCorretorForm, setMetaCorretorForm] = useState<MetaCorretor>({
    visitas: 0,
    vendas: 0,
    conversaoAgendamentos: 0,
    conversaoVisitas: 0,
    conversaoVendas: 0,
  });

  // Atualizar usuário selecionado quando o ID mudar
  useEffect(() => {
    if (selectedUserId && Array.isArray(users)) {
      const user = users.find((u: User) => u.id === selectedUserId);
      if (user) {
        setSelectedUser(user);
      }
    } else {
      setSelectedUser(null);
    }
  }, [selectedUserId, users]);
  
  // Refazer as consultas quando o mês selecionado mudar
  useEffect(() => {
    if (selectedUserId) {
      // Invalidar as queries para forçar o recarregamento com o novo mês selecionado
      queryClient.invalidateQueries({
        queryKey: ['metas', 'consultor', selectedUserId]
      });
      queryClient.invalidateQueries({
        queryKey: ['metas', 'corretor', selectedUserId] 
      });
    }
  }, [mesSelecionado, selectedUserId, queryClient]);

  // Atualizar formulários quando as metas forem carregadas
  useEffect(() => {
    if (metaConsultor) {
      setMetaConsultorForm({
        agendamentos: metaConsultor.agendamentos || 0,
        conversaoAgendamentos: metaConsultor.conversaoAgendamentos || 0,
      });
    }
  }, [metaConsultor]);
  
  // Efeito para atualizar as consultas quando o mês selecionado mudar
  useEffect(() => {
    if (selectedUserId) {
      // Vamos invalidar as queries para forçar uma nova consulta com o mês atual
      queryClient.invalidateQueries({
        queryKey: ['metas', 'consultor', selectedUserId]
      });
      queryClient.invalidateQueries({
        queryKey: ['metas', 'corretor', selectedUserId]
      });
    }
  }, [mesSelecionado, selectedUserId, queryClient]);

  useEffect(() => {
    if (metaCorretor) {
      setMetaCorretorForm({
        visitas: metaCorretor.visitas || 0,
        vendas: metaCorretor.vendas || 0,
        conversaoAgendamentos: metaCorretor.conversaoAgendamentos || 0,
        conversaoVisitas: metaCorretor.conversaoVisitas || 0,
        conversaoVendas: metaCorretor.conversaoVendas || 0,
      });
    }
  }, [metaCorretor]);

  // Função para obter o nome do mês
  const getNomeMes = (mesIndex: number = new Date().getMonth()) => {
    // Garantir que o índice esteja dentro do intervalo válido (0-11)
    const indexAjustado = Math.max(0, Math.min(11, mesIndex));
    return MESES_ABREVIADOS[indexAjustado]; // Retorna o nome abreviado do mês
  };

  const handleSaveMetas = async () => {
    if (!selectedUser) {
      toast({
        title: "Aviso",
        description: "Selecione um usuário para definir metas.",
        variant: "default"
      });
      return;
    }

    try {
      console.log('Iniciando salvamento de metas...');
      const dataAtual = new Date();
      const anoAtual = dataAtual.getFullYear();
      // Usamos o mesSelecionado (0-11) + 1 para converter para o formato do banco (1-12)
      const mesSelecionadoAjustado = mesSelecionado + 1; 
      
      // Dados base comuns para todos os tipos de usuário
      const metaBase = {
        userId: selectedUser.id,
        periodo: "mensal",
        ano: anoAtual,
        mes: mesSelecionadoAjustado // Usando o mês selecionado pelos botões
      };
      
      console.log('Usuário selecionado:', selectedUser);
      console.log('Cargo do usuário:', selectedUser.role);
      
      if (selectedUser.role === Role.CONSULTANT || selectedUser.role === "Consultor de Atendimento") {
        const dadosMeta = {
          ...metaBase,
          agendamentos: metaConsultorForm.agendamentos,
          conversaoAgendamentos: metaConsultorForm.conversaoAgendamentos // Alterado de conversaoClientes para conversaoAgendamentos
        };
        
        console.log('Salvando metas de consultor:', dadosMeta);
        
        // Salvar metas de consultor
        const resultado = await salvarMetas(dadosMeta);
        console.log('Resultado do salvamento:', resultado);
        
        toast({
          title: "Sucesso",
          description: "Metas do consultor salvas com sucesso!",
        });
      } else if (selectedUser.role === Role.BROKER_SENIOR || selectedUser.role === Role.BROKER_JUNIOR || selectedUser.role === Role.BROKER_TRAINEE || selectedUser.role === "Corretor") {
        const dadosMeta = {
          ...metaBase,
          visitas: metaCorretorForm.visitas,
          vendas: metaCorretorForm.vendas,
          conversaoAgendamentos: metaCorretorForm.conversaoAgendamentos,
          conversaoVisitas: metaCorretorForm.conversaoVisitas,
          conversaoVendas: metaCorretorForm.conversaoVendas
        };
        
        console.log('Salvando metas de corretor:', dadosMeta);
        
        // Salvar metas de corretor
        const resultado = await salvarMetas(dadosMeta);
        console.log('Resultado do salvamento:', resultado);
        
        toast({
          title: "Sucesso",
          description: "Metas do corretor salvas com sucesso!",
        });
      } else {
        console.error('Tipo de usuário não suportado:', selectedUser.role);
        toast({
          title: "Erro",
          description: "Tipo de usuário não suportado para definição de metas.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao salvar metas:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar metas. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Buscar todas as metas
  const { data: allMetas, isLoading: loadingAllMetas } = useTodasMetas();
  
  // Estado para armazenar as métricas de desempenho dependentes do período
  const [desempenho, setDesempenho] = useState({
    novosClientes: 0,
    agendamentos: 20,
    visitas: 7,
    vendas: 0,
    conversaoAgendamentos: 25,
    conversaoVisitas: 35,
    conversaoVendas: 0
  });

  // Atualizar métricas com base no período selecionado
  useEffect(() => {
    // Aqui seria uma chamada API para buscar dados reais por período
    // Por enquanto, vamos simular valores diferentes para cada período
    
    type Periodo = 'hoje' | 'ontem' | '7dias' | 'mes' | 'trimestre' | 'semestre' | 'ano';
    
    const metricas: Record<Periodo, typeof desempenho> = {
      hoje: { 
        novosClientes: 0, 
        agendamentos: 5, 
        visitas: 2, 
        vendas: 0,
        conversaoAgendamentos: 15,
        conversaoVisitas: 20,
        conversaoVendas: 0
      },
      ontem: { 
        novosClientes: 1, 
        agendamentos: 8, 
        visitas: 3, 
        vendas: 1,
        conversaoAgendamentos: 20,
        conversaoVisitas: 25,
        conversaoVendas: 10 
      },
      '7dias': { 
        novosClientes: 0, 
        agendamentos: 20, 
        visitas: 7, 
        vendas: 0,
        conversaoAgendamentos: 25,
        conversaoVisitas: 35,
        conversaoVendas: 0
      },
      mes: { 
        novosClientes: 12, 
        agendamentos: 60, 
        visitas: 30, 
        vendas: 8,
        conversaoAgendamentos: 30,
        conversaoVisitas: 40,
        conversaoVendas: 25
      },
      trimestre: { 
        novosClientes: 40, 
        agendamentos: 180, 
        visitas: 90, 
        vendas: 25,
        conversaoAgendamentos: 35,
        conversaoVisitas: 45,
        conversaoVendas: 28
      },
      semestre: { 
        novosClientes: 80, 
        agendamentos: 350, 
        visitas: 180, 
        vendas: 55,
        conversaoAgendamentos: 40,
        conversaoVisitas: 48,
        conversaoVendas: 30
      },
      ano: { 
        novosClientes: 160, 
        agendamentos: 700, 
        visitas: 350, 
        vendas: 110,
        conversaoAgendamentos: 42,
        conversaoVisitas: 50,
        conversaoVendas: 32
      }
    };
    
    setDesempenho(metricas[periodoSelecionado as Periodo] || metricas['7dias']);
    
  }, [periodoSelecionado]);

  // Cálculo do somatório das metas do escritório e médias
  const metasEscritorio = React.useMemo(() => {
    if (!Array.isArray(allMetas)) return null;
    
    // Contadores para calcular médias
    const contadores = {
      totalUsuariosAgendamentos: 0,
      totalUsuariosVisitas: 0,
      totalUsuariosVendas: 0,
      totalUsuariosConversaoAgendamentos: 0,
      totalUsuariosConversaoVisitas: 0,
      totalUsuariosConversaoVendas: 0,
    };
    
    const somas = allMetas.reduce(
      (acc, meta) => {
        // Somar valores - considerando que os nomes no banco agora são com underscore
        acc.agendamentos += meta.agendamentos || 0;
        acc.visitas += meta.visitas || 0;
        acc.vendas += meta.vendas || 0;
        
        // Mapeando os nomes de colunas do banco para os nomes de propriedades do JavaScript
        // Importante: não existe mais a coluna conversao_clientes
        const conversaoAgendamentos = meta.conversao_agendamentos || meta.conversaoAgendamentos || 0;
        const conversaoVisitas = meta.conversao_visitas || meta.conversaoVisitas || 0;
        const conversaoVendas = meta.conversao_vendas || meta.conversaoVendas || 0;
        
        // Usamos conversaoAgendamentos como substituto para conversaoClientes
        acc.conversaoAgendamentos += conversaoAgendamentos;
        acc.conversaoVisitas += conversaoVisitas;
        acc.conversaoVendas += conversaoVendas;
        
        // Contar usuários com cada tipo de meta
        if (meta.agendamentos) contadores.totalUsuariosAgendamentos++;
        if (meta.visitas) contadores.totalUsuariosVisitas++;
        if (meta.vendas) contadores.totalUsuariosVendas++;
        if (conversaoAgendamentos) contadores.totalUsuariosConversaoAgendamentos++;
        if (conversaoVisitas) contadores.totalUsuariosConversaoVisitas++;
        if (conversaoVendas) contadores.totalUsuariosConversaoVendas++;
        
        return acc;
      },
      {
        agendamentos: 0,
        visitas: 0,
        vendas: 0,
        conversaoAgendamentos: 0,
        conversaoVisitas: 0,
        conversaoVendas: 0,
      }
    );
    
    // Calcular médias
    const medias = {
      mediaAgendamentos: contadores.totalUsuariosAgendamentos > 0 
        ? Math.round(somas.agendamentos / contadores.totalUsuariosAgendamentos) 
        : 0,
      mediaVisitas: contadores.totalUsuariosVisitas > 0 
        ? Math.round(somas.visitas / contadores.totalUsuariosVisitas) 
        : 0,
      mediaVendas: contadores.totalUsuariosVendas > 0 
        ? Math.round(somas.vendas / contadores.totalUsuariosVendas) 
        : 0,
      // Conversão de agendamentos é o que era chamado de conversaoClientes antes
      mediaConversaoAgendamentos: contadores.totalUsuariosConversaoAgendamentos > 0 
        ? Math.round(somas.conversaoAgendamentos / contadores.totalUsuariosConversaoAgendamentos) 
        : 0,
      mediaConversaoVisitas: contadores.totalUsuariosConversaoVisitas > 0 
        ? Math.round(somas.conversaoVisitas / contadores.totalUsuariosConversaoVisitas) 
        : 0,
      mediaConversaoVendas: contadores.totalUsuariosConversaoVendas > 0 
        ? Math.round(somas.conversaoVendas / contadores.totalUsuariosConversaoVendas) 
        : 0,
    };
    
    console.log('Metas calculadas:', { somas, contadores, medias });
    
    return {
      ...somas,
      ...medias,
      totalMetas: allMetas.length
    };
  }, [allMetas]);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Gestão de Metas</h1>

        {/* Filtro de período */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button 
            variant={periodoSelecionado === "mes" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodoSelecionado("mes")}
          >
            Mês
          </Button>
          <Button 
            variant={periodoSelecionado === "trimestre" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodoSelecionado("trimestre")}
          >
            Trimestre
          </Button>
          <Button 
            variant={periodoSelecionado === "semestre" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodoSelecionado("semestre")}
          >
            Semestre
          </Button>
          <Button 
            variant={periodoSelecionado === "ano" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodoSelecionado("ano")}
          >
            Ano
          </Button>
        </div>
        
        {/* Blocos de métricas de desempenho - primeira linha - Metas principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col">
                <span className="text-sm font-medium mb-1">Agendamentos</span>
                <span className="text-3xl font-bold">{desempenho.agendamentos}</span>
                <div className="text-xs mt-2">
                  
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col">
                <span className="text-sm font-medium mb-1">Visitas</span>
                <span className="text-3xl font-bold">{desempenho.visitas}</span>
                <div className="text-xs mt-2">
                  
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col">
                <span className="text-sm font-medium mb-1">Vendas</span>
                <span className="text-3xl font-bold">{desempenho.vendas}</span>
                <div className="text-xs mt-2">
                  
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Blocos de métricas de desempenho - segunda linha - Conversões */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col">
                <span className="text-sm font-medium mb-1">Conversão Agendamento (%)</span>
                <span className="text-3xl font-bold">
                  {metasEscritorio?.mediaConversaoAgendamentos || 0}%
                </span>
                <div className="text-xs mt-2 text-muted-foreground">
                  Média de todos os usuários
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col">
                <span className="text-sm font-medium mb-1">Conversão Visitas (%)</span>
                <span className="text-3xl font-bold">
                  {metasEscritorio?.mediaConversaoVisitas || 0}%
                </span>
                <div className="text-xs mt-2">
                  
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col">
                <span className="text-sm font-medium mb-1">Conversão Vendas (%)</span>
                <span className="text-3xl font-bold">
                  {metasEscritorio?.mediaConversaoVendas || 0}%
                </span>
                <div className="text-xs mt-2">
                  
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="mb-6">
          <Label htmlFor="user" className="mb-2 block">Selecione o Usuário</Label>
          <Select
            value={selectedUserId?.toString()}
            onValueChange={(value) => setSelectedUserId(parseInt(value))}
          >
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {Array.isArray(users) && users.map((user: any) => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  {user.username} {user.role ? `- ${user.role}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedUser ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Selecione um usuário para definir metas.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedUser.role === Role.CONSULTANT || selectedUser.role === "Consultor de Atendimento" 
                ? `Metas Mensais do Consultor de Atendimento (${getNomeMes(mesSelecionado)})` 
                : (selectedUser.role === Role.BROKER_SENIOR || selectedUser.role === Role.BROKER_JUNIOR || selectedUser.role === Role.BROKER_TRAINEE || selectedUser.role === "Corretor")
                  ? `Metas Mensais do Corretor (${getNomeMes(mesSelecionado)})`
                  : `Metas Mensais para ${selectedUser.username} (${getNomeMes(mesSelecionado)})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Todas as metas são relativas ao período mensal.</p>
            
            {/* Seletor de meses dentro do card */}
            <div className="flex flex-wrap gap-1 mb-6">
              {MESES_ABREVIADOS.map((mes, index) => (
                <Button 
                  key={index}
                  variant={mesSelecionado === index ? "default" : "outline"}
                  size="sm"
                  className="px-3 py-1 h-8"
                  onClick={() => setMesSelecionado(index)}
                >
                  {mes}
                </Button>
              ))}
            </div>
            
            {/* Formulário para Consultor */}
            {(selectedUser.role === Role.CONSULTANT || selectedUser.role === "Consultor de Atendimento") && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="agendamentos">Agendamentos</Label>
                    <Input
                      id="agendamentos"
                      type="number"
                      placeholder="0"
                      min={0}
                      value={metaConsultorForm.agendamentos || 0}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : Number(e.target.value);
                        setMetaConsultorForm({
                          ...metaConsultorForm,
                          agendamentos: value
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="conversaoAgendamentos">Conversão Agendamento (%)</Label>
                    <Input
                      id="conversaoAgendamentos"
                      type="number"
                      placeholder="0"
                      min={0}
                      max={100}
                      value={metaConsultorForm.conversaoAgendamentos || 0}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : Number(e.target.value);
                        setMetaConsultorForm({
                          ...metaConsultorForm,
                          conversaoAgendamentos: value
                        });
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Formulário para Corretor */}
            {(selectedUser.role === Role.BROKER_SENIOR || selectedUser.role === Role.BROKER_JUNIOR || selectedUser.role === Role.BROKER_TRAINEE || selectedUser.role === "Corretor") && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="visitasCorretor">Visitas</Label>
                    <Input
                      id="visitasCorretor"
                      type="number"
                      value={metaCorretorForm.visitas}
                      onChange={(e) => setMetaCorretorForm({
                        ...metaCorretorForm,
                        visitas: Number(e.target.value)
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendas">Vendas</Label>
                    <Input
                      id="vendas"
                      type="number"
                      value={metaCorretorForm.vendas}
                      onChange={(e) => setMetaCorretorForm({
                        ...metaCorretorForm,
                        vendas: Number(e.target.value)
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="conversaoAgendamentos">Conversão Agendamentos (%)</Label>
                    <Input
                      id="conversaoAgendamentos"
                      type="number"
                      value={metaCorretorForm.conversaoAgendamentos}
                      onChange={(e) => setMetaCorretorForm({
                        ...metaCorretorForm,
                        conversaoAgendamentos: Number(e.target.value)
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="conversaoVisitas">Conversão Visitas (%)</Label>
                    <Input
                      id="conversaoVisitas"
                      type="number"
                      value={metaCorretorForm.conversaoVisitas}
                      onChange={(e) => setMetaCorretorForm({
                        ...metaCorretorForm,
                        conversaoVisitas: Number(e.target.value)
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="conversaoVendas">Conversão Vendas (%)</Label>
                    <Input
                      id="conversaoVendas"
                      type="number"
                      value={metaCorretorForm.conversaoVendas || 0}
                      onChange={(e) => setMetaCorretorForm({
                        ...metaCorretorForm,
                        conversaoVendas: Number(e.target.value)
                      })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Mensagem para outros tipos de usuários */}
            {selectedUser.role !== Role.CONSULTANT && 
             selectedUser.role !== "Consultor de Atendimento" && 
             selectedUser.role !== Role.BROKER_SENIOR && 
             selectedUser.role !== Role.BROKER_JUNIOR && 
             selectedUser.role !== Role.BROKER_TRAINEE && 
             selectedUser.role !== "Corretor" && (
              <p className="text-center text-muted-foreground py-4">
                Definição de metas não disponível para este tipo de usuário.
              </p>
            )}
            
            {/* Botão de salvar para qualquer tipo de usuário válido */}
            {(selectedUser.role === Role.CONSULTANT || 
              selectedUser.role === "Consultor de Atendimento" || 
              selectedUser.role === Role.BROKER_SENIOR || 
              selectedUser.role === Role.BROKER_JUNIOR || 
              selectedUser.role === Role.BROKER_TRAINEE || 
              selectedUser.role === "Corretor") && (
              <div className="mt-6">
                <Button 
                  onClick={handleSaveMetas}
                  className="w-full"
                  disabled={isSavingMetas}
                >
                  {isSavingMetas ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabela de metas dos usuários */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Metas por Usuário</h2>
        <Card>
          <CardContent className="p-6">
            <Table>
              <TableCaption>Lista de todas as metas cadastradas</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead>Agendamento</TableHead>
                  <TableHead>Visita</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead>Conv. Agendamento (%)</TableHead>
                  <TableHead>Conv. Visitas (%)</TableHead>
                  <TableHead>Conv. Vendas (%)</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(allMetas) && allMetas.length > 0 ? (
                  allMetas.map((meta: any, index: number) => {
                    const user = Array.isArray(users) ? users.find((u: any) => u.id === meta.userId) : null;
                    console.log('Exibindo meta:', meta, 'para usuário:', user);
                    
                    // Mapeando os nomes de colunas do banco para os nomes de propriedades do JavaScript
                    const conversaoAgendamentos = meta.conversao_agendamentos || meta.conversaoAgendamentos || 0;
                    const conversaoVisitas = meta.conversao_visitas || meta.conversaoVisitas || 0;
                    const conversaoVendas = meta.conversao_vendas || meta.conversaoVendas || 0;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>{user?.username || 'Usuário não encontrado'}</TableCell>
                        <TableCell>{user?.role || 'N/A'}</TableCell>
                        <TableCell>{meta.mes}</TableCell>
                        <TableCell>{meta.agendamentos || 0}</TableCell>
                        <TableCell>{meta.visitas || 0}</TableCell>
                        <TableCell>{meta.vendas || 0}</TableCell>
                        <TableCell>{conversaoAgendamentos}%</TableCell>
                        <TableCell>{conversaoVisitas}%</TableCell>
                        <TableCell>{conversaoVendas}%</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <MetaEditDialog meta={meta} users={users} onSuccess={() => {
                              queryClient.invalidateQueries({queryKey: ['/api/metas/todas']});
                              toast({ title: "Meta atualizada com sucesso!" });
                            }} />
                            
                            <MetaDeleteDialog metaId={meta.id} onSuccess={() => {
                              queryClient.invalidateQueries({queryKey: ['/api/metas/todas']});
                              toast({ title: "Meta excluída com sucesso!" });
                            }} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">Nenhuma meta cadastrada</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {Array.isArray(allMetas) && allMetas?.length > 0 
                  ? `Total de ${allMetas.length} metas encontradas` 
                  : 'Nenhuma meta cadastrada'
                }
              </div>
              <Button 
                variant="outline" 
                onClick={() => {
                  console.log('Forçando atualização completa da tabela de metas');
                  
                  // Primeiro limpa completamente o cache
                  queryClient.removeQueries({ queryKey: ['metas'] });
                  
                  // Depois força uma nova consulta
                  queryClient.invalidateQueries({ queryKey: ['metas'] });
                  
                  // Atualiza a página para garantir que todos os dados estão atualizados
                  window.location.reload();
                  
                  toast({
                    title: "Atualizando dados",
                    description: "Recarregando todas as metas do sistema...",
                    variant: "default"
                  });
                }}
              >
                Limpar Cache e Atualizar Dados
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
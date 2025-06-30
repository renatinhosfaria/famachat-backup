import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { User, Role, Department } from "@shared/schema";
import { UserPlus, Edit, Trash2, UserCheck, UserX, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Função para obter os cargos disponíveis para o departamento selecionado
const getRolesForDepartment = (department: string): string[] => {
  switch(department) {
    case Department.GESTAO:
      return [Role.MANAGER]; // Gestão -> Gestor
    case Department.MARKETING:
      return [Role.MARKETING]; // Marketing -> Marketing
    case Department.ATENDIMENTO:
      return [Role.CONSULTANT]; // Central de Atendimento -> Consultor de Atendimento
    case Department.VENDAS:
      return [
        Role.EXECUTIVE, // Executivo
        Role.BROKER_SENIOR, // Corretor Senior
        Role.BROKER_JUNIOR, // Corretor Junior
        Role.BROKER_TRAINEE // Corretor Trainee
      ];
    default:
      return [];
  }
};

export default function UsuariosPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [transferToUserId, setTransferToUserId] = useState<string>("");
  const [userDataSummary, setUserDataSummary] = useState<{
    leads: number;
    clientes: number;
    appointments: number;
    visits: number;
    sales: number;
    notes: number;
  } | null>(null);
  const [formData, setFormData] = useState<{
    username: string;
    fullName: string;
    email: string;
    phone: string;
    role: string;
    department: string;
    isActive: boolean;
    password: string;
    passwordHash?: string;
  }>({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    role: Role.BROKER_SENIOR,
    department: Department.VENDAS,
    isActive: true,
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordCreate, setShowPasswordCreate] = useState(false);

  const diasSemana = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
  const [diasSelecionados, setDiasSelecionados] = useState([false, false, false, false, false, false, false]);
  const [horarios, setHorarios] = useState([
    { inicio: "08:00", fim: "17:00", diaTodo: false },
    { inicio: "08:00", fim: "17:00", diaTodo: false },
    { inicio: "08:00", fim: "17:00", diaTodo: false },
    { inicio: "08:00", fim: "17:00", diaTodo: false },
    { inicio: "08:00", fim: "17:00", diaTodo: false },
    { inicio: "08:00", fim: "17:00", diaTodo: false },
    { inicio: "08:00", fim: "17:00", diaTodo: false },
  ]);

  // Buscar todos os usuários
  const { data: users = [], refetch, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    refetchOnWindowFocus: false,
  });

  // Resetar o formulário
  const resetForm = () => {
    setFormData({
      username: "",
      fullName: "",
      email: "",
      phone: "",
      role: Role.CONSULTANT,
      department: Department.VENDAS,
      isActive: true,
      password: "",
    });
  };

  // 1. Buscar horários do usuário ao abrir o modal de edição
  const fetchHorariosUsuario = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/horarios`);
      if (!res.ok) return;
      const horariosDb = await res.json();
      // Preencher os estados
      const novosDiasSelecionados = diasSemana.map(dia => horariosDb.some((h: any) => h.dia_semana === dia));
      const novosHorarios = diasSemana.map(dia => {
        const h = horariosDb.find((h: any) => h.dia_semana === dia);
        return h
          ? { inicio: h.horario_inicio, fim: h.horario_fim, diaTodo: h.dia_todo }
          : { inicio: "08:00", fim: "17:00", diaTodo: false };
      });
      setDiasSelecionados(novosDiasSelecionados);
      setHorarios(novosHorarios);
    } catch {}
  };

  // Modificar handleEditClick para buscar horários
  const handleEditClick = async (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      fullName: user.fullName,
      email: user.email || "",
      phone: user.phone || "",
      role: normalizeRole(user.role as string),
      department: normalizeDepartment(user.department as string),
      isActive: user.isActive !== false,
      password: "",
    });
    await fetchHorariosUsuario(user.id);
    setIsEditDialogOpen(true);
  };

  // Função para abrir o dialog de exclusão (com verificação de dados vinculados)
  const handleDeleteClick = async (user: User) => {
    if (user.role === Role.MANAGER) {
      toast({
        variant: "destructive",
        title: "Ação não permitida",
        description: "Usuário com cargo Gestor não pode ser excluído.",
      });
      return;
    }
    
    setSelectedUser(user);
    
    // Buscar resumo dos dados vinculados ao usuário
    const dataSummary = await fetchUserDataSummary(user.id);
    
    if (dataSummary && (dataSummary.leads > 0 || dataSummary.clientes > 0 || dataSummary.appointments > 0 || dataSummary.visits > 0 || dataSummary.sales > 0 || dataSummary.notes > 0)) {
      // Se há dados vinculados, abrir diálogo de transferência
      setIsTransferDialogOpen(true);
    } else {
      // Se não há dados vinculados, ir direto para exclusão
      setIsDeleteDialogOpen(true);
    }
  };

  // Função para criar um novo usuário
  const handleCreateUser = async () => {
    try {
      // Preparar dados do usuário (sem horários)
      const userData = {
        ...formData,
        passwordHash: formData.password,
      };
      const { password, ...userDataToSend } = userData;
      
      // 1. Criar o usuário primeiro
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userDataToSend),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar usuário');
      }
      
      // 2. Obter o ID do usuário criado
      const newUser = await response.json();
      const userId = newUser.id;
      
      // 3. Preparar e salvar os horários
      const horariosData = diasSelecionados.map((selecionado, idx) =>
        selecionado ? { dia: diasSemana[idx], ...horarios[idx] } : null
      ).filter(Boolean);
      
      console.log('[DEBUG] Dias selecionados:', diasSelecionados);
      console.log('[DEBUG] Horários originais:', horarios);
      console.log('[DEBUG] Horários formatados para o usuário:', horariosData);
      
      if (horariosData.length > 0) {
        try {
          const payload = JSON.stringify(horariosData);
          console.log('[DEBUG] Payload JSON sendo enviado:', payload);
          
          const horariosResponse = await fetch(`/api/horarios-usuario/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });
          
          console.log('[DEBUG] Status da resposta de horários:', horariosResponse.status);
          
          const responseText = await horariosResponse.text();
          console.log('[DEBUG] Resposta completa:', responseText);
          
          if (!horariosResponse.ok) {
            console.error('[DEBUG] Erro ao salvar horários:', responseText);
            // Não interrompe o fluxo, apenas loga o erro
          } else {
            console.log('[DEBUG] Horários salvos com sucesso:', responseText);
            
            // Verificar se os horários foram realmente salvos
            const verificacaoResponse = await fetch(`/api/horarios-usuario/${userId}`);
            const horariosVerificados = await verificacaoResponse.json();
            console.log('[DEBUG] Verificação de horários salvos:', horariosVerificados);
          }
        } catch (error) {
          console.error('[DEBUG] Exceção ao salvar horários:', error);
        }
      } else {
        console.warn('[DEBUG] Nenhum horário selecionado para salvar');
      }
      
      toast({
        title: "Usuário criado com sucesso",
        description: `O usuário ${formData.fullName} foi adicionado ao sistema.`,
      });
      setIsCreateDialogOpen(false);
      resetForm();
      refetch(); // Recarregar a lista de usuários
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      toast({
        variant: "destructive",
        title: "Erro ao criar usuário",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao criar o usuário. Tente novamente.",
      });
    }
  };

  // Função para atualizar um usuário existente
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      // 1. Preparar os dados do usuário (sem horários)
      const userData = { ...formData };
      if (formData.password) {
        userData.passwordHash = formData.password;
      }
      const { password, ...userDataToSend } = userData;
      
      // 2. Atualizar os dados do usuário
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userDataToSend),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao atualizar usuário');
      }
      
      // 3. Preparar e salvar os horários
      const horariosData = diasSelecionados.map((selecionado, idx) =>
        selecionado ? { dia: diasSemana[idx], ...horarios[idx] } : null
      ).filter(Boolean);
      
      console.log('[DEBUG] Dias selecionados (edição):', diasSelecionados);
      console.log('[DEBUG] Horários originais (edição):', horarios);
      console.log('[DEBUG] Horários formatados para atualização:', horariosData);
      
      if (horariosData.length > 0) {
        try {
          const payload = JSON.stringify(horariosData);
          console.log('[DEBUG] Payload JSON sendo enviado (edição):', payload);
          
          // 4. Salvar horários usando o endpoint específico
          const horariosResponse = await fetch(`/api/horarios-usuario/${selectedUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });
          
          console.log('[DEBUG] Status da resposta de horários (edição):', horariosResponse.status);
          
          const responseText = await horariosResponse.text();
          console.log('[DEBUG] Resposta completa (edição):', responseText);
          
          if (!horariosResponse.ok) {
            console.error('[DEBUG] Erro ao salvar horários (edição):', responseText);
            // Não interrompe o fluxo, apenas loga o erro
          } else {
            console.log('[DEBUG] Horários salvos com sucesso (edição):', responseText);
            
            // Verificar se os horários foram realmente salvos
            const verificacaoResponse = await fetch(`/api/horarios-usuario/${selectedUser.id}`);
            const horariosVerificados = await verificacaoResponse.json();
            console.log('[DEBUG] Verificação de horários salvos (edição):', horariosVerificados);
          }
        } catch (error) {
          console.error('[DEBUG] Exceção ao salvar horários (edição):', error);
        }
      } else {
        console.warn('[DEBUG] Nenhum horário selecionado para salvar na edição');
      }
      
      toast({
        title: "Usuário atualizado com sucesso",
        description: `As informações de ${formData.fullName} foram atualizadas.`,
      });
      setIsEditDialogOpen(false);
      resetForm();
      refetch();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar usuário",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar o usuário. Tente novamente.",
      });
    }
  };

  // Função para buscar resumo dos dados vinculados ao usuário
  const fetchUserDataSummary = async (userId: number) => {
    try {
      const response = await fetch(`/api/users/${userId}/data-summary`);
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do usuário');
      }
      const data = await response.json();
      setUserDataSummary(data);
      return data;
    } catch (error) {
      console.error('Erro ao buscar resumo de dados:', error);
      return null;
    }
  };

  // Função para transferir dados do usuário
  const handleTransferUserData = async () => {
    if (!selectedUser || !transferToUserId) return;
    
    try {
      const response = await fetch(`/api/users/${selectedUser.id}/transfer-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferToUserId: parseInt(transferToUserId) }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao transferir dados');
      }
      
      const result = await response.json();
      
      toast({
        title: "Dados transferidos com sucesso",
        description: `Todos os dados de ${selectedUser.fullName} foram transferidos para o usuário selecionado.`,
      });
      
      setIsTransferDialogOpen(false);
      setTransferToUserId("");
      setUserDataSummary(null);
      
      // Agora pode prosseguir com a exclusão
      await handleDeleteUserAfterTransfer();
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao transferir dados",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao transferir os dados.",
      });
    }
  };

  // Função para excluir usuário após transferência
  const handleDeleteUserAfterTransfer = async () => {
    if (!selectedUser) return;
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir usuário');
      }
      
      toast({
        title: "Usuário excluído com sucesso",
        description: `O usuário ${selectedUser.fullName} foi removido do sistema após transferência dos dados.`,
      });
      
      // Limpar todos os estados do diálogo
      setIsDeleteDialogOpen(false);
      setIsTransferDialogOpen(false);
      setSelectedUser(null);
      setTransferToUserId("");
      setUserDataSummary(null);
      
      refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir usuário",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao excluir o usuário.",
      });
    }
  };

  // Função original para excluir um usuário
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      // Enviar para a API
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        // Verificar se é erro de usuário não encontrado (já foi excluído)
        if (response.status === 404) {
          toast({
            title: "Usuário já foi excluído",
            description: "Este usuário já foi removido do sistema.",
          });
          // Limpar estados e atualizar lista
          setIsDeleteDialogOpen(false);
          setSelectedUser(null);
          refetch();
          return;
        }
        
        // Verificar se é erro de conflito (usuário tem dados relacionados)
        if (response.status === 409) {
          // Mostrar diálogo especial para conflito de dados
          toast({
            variant: "destructive",
            title: "Não é possível excluir usuário",
            description: responseData.message || "Este usuário possui dados relacionados no sistema.",
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  handleToggleUserStatus(selectedUser);
                }}
              >
                Desativar usuário
              </Button>
            ),
          });
          return;
        }
        
        throw new Error(responseData.message || 'Erro ao excluir usuário');
      }
      
      toast({
        title: "Usuário excluído com sucesso",
        description: `O usuário ${selectedUser.fullName} foi removido do sistema.`,
      });
      setIsDeleteDialogOpen(false);
      refetch(); // Recarregar a lista de usuários
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir usuário",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao excluir o usuário. Tente novamente.",
      });
    }
  };

  // Função para alternar o status de ativo/inativo de um usuário
  const handleToggleUserStatus = async (user: User) => {
    if (user.role === Role.MANAGER) {
      toast({
        variant: "destructive",
        title: "Ação não permitida",
        description: "Usuário com cargo Gestor não pode ser desativado.",
      });
      return;
    }
    try {
      const newStatus = !user.isActive;
      
      // Enviar para a API
      const response = await fetch(`/api/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao alterar status do usuário');
      }
      
      toast({
        title: `Usuário ${newStatus ? "ativado" : "desativado"}`,
        description: `${user.fullName} foi ${newStatus ? "ativado" : "desativado"} no sistema.`,
      });
      refetch(); // Recarregar a lista de usuários
    } catch (error) {
      
      toast({
        variant: "destructive",
        title: "Erro ao alterar status",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao alterar o status do usuário. Tente novamente.",
      });
    }
  };

  // Tradução do cargo para exibição
  const getRoleDisplay = (role: string) => {
    return role; // Não precisamos mais de tradução, pois Role já contém os valores corretos em português
  };

  const handleDiaSelecionado = (idx: number) => {
    const novosDias = [...diasSelecionados];
    novosDias[idx] = !novosDias[idx];
    setDiasSelecionados(novosDias);
  };
  const handleHorarioChange = (idx: number, campo: "inicio" | "fim", valor: string) => {
    const novosHorarios = [...horarios];
    novosHorarios[idx][campo] = valor;
    setHorarios(novosHorarios);
  };
  const handleDiaTodo = (idx: number) => {
    const novosHorarios = [...horarios];
    novosHorarios[idx].diaTodo = !novosHorarios[idx].diaTodo;
    setHorarios(novosHorarios);
  };

  // Verificar se o usuário atual tem permissão para gerenciar usuários
  useEffect(() => {
    if (currentUser?.role !== Role.MANAGER) {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
      });
    }
  }, [currentUser, toast]);

  if (currentUser?.role !== Role.MANAGER) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-[450px]">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Esta área é restrita para usuários com permissão de administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Você não tem permissão para visualizar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados para adicionar um novo usuário ao sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 flex flex-col gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input id="fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, "");
                  if (value.length > 11) value = value.slice(0, 11);
                  if (value.length > 6) value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
                  else if (value.length > 2) value = value.replace(/(\d{2})(\d{0,5})/, "($1) $2");
                  else value = value.replace(/(\d{0,2})/, "$1");
                  setFormData({ ...formData, phone: value });
                }} maxLength={15} />
              </div>
              <div>
                <Label htmlFor="department">Departamento</Label>
                <Select value={formData.department} onValueChange={(value) => {
                  const availableRoles = getRolesForDepartment(value);
                  setFormData({ 
                    ...formData, 
                    department: value as string,
                    role: availableRoles.length > 0 ? availableRoles[0] as string : formData.role 
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Department.GESTAO}>Gestão</SelectItem>
                    <SelectItem value={Department.MARKETING}>Marketing</SelectItem>
                    <SelectItem value={Department.VENDAS}>Vendas</SelectItem>
                    <SelectItem value={Department.ATENDIMENTO}>Atendimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="role">Cargo</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as string })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {getRolesForDepartment(formData.department).map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPasswordCreate ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="pr-10" />
                  <button type="button" onClick={() => setShowPasswordCreate((v) => !v)} className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none" tabIndex={-1}>
                    {showPasswordCreate ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="isActive">Ativo</Label>
                <div className="flex items-center space-x-2">
                  <Switch id="isActive" checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} />
                  <Label htmlFor="isActive">{formData.isActive ? "Sim" : "Não"}</Label>
                </div>
              </div>
              <div className="col-span-4 mt-4">
                <h4 className="font-semibold mb-3 text-md border-b pb-2">Dias da Semana</h4>
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {diasSemana.map((dia, idx) => (
                    <label
                      key={dia}
                      className={`flex items-center justify-center p-2 rounded-md cursor-pointer transition-colors ${
                        diasSelecionados[idx] 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={diasSelecionados[idx]}
                        onChange={() => handleDiaSelecionado(idx)}
                        className="sr-only"
                      />
                      {dia}
                    </label>
                  ))}
                </div>
                <div className="space-y-2">
                  {diasSelecionados.map((selecionado, idx) =>
                    selecionado ? (
                      <div key={idx} className="flex flex-wrap items-center gap-3 p-2 bg-muted/30 rounded-md">
                        <span className="font-medium min-w-[40px]">{diasSemana[idx]}</span>
                        <div className="flex flex-wrap gap-3 items-center">
                          <label className="flex items-center gap-2">
                            <span className="text-sm">Início:</span>
                            <input
                              type="time"
                              value={horarios[idx].inicio}
                              disabled={horarios[idx].diaTodo}
                              onChange={e => handleHorarioChange(idx, "inicio", e.target.value)}
                              className="border rounded px-2 py-1 disabled:opacity-50"
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            <span className="text-sm">Fim:</span>
                            <input
                              type="time"
                              value={horarios[idx].fim}
                              disabled={horarios[idx].diaTodo}
                              onChange={e => handleHorarioChange(idx, "fim", e.target.value)}
                              className="border rounded px-2 py-1 disabled:opacity-50"
                            />
                          </label>
                          <label className="flex items-center gap-2 ml-auto">
                            <input
                              type="checkbox"
                              checked={horarios[idx].diaTodo}
                              onChange={() => handleDiaTodo(idx)}
                              className="rounded"
                            />
                            <span className="text-sm">Dia todo</span>
                          </label>
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleCreateUser}>
                Adicionar Usuário
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableCaption></TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex justify-center items-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                      <span className="ml-2">Carregando usuários...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user: User) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleDisplay(user.role)}</TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div
                          className={`h-2.5 w-2.5 rounded-full mr-2 ${
                            user.isActive ? "bg-green-500" : "bg-red-500"
                          }`}
                        ></div>
                        {user.isActive ? "Ativo" : "Inativo"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleToggleUserStatus(user)}
                          disabled={user.role === Role.MANAGER}
                          title={user.role === Role.MANAGER ? "Usuário Gestor não pode ser desativado" : (user.isActive ? "Desativar usuário" : "Ativar usuário")}
                        >
                          {user.isActive ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEditClick(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteClick(user)}
                          disabled={user.role === Role.MANAGER}
                          title={user.role === Role.MANAGER ? "Usuário Gestor não pode ser excluído" : "Excluir usuário"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere os dados do usuário e clique em salvar para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-4">
            <div>
              <Label htmlFor="edit-username">
                Username
              </Label>
              <Input
                id="edit-username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-fullName">
                Nome Completo
              </Label>
              <Input
                id="edit-fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-email">
                E-mail
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">
                Telefone
              </Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-department">
                Departamento
              </Label>
              <Select
                value={formData.department}
                onValueChange={(value) => {
                  // Obter os cargos disponíveis para o departamento selecionado
                  const availableRoles = getRolesForDepartment(value);
                  // Atualizar o formulário com o novo departamento e primeiro cargo disponível
                  setFormData({ 
                    ...formData, 
                    department: value as string,
                    role: availableRoles.length > 0 ? availableRoles[0] as string : formData.role 
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Department.GESTAO}>Gestão</SelectItem>
                  <SelectItem value={Department.MARKETING}>Marketing</SelectItem>
                  <SelectItem value={Department.VENDAS}>Vendas</SelectItem>
                  <SelectItem value={Department.ATENDIMENTO}>Atendimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="edit-role">
                Cargo
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as string })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {/* Exibir apenas os cargos disponíveis para o departamento selecionado */}
                  {getRolesForDepartment(formData.department).map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="edit-password">
                Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                  placeholder="Deixe em branco para manter a atual"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-isActive">
                Ativo
              </Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="edit-isActive">
                  {formData.isActive ? "Sim" : "Não"}
                </Label>
              </div>
            </div>
            <div className="col-span-4 mt-4">
              <h4 className="font-semibold mb-3 text-md border-b pb-2">Dias da Semana</h4>
              <div className="grid grid-cols-7 gap-1 mb-3">
                {diasSemana.map((dia, idx) => (
                  <label
                    key={dia}
                    className={`flex items-center justify-center p-2 rounded-md cursor-pointer transition-colors ${
                      diasSelecionados[idx] 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={diasSelecionados[idx]}
                      onChange={() => handleDiaSelecionado(idx)}
                      className="sr-only"
                    />
                    {dia}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                {diasSelecionados.map((selecionado, idx) =>
                  selecionado ? (
                    <div key={idx} className="flex flex-wrap items-center gap-3 p-2 bg-muted/30 rounded-md">
                      <span className="font-medium min-w-[40px]">{diasSemana[idx]}</span>
                      <div className="flex flex-wrap gap-3 items-center">
                        <label className="flex items-center gap-2">
                          <span className="text-sm">Início:</span>
                          <input
                            type="time"
                            value={horarios[idx].inicio}
                            disabled={horarios[idx].diaTodo}
                            onChange={e => handleHorarioChange(idx, "inicio", e.target.value)}
                            className="border rounded px-2 py-1 disabled:opacity-50"
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <span className="text-sm">Fim:</span>
                          <input
                            type="time"
                            value={horarios[idx].fim}
                            disabled={horarios[idx].diaTodo}
                            onChange={e => handleHorarioChange(idx, "fim", e.target.value)}
                            className="border rounded px-2 py-1 disabled:opacity-50"
                          />
                        </label>
                        <label className="flex items-center gap-2 ml-auto">
                          <input
                            type="checkbox"
                            checked={horarios[idx].diaTodo}
                            onChange={() => handleDiaTodo(idx)}
                            className="rounded"
                          />
                          <span className="text-sm">Dia todo</span>
                        </label>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateUser}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedUser && (
              <p>
                Você está prestes a excluir o usuário <strong>{selectedUser.fullName}</strong> do sistema.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Transferência de Dados */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Transferir Dados do Usuário</DialogTitle>
            <DialogDescription>
              Este usuário possui dados vinculados no sistema. Selecione outro usuário para transferir todos os dados antes da exclusão.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {selectedUser && userDataSummary && (
              <div className="space-y-3">
                <p className="font-medium">
                  Dados vinculados a <strong>{selectedUser.fullName}</strong>:
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {userDataSummary.leads > 0 && (
                    <div className="flex justify-between">
                      <span>Leads:</span>
                      <span className="font-medium">{userDataSummary.leads}</span>
                    </div>
                  )}
                  {userDataSummary.clientes > 0 && (
                    <div className="flex justify-between">
                      <span>Clientes:</span>
                      <span className="font-medium">{userDataSummary.clientes}</span>
                    </div>
                  )}
                  {userDataSummary.appointments > 0 && (
                    <div className="flex justify-between">
                      <span>Agendamentos:</span>
                      <span className="font-medium">{userDataSummary.appointments}</span>
                    </div>
                  )}
                  {userDataSummary.visits > 0 && (
                    <div className="flex justify-between">
                      <span>Visitas:</span>
                      <span className="font-medium">{userDataSummary.visits}</span>
                    </div>
                  )}
                  {userDataSummary.sales > 0 && (
                    <div className="flex justify-between">
                      <span>Vendas:</span>
                      <span className="font-medium">{userDataSummary.sales}</span>
                    </div>
                  )}
                  {userDataSummary.notes > 0 && (
                    <div className="flex justify-between">
                      <span>Anotações:</span>
                      <span className="font-medium">{userDataSummary.notes}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="transfer-user">Transferir para o usuário:</Label>
                  <Select value={transferToUserId} onValueChange={setTransferToUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o usuário destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.filter(user => user.id !== selectedUser.id && user.isActive).map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.fullName} ({user.username}) - {user.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                  <p className="text-sm text-amber-700">
                    <strong>Atenção:</strong> Todos os dados vinculados serão transferidos para o usuário selecionado. 
                    Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsTransferDialogOpen(false);
                setTransferToUserId("");
                setUserDataSummary(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleTransferUserData}
              disabled={!transferToUserId}
            >
              Transferir e Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
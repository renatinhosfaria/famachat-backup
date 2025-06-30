import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneNumber } from "@/lib/utils";
import { formatAppointment, formatAppointments, FormattedAppointment } from "@/lib/appointment-utils";
import { formatDatePreserveTime, formattedDate, formatDateOnlyDay, formatSaleDate, formatCPF, formatCurrency } from "@/lib/date-utils";
import { ClienteStatus, Cliente, Appointment, User, Visit, ClienteNote, Sale } from "@shared/schema";
import { AgendamentoDialog } from "@/components/clientes/agendamento-dialog";
import { AppointmentEditDialog } from "@/components/clientes/appointment-edit-dialog";
import { VisitaDialog } from "@/components/clientes/visita-dialog";
import { VendaDialog } from "@/components/clientes/venda-dialog";
import { SaleEditDialog } from "@/components/clientes/sale-edit-dialog";
import { VisitEditDialog } from "@/components/clientes/visit-edit-dialog";
import { ClienteNoteDialog } from "@/components/clientes/cliente-note-dialog";
import { ClienteNoteEditDialog } from "@/components/clientes/cliente-note-edit-dialog";

import { ProfileAvatar } from "@/components/clientes/profile-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  ArrowLeft, 
  Home, 
  Clock, 
  User as UserIcon,
  CalendarDays,
  Calendar as CalendarIcon,
  Building,
  StickyNote,
  PenLine,
  ChevronRight,
  BarChart4,
  Trash2,
  MessageSquare,
  MessageSquareX,
  MoreHorizontal,
  UserCircle,
  Pencil,
  MoreVertical,
  Edit,
  Check,
  CheckCheck,
  CheckCircle,
  X
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { date } from "zod";

export default function ClienteDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const clienteId = parseInt(id);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  // Dados locais do cliente para garantir atualizações imediatas
  const [localCliente, setLocalCliente] = useState<Cliente | null>(null);

  // Estado para controlar diálogos
  const [agendamentoDialogOpen, setAgendamentoDialogOpen] = useState(false);
  const [visitaDialogOpen, setVisitaDialogOpen] = useState(false);
  const [vendaDialogOpen, setVendaDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editAppointmentDialogOpen, setEditAppointmentDialogOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [editVisitDialogOpen, setEditVisitDialogOpen] = useState(false);

  // Estados para os diálogos de edição
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editSourceDialogOpen, setEditSourceDialogOpen] = useState(false);
  const [editPhoneDialogOpen, setEditPhoneDialogOpen] = useState(false);
  const [editEmailDialogOpen, setEditEmailDialogOpen] = useState(false);
  const [editConsultantDialogOpen, setEditConsultantDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editNoteDialogOpen, setEditNoteDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ClienteNote | null>(null);
  
  // Estados para o diálogo de edição de venda
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editSaleDialogOpen, setEditSaleDialogOpen] = useState(false);
  const [deleteSaleDialogOpen, setDeleteSaleDialogOpen] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);


  // Estados para os valores temporários dos campos editáveis
  const [tempName, setTempName] = useState("");
  const [tempSource, setTempSource] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [tempEmail, setTempEmail] = useState("");
  const [tempConsultantId, setTempConsultantId] = useState<number>();
  const [tempBrokerId, setTempBrokerId] = useState<number>();
  const [editBrokerDialogOpen, setEditBrokerDialogOpen] = useState(false);

  // Estado para notificação de status após atualização de agendamento
  const [statusNotification, setStatusNotification] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: '' });

  // Remover o estado local dos agendamentos formatados já que estamos usando useMemo agora

  // Buscar dados do cliente
  const { data: clienteData, isLoading, isError, refetch } = useQuery<Cliente>({
    queryKey: [`/api/clientes/${clienteId}`],
    enabled: !!clienteId && !isNaN(clienteId),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Atualizar o estado local quando os dados chegam da API
  useEffect(() => {
    if (clienteData) {
      setLocalCliente(clienteData);
    }
  }, [clienteData]);

  // Use os dados do estado local ou os dados da query
  const cliente = localCliente || clienteData;

  // Estado local do cliente é atualizado quando os dados chegam da API

  // Buscar usuários para obter nome do consultor
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 10 * 60 * 1000, // 10 minutos
    enabled: !!cliente?.assignedTo,
  });

  // Buscar compromissos relacionados ao cliente
  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: [`/api/appointments`, { clienteId }],
    enabled: !!clienteId && !isNaN(clienteId),
  });

  // Buscar visitas relacionadas ao cliente
  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: [`/api/visits`, { clienteId }],
    enabled: !!clienteId && !isNaN(clienteId),
  });

  // Buscar anotações relacionadas ao cliente
  const { data: clienteNotes = [] } = useQuery<ClienteNote[]>({
    queryKey: [`/api/clientes/${clienteId}/notes`],
    enabled: !!clienteId && !isNaN(clienteId),
  });
  
  // Buscar vendas relacionadas ao cliente
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: [`/api/sales`, { clienteId }],
    enabled: !!clienteId && !isNaN(clienteId),
  });

  // Atualizar status do cliente
  async function updateClienteStatus(newStatus: string) {
    if (updating || !localCliente) return;

    try {
      setUpdating(true);
      await apiRequest({
        url: `/api/clientes/${clienteId}`,
        method: "PATCH",
        body: { status: newStatus },
      });

      // Atualizar o estado local imediatamente para refletir a mudança
      const updatedCliente = { ...localCliente, status: newStatus };
      setLocalCliente(updatedCliente);

      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });

      toast({
        title: "Status atualizado",
        description: `O status do cliente foi atualizado para "${newStatus}"`,
      });
    } catch (error) {
      
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  }

  // Preparar edição de campo
  function handleEditStart(field: string) {
    if (updating || !typedCliente) return;

    // Definir valores temporários com valores atuais
    switch (field) {
      case 'name':
        setTempName(typedCliente.fullName);
        setEditNameDialogOpen(true);
        break;
      case 'source':
        setTempSource(typedCliente.source || '');
        setEditSourceDialogOpen(true);
        break;
      case 'phone':
        setTempPhone(typedCliente.phone || '');
        setEditPhoneDialogOpen(true);
        break;
      case 'email':
        setTempEmail(typedCliente.email || '');
        setEditEmailDialogOpen(true);
        break;
      case 'consultant':
        setTempConsultantId(typedCliente.assignedTo || undefined);
        setEditConsultantDialogOpen(true);
        break;
      case 'broker':
        setTempBrokerId(typedCliente.brokerId || undefined);
        setEditBrokerDialogOpen(true);
        break;
    }
  }

  // Salvar campo editado
  async function updateClienteField(field: string, value: any) {
    if (updating || !localCliente) return;

    try {
      setUpdating(true);

      const updateData: any = {};
      updateData[field] = value;

      const response = await apiRequest({
        url: `/api/clientes/${clienteId}`,
        method: "PATCH",
        body: updateData,
      });

      // Atualizar o estado local imediatamente para refletir a mudança
      const updatedCliente = { ...localCliente };

      if (field === 'phone') {
        updatedCliente.phone = value;
      } else if (field === 'fullName') {
        updatedCliente.fullName = value;
      } else if (field === 'email') {
        updatedCliente.email = value;
      } else if (field === 'source') {
        updatedCliente.source = value;
      } else if (field === 'assignedTo') {
        updatedCliente.assignedTo = value;
      } else if (field === 'brokerId') {
        updatedCliente.brokerId = value;
      }

      // Atualizar estado local
      setLocalCliente(updatedCliente);

      // Atualizar cache para outras partes da aplicação
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });

      // Forçar recarregamento para garantir sincronização
      refetch();

      toast({
        title: "Cliente atualizado",
        description: "As informações do cliente foram atualizadas com sucesso.",
      });

      // Resetar estados de edição
      setEditNameDialogOpen(false);
      setEditSourceDialogOpen(false);
      setEditPhoneDialogOpen(false);
      setEditEmailDialogOpen(false);
      setEditConsultantDialogOpen(false);
      setEditBrokerDialogOpen(false);

    } catch (error) {
      
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as informações do cliente",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  }

  // Voltar para a listagem de clientes
  function handleBack() {
    navigate("/clientes");
  }

  // Função para abrir diálogo de edição de agendamento
  function handleEditAppointment(appointment: Appointment) {
    setSelectedAppointment(appointment);
    setEditAppointmentDialogOpen(true);
  }

  // Função para abrir diálogo de edição de visita
  function handleEditVisit(visit: Visit) {
    setSelectedVisit(visit);
    setEditVisitDialogOpen(true);
  }

  // Função para excluir agendamento diretamente (sem abrir diálogo)
  async function handleDeleteAppointment(appointmentId: number) {
    try {
      // Exibir confirmação antes de excluir
      if (!window.confirm("Tem certeza que deseja excluir este agendamento?")) {
        return;
      }

      // Excluir o agendamento
      await apiRequest({
        url: `/api/appointments/${appointmentId}`,
        method: "DELETE",
      });

      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: [`/api/appointments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/appointments`, { clienteId }] });

      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi excluído com sucesso.",
      });

    } catch (error) {
      toast({
        title: "Erro ao excluir agendamento",
        description: "Não foi possível excluir o agendamento. Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  }

  // Função para excluir visita diretamente (sem abrir diálogo)
  async function handleDeleteVisit(visitId: number) {
    try {
      // Exibir confirmação antes de excluir
      if (!window.confirm("Tem certeza que deseja excluir esta visita?")) {
        return;
      }

      // Excluir a visita
      await apiRequest({
        url: `/api/visits/${visitId}`,
        method: "DELETE",
      });

      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: [`/api/visits`] });
      queryClient.invalidateQueries({ queryKey: [`/api/visits`, { clienteId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}`] });

      toast({
        title: "Visita excluída",
        description: "A visita foi excluída com sucesso.",
      });

    } catch (error) {
      toast({
        title: "Erro ao excluir visita",
        description: "Não foi possível excluir a visita. Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  }

  // Função para editar uma anotação de cliente
  function handleEditNote(note: ClienteNote) {
    setSelectedNote(note);
    setEditNoteDialogOpen(true);
  }

  // Função para excluir uma anotação de cliente
  async function handleDeleteNote(noteId: number) {
    try {
      // Exibir confirmação antes de excluir
      if (!window.confirm("Tem certeza que deseja excluir esta anotação?")) {
        return;
      }

      // Excluir a anotação
      await apiRequest({
        url: `/api/clientes/notes/${noteId}`,
        method: "DELETE",
      });

      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}/notes`] });

      toast({
        title: "Anotação excluída",
        description: "A anotação foi excluída com sucesso.",
      });

    } catch (error) {
      toast({
        title: "Erro ao excluir anotação",
        description: "Não foi possível excluir a anotação. Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  }

  // Função para atualizar o status do agendamento
  async function handleUpdateAppointmentStatus(appointmentId: number, newStatus: string) {
    try {
      

      // Atualizar o status do agendamento localmente para feedback imediato
      queryClient.setQueryData([`/api/appointments`, { clienteId }], (oldData: any) => {
        if (!oldData) return oldData;
        return (oldData as Appointment[]).map(appointment => 
          appointment.id === appointmentId 
            ? { ...appointment, status: newStatus } 
            : appointment
        );
      });

      // Fazer requisição para atualizar o status no servidor
      const response = await apiRequest({
        url: `/api/appointments/${appointmentId}`,
        method: "PATCH",
        body: { status: newStatus },
      });

      

      // Atualizar cache para garantir sincronização com o servidor
      queryClient.invalidateQueries({ queryKey: [`/api/appointments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/appointments`, { clienteId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}`] });

      // Mostrar notificação de sucesso com status atualizado
      let statusMessage = "";
      switch (newStatus) {
        case "Confirmado":
          statusMessage = "confirmado";
          break;
        case "Cancelado":
          statusMessage = "cancelado";
          break;
        case "Não foi":
          statusMessage = "marcado como não comparecido";
          break;
        default:
          statusMessage = "atualizado";
      }

      toast({
        title: "Status atualizado",
        description: `O agendamento foi ${statusMessage} com sucesso.`,
      });

      // Mostrar notificação persistente de status atualizado
      setStatusNotification({
        visible: true,
        message: `O agendamento foi ${statusMessage} com sucesso.`
      });

      // Esconder a notificação após 5 segundos
      setTimeout(() => {
        setStatusNotification({ visible: false, message: '' });
      }, 5000);

    } catch (error) {
      
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível atualizar o status do agendamento. Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  }

  // Função para editar uma venda
  function handleEditSale(saleId: number) {
    const sale = sales.find((s) => s.id === saleId);
    if (sale) {
      setSelectedSale(sale);
      setEditSaleDialogOpen(true);
    }
  }

  // Função para excluir uma venda
  async function handleDeleteSale(saleId: number) {
    try {
      // Exibir confirmação antes de excluir
      if (!window.confirm("Tem certeza que deseja excluir esta venda?")) {
        return;
      }

      console.log(`Iniciando exclusão da venda ${saleId}`);

      // Excluir a venda
      const response = await apiRequest({
        url: `/api/sales/${saleId}`,
        method: "DELETE",
      });

      console.log(`Resposta da exclusão:`, response);

      // Remover a venda do cache local imediatamente para feedback instantâneo
      queryClient.setQueryData([`/api/sales`, { clienteId }], (oldData: any) => {
        if (!oldData) return [];
        return (oldData as Sale[]).filter(sale => sale.id !== saleId);
      });

      // Atualizar todos os caches relacionados
      queryClient.invalidateQueries({ queryKey: [`/api/sales`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sales`, { clienteId }] });

      toast({
        title: "Venda excluída",
        description: "A venda foi excluída com sucesso.",
      });

    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      toast({
        title: "Erro ao excluir venda",
        description: "Não foi possível excluir a venda. Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  }

  // Função para excluir cliente
  async function handleDeleteCliente() {
    if (updating || !clienteId) return;

    try {
      setUpdating(true);

      await apiRequest({
        url: `/api/clientes/${clienteId}`,
        method: "DELETE",
      });

      // Se não houve exceção, consideramos que a operação foi bem-sucedida
      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });

      toast({
        title: "Cliente excluído",
        description: "O cliente foi excluído com sucesso.",
      });

      // Redirecionar para a lista de clientes
      navigate("/clientes");
    } catch (error) {
      
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cliente",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
      setDeleteDialogOpen(false);
    }
  }

  // Gerar iniciais para o avatar
  function getInitials(name: string) {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  // Renderizar carregamento
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-10 w-40 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="md:col-span-2 h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar erro
  if (isError || !cliente) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center mb-4">
              <span className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-500 mb-4">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <h3 className="text-lg font-medium">Erro ao carregar dados do cliente</h3>
              <p className="text-gray-500 mt-2">Verifique se o ID é válido ou tente novamente mais tarde.</p>
            </div>
            <Button onClick={handleBack} variant="default" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista de clientes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dados do cliente digitado
  const typedCliente = cliente as Cliente;

  // Função para extrair o primeiro nome
  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  // Procurar o consultor responsável
  const assignedUser = (users as User[]).find((user: User) => user.id === typedCliente.assignedTo);
  const assignedToName = assignedUser ? getFirstName(assignedUser.fullName) : "Não atribuído";

  // Procurar o corretor atribuído
  const brokerUser = (users as User[]).find((user: User) => user.id === typedCliente.brokerId);
  const brokerName = brokerUser ? brokerUser.username : "Não atribuído";

  // Formatar data de criação
  const formattedCreatedAt = typedCliente.createdAt ? formatDatePreserveTime(typedCliente.createdAt) : "Data não disponível";

  // Formatar agendamentos com funções simples, sem Hooks
  const formattedAppointments = formatAppointments(appointments as Appointment[]) as FormattedAppointment[];

  // Formatar visitas para exibição diretamente
  const formattedVisits = (visits as Visit[]).map((visit: Visit) => {
    // Usar a data da visita do banco, mas ajustar para o fuso horário do Brasil (+3 horas)
    const visitDateUtc = visit.visitedAt ? new Date(visit.visitedAt) : new Date();

    // Ajustar para o fuso horário do Brasil (UTC-3)
    const visitDate = new Date(visitDateUtc);
    visitDate.setHours(visitDateUtc.getUTCHours());

    const day = format(visitDate, 'dd');
    const monthAbbr = format(visitDate, 'MMM');
    const time = format(visitDate, 'HH:mm');

    // Formatar a data de criação
    const createdDate = visit.createdAt ? new Date(visit.createdAt) : new Date();
    // Não precisamos mais ajustar o fuso horário, usar a data diretamente
    const createdDateFormatted = format(createdDate, "dd/MM/yyyy HH:mm");

    // Procurar o nome do usuário que registrou a visita
    const user = (users as User[]).find(u => u.id === visit.userId);
    const userName = user ? user.username : "Usuário não identificado";

    // Extração do endereço da propriedade
    let property = visit.propertyId;
    if (property.startsWith('visita-')) {
      property = "Endereço não registrado";
    }

    return {
      ...visit,
      day,
      monthAbbr,
      time,
      userName,
      formattedDate: (visit.visitedAt || visit.createdAt)?.toString() || "", // Usar data bruta do banco como string
      property,
      createdDateFormatted
    };
  });
  
  // Formatar vendas para exibição
  const formattedSales = (sales as Sale[]).map((sale: Sale) => {
    // Usar a data da venda do banco
    const saleDate = sale.soldAt ? new Date(sale.soldAt) : new Date();
    
    // Formatar a data para exibição
    const day = format(saleDate, 'dd');
    const monthAbbr = format(saleDate, 'MMM');
    const time = format(saleDate, 'HH:mm');
    
    // Formatar o valor da venda (R$ 250.000,00)
    const valueNumber = Number(sale.value);
    const formattedValue = valueNumber.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    // Procurar o nome do consultor
    const consultant = (users as User[]).find(u => u.id === sale.consultantId);
    const consultantName = consultant ? consultant.username : "Não identificado";
    
    // Procurar o nome do corretor
    const broker = (users as User[]).find(u => u.id === sale.brokerId);
    const brokerName = broker ? broker.username : "Não identificado";
    
    // Formatar a data no formato "Data da Venda: DD/MM/YYYY" (sem hora)
    const formattedDateString = formatSaleDate(sale.soldAt);
    
    // Formatar valores monetários usando as funções de utilidade
    const formattedCommission = formatCurrency(sale.commission);
    const formattedBonus = formatCurrency(sale.bonus);
    const formattedTotalCommission = formatCurrency(sale.totalCommission);
    
    return {
      ...sale,
      type: 'sale',
      day,
      monthAbbr,
      time,
      formattedValue,
      consultantName,
      brokerName,
      formattedDate: formattedDateString,
      commission: formattedCommission,
      bonus: formattedBonus,
      totalCommission: formattedTotalCommission,
      // Data para ordenação
      sortDate: new Date(sale.soldAt).getTime()
    };
  });

  // Próximo compromisso (se houver)
  const sortedAppointments = [...formattedAppointments].sort((a, b) => {
    const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return dateA - dateB;
  });

  const nextAppointment = sortedAppointments.length > 0 ? sortedAppointments[0] : null;

  return (
    <>
      <div className="container mx-auto p-3 xxs:p-4 sm:p-6">
        {/* Notificação de status */}
        {statusNotification.visible && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4 flex items-center justify-between animate-in fade-in duration-300">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <p className="text-green-700">{statusNotification.message}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setStatusNotification({ visible: false, message: '' })}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Cabeçalho e navegação */}
        <div className="grid grid-cols-3 md:flex md:flex-row md:justify-between md:items-center gap-3 mb-4 xxs:mb-6">
          <div className="flex items-center col-span-2 md:col-span-1">
            <Button variant="outline" size="sm" onClick={handleBack} className="text-xs xxs:text-sm px-2 xxs:px-3 py-1 xxs:py-2 h-8 xxs:h-9 sm:h-10" title="Voltar">
              <ArrowLeft className="h-3 w-3 xxs:h-4 xxs:w-4 sm:mr-1" /> 
              <span className="hidden sm:inline ml-1">Voltar</span>
            </Button>
          </div>
          <div className="hidden md:flex"></div>
          <div className="flex justify-end gap-2 col-span-1 md:col-span-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs xxs:text-sm px-2 xxs:px-3 py-1 xxs:py-2 h-8 xxs:h-9 sm:h-10"
              onClick={() => setDeleteDialogOpen(true)}
              title="Excluir Cliente"
            >
              <Trash2 className="h-3 w-3 xxs:h-4 xxs:w-4 sm:mr-1" />
              <span className="hidden sm:inline ml-1">Excluir</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xxs:gap-6">
          {/* Coluna da esquerda - Perfil do cliente */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2 xxs:pb-3">
              <CardTitle className="text-base xxs:text-lg">Perfil do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="p-3 xxs:p-6">
              <div className="flex flex-col items-center mb-4 xxs:mb-6">
                <ProfileAvatar 
                  name={typedCliente.fullName}
                  clienteId={typedCliente.id}
                  size="xl"
                />
                <div className="flex items-center gap-2 mt-3 xxs:mt-4">
                  <h2 className="text-lg xxs:text-xl font-semibold text-center">{typedCliente.fullName}</h2>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 xxs:h-6 xxs:w-6" 
                    title="Editar nome"
                    onClick={() => handleEditStart('name')}
                  >
                    <PenLine className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs xxs:text-sm">{typedCliente.source || "Origem não especificada"}</Badge>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 xxs:h-5 xxs:w-5" 
                    title="Editar origem"
                    onClick={() => handleEditStart('source')}
                  >
                    <PenLine className="h-2 w-2 xxs:h-3 xxs:w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3 xxs:space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xs xxs:text-sm font-medium text-muted-foreground">Informações de Contato</h3>
                  <div className="space-y-2 xxs:space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 xxs:h-4 xxs:w-4 mr-2 xxs:mr-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs xxs:text-sm">{typedCliente.phone ? formatPhoneNumber(typedCliente.phone) : "Não informado"}</span>
                          {typedCliente.hasWhatsapp === true && (
                            <span title="Cliente tem WhatsApp">
                              <FaWhatsapp 
                                className="h-3 w-3 xxs:h-4 xxs:w-4 ml-1 xxs:ml-2 text-green-600" 
                              />
                            </span>
                          )}
                          {typedCliente.hasWhatsapp === false && (
                            <span title="Cliente não tem WhatsApp">
                              <MessageSquareX 
                                className="h-3 w-3 xxs:h-4 xxs:w-4 ml-1 xxs:ml-2 text-red-400" 
                                aria-label="Cliente não tem WhatsApp"
                              />
                            </span>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 xxs:h-6 xxs:w-6 flex-shrink-0" 
                        title="Editar telefone" 
                        onClick={() => handleEditStart('phone')}
                      >
                        <PenLine className="h-2 w-2 xxs:h-3 xxs:w-3" />
                      </Button>
                    </div>
                    {typedCliente.email && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1 min-w-0">
                          <Mail className="h-3 w-3 xxs:h-4 xxs:w-4 mr-2 xxs:mr-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs xxs:text-sm truncate">{typedCliente.email}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 xxs:h-6 xxs:w-6 flex-shrink-0" 
                          title="Editar email" 
                          onClick={() => handleEditStart('email')}
                        >
                          <PenLine className="h-2 w-2 xxs:h-3 xxs:w-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <UserIcon className="h-3 w-3 xxs:h-4 xxs:w-4 mr-2 xxs:mr-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs xxs:text-sm">CPF: {typedCliente.cpf ? formatCPF(typedCliente.cpf) : "Não informado"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs xxs:text-sm font-medium text-muted-foreground">Interesse</h3>
                  <div className="space-y-2 xxs:space-y-3">
                    {/* Propriedades de interesse que podem não existir dependendo da estrutura do banco de dados */}
                    {(typedCliente as any).interestType && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <Building className="h-3 w-3 xxs:h-4 xxs:w-4 mr-2 xxs:mr-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs xxs:text-sm">{(typedCliente as any).interestType}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5 xxs:h-6 xxs:w-6" title="Editar tipo de interesse">
                          <PenLine className="h-2 w-2 xxs:h-3 xxs:w-3" />
                        </Button>
                      </div>
                    )}
                    {(typedCliente as any).interest && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <Home className="h-3 w-3 xxs:h-4 xxs:w-4 mr-2 xxs:mr-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs xxs:text-sm">{(typedCliente as any).interest}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5 xxs:h-6 xxs:w-6" title="Editar interesse">
                          <PenLine className="h-2 w-2 xxs:h-3 xxs:w-3" />
                        </Button>
                      </div>
                    )}
                    {(typedCliente as any).location && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <MapPin className="h-3 w-3 xxs:h-4 xxs:w-4 mr-2 xxs:mr-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs xxs:text-sm">{(typedCliente as any).location}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5 xxs:h-6 xxs:w-6" title="Editar localização">
                          <PenLine className="h-2 w-2 xxs:h-3 xxs:w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs xxs:text-sm font-medium text-muted-foreground">Informações Adicionais</h3>
                  <div className="space-y-2 xxs:space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1 min-w-0">
                        <UserIcon className="h-3 w-3 xxs:h-4 xxs:w-4 mr-2 xxs:mr-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs xxs:text-sm truncate">Consultor de Atendimento: {assignedUser ? assignedUser.username : "Não atribuído"}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 xxs:h-6 xxs:w-6 flex-shrink-0" 
                        title="Editar consultor" 
                        onClick={() => handleEditStart('consultant')}
                      >
                        <PenLine className="h-2 w-2 xxs:h-3 xxs:w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1 min-w-0">
                        <UserIcon className="h-3 w-3 xxs:h-4 xxs:w-4 mr-2 xxs:mr-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs xxs:text-sm truncate">Corretor: {brokerName}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 xxs:h-6 xxs:w-6 flex-shrink-0"
                        title="Editar corretor"
                        onClick={() => handleEditStart('broker')}
                      >
                        <PenLine className="h-2 w-2 xxs:h-3 xxs:w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center">
                      <CalendarIcon className="h-3 w-3 xxs:h-4 xxs:w-4 mr-2 xxs:mr-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs xxs:text-sm">Cadastrado em: {formattedCreatedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 xxs:pt-3">
                  <h3 className="text-xs xxs:text-sm font-medium text-muted-foreground mb-2">Status atual</h3>
                  <Select 
                    defaultValue={typedCliente.status ? String(typedCliente.status) : "Novo"} 
                    onValueChange={updateClienteStatus}
                    disabled={updating}
                  >
                    <SelectTrigger className="w-full text-xs xxs:text-sm">
                      <SelectValue placeholder="Selecionar status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ClienteStatus).map((status) => (
                        <SelectItem key={status} value={status} className="text-xs xxs:text-sm">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Coluna da direita - Atividades e Histórico */}
          <div className="lg:col-span-2 space-y-4 xxs:space-y-6">
            {/* Card de ações rápidas */}
            <Card>
              <CardHeader className="pb-2 xxs:pb-3">
                <CardTitle className="text-base xxs:text-lg">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="p-3 xxs:p-6">
                <div className="grid grid-cols-3 md:grid-cols-3 gap-1 xxs:gap-2 sm:gap-3">
                  <Button 
                    className="w-full bg-[#00ABD1] hover:bg-[#0096b7] text-white text-xs xxs:text-sm px-1 xxs:px-2 sm:px-3 py-1 xxs:py-2 h-8 xxs:h-9 sm:h-10" 
                    onClick={() => setAgendamentoDialogOpen(true)}
                    title="Agendamento"
                  >
                    <CalendarDays className="h-3 w-3 xxs:h-4 xxs:w-4 sm:mr-1" />
                    <span className="hidden sm:inline ml-1">Agendamento</span>
                  </Button>
                  <Button 
                    className="w-full bg-[#00ABD1] hover:bg-[#0096b7] text-white text-xs xxs:text-sm px-1 xxs:px-2 sm:px-3 py-1 xxs:py-2 h-8 xxs:h-9 sm:h-10"
                    onClick={() => setVisitaDialogOpen(true)}
                    title="Visita"
                  >
                    <Home className="h-3 w-3 xxs:h-4 xxs:w-4 sm:mr-1" />
                    <span className="hidden sm:inline ml-1">Visita</span>
                  </Button>
                  <Button 
                    className="w-full bg-[#00ABD1] hover:bg-[#0096b7] text-white text-xs xxs:text-sm px-1 xxs:px-2 sm:px-3 py-1 xxs:py-2 h-8 xxs:h-9 sm:h-10"
                    onClick={() => setVendaDialogOpen(true)}
                    title="Venda"
                  >
                    <BarChart4 className="h-3 w-3 xxs:h-4 xxs:w-4 sm:mr-1" />
                    <span className="hidden sm:inline ml-1">Venda</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Próximo compromisso removido - todas as informações agora aparecem apenas no histórico */}

            {/* Histórico do cliente unificado */}
            <Card>
              <CardHeader className="pb-2 xxs:pb-3">
                <div className="grid grid-cols-3 md:flex md:flex-row md:items-center md:justify-between gap-3 mb-3 xxs:mb-4">
                  <CardTitle className="text-base xxs:text-lg col-span-2 md:col-span-1">Histórico do Cliente</CardTitle>
                  <div className="hidden md:flex"></div>
                  <div className="flex justify-end col-span-1 md:col-span-1">
                    <Button 
                      className="bg-[#00ABD1] hover:bg-[#0096b7] text-white w-full md:w-auto md:max-w-[220px] text-xs xxs:text-sm px-2 xxs:px-3 py-1 xxs:py-2 h-8 xxs:h-9 sm:h-10"
                      onClick={() => setNoteDialogOpen(true)}
                      title="Adicionar Anotação"
                    >
                      <StickyNote className="h-3 w-3 xxs:h-4 xxs:w-4 sm:mr-1" /> 
                      <span className="hidden sm:inline ml-1">Anotação</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-3 xxs:p-6">
                {formattedAppointments.length === 0 && formattedVisits.length === 0 && formattedSales.length === 0 && clienteNotes.length === 0 ? (
                  <div className="text-center py-8 xxs:py-12 border rounded-md bg-muted/30">
                    <Calendar className="h-8 w-8 xxs:h-12 xxs:w-12 mx-auto text-muted-foreground mb-2 xxs:mb-3" />
                    <h3 className="text-base xxs:text-lg font-medium mb-1 xxs:mb-2">Nenhuma atividade registrada</h3>
                    <p className="text-muted-foreground text-xs xxs:text-sm">
                      Não há compromissos, visitas, vendas ou anotações registradas para este cliente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 xxs:space-y-6">
                    <h3 className="text-xs xxs:text-sm font-medium text-muted-foreground">
                      {formattedAppointments.length + formattedVisits.length + clienteNotes.length + formattedSales.length} atividades encontradas
                    </h3>

                    <div className="space-y-2 xxs:space-y-3">
                      {/* Criar um array combinado de compromissos, visitas, vendas e anotações */}
                      {[
                        // Mapear compromissos com um tipo para identificação
                        ...formattedAppointments.map((appointment: FormattedAppointment) => {
                          // Usar a data de atualização como string
                          const updateDate = (appointment.updatedAt || appointment.createdAt || '').toString();
                          // Extrair a data diretamente da string para preservar o horário original


                          // Usar a data exatamente como vem do banco, sem formatar

                          // Formatar a data para DD/MM/YYYY HH:MM sem ajuste de fuso horário
                          // Extrair os valores diretamente da string ISO 8601 que vem do banco
                          let formattedDateString = "";
                          if (appointment.scheduledAt) {
                            const rawDate = appointment.scheduledAt.toString();
                            // Formato esperado: 2025-04-30T10:00:00.000Z
                            const dateParts = rawDate.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                            if (dateParts) {
                              const [_, year, month, day, hours, minutes] = dateParts;
                              // Manter o horário UTC original
                              formattedDateString = `${day}/${month}/${year} ${hours}:${minutes}`;
                            } else {
                              // Fallback para método padrão se o formato não for o esperado
                              const scheduledDate = new Date(appointment.scheduledAt);
                              formattedDateString = scheduledDate.toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              });
                            }
                          } else {
                            formattedDateString = "Data não definida";
                          }

                          return {
                            ...appointment,
                            type: 'appointment',
                            formattedCreatedAt: updateDate, // Mantendo o nome do campo por compatibilidade
                            formattedDate: formattedDateString, // Data formatada como DD/MM/YYYY HH:MM
                            rawScheduledAt: format(appointment.scheduledAt, 'dd/MM/yyyy HH:mm'),// Manter o valor original da string
                            // Usar a data de atualização para ordenação
                            sortDate: new Date(updateDate).getTime()
                          };
                        }),
                        // Mapear visitas com um tipo para identificação
                        ...formattedVisits.map((visit: Visit & {day: string; monthAbbr: string; time: string; userName: string; formattedDate: string; property: string}) => {
                          const updateDate = (visit.updatedAt || visit.createdAt || '').toString();

                          // Formatar a data da visita mantendo exatamente como está no banco
                          let formattedVisitDateString = "";
                          if (visit.visitedAt) {
                            const visitDate = visit.visitedAt.toString();
                            const dateParts = visitDate.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                            if (dateParts) {
                              const [_, year, month, day, hours, minutes] = dateParts;
                              // Manter o horário UTC original
                              formattedVisitDateString = `${day}/${month}/${year} ${hours}:${minutes}`;
                            } else {
                              formattedVisitDateString = visitDate;
                            }
                          } else {
                            formattedVisitDateString = "Data não definida";
                          }

                          return {
                            ...visit,
                            type: 'visit',
                            formattedDate: formattedVisitDateString, // Data formatada como DD/MM/YYYY HH:MM
                            formattedUpdatedAt: updateDate, // Campo formatado para exibir a data de atualização
                            // Usar a data de atualização para ordenação
                            sortDate: new Date(updateDate).getTime()
                          };
                        }),
                        // Mapear anotações com um tipo para identificação
                        // Mapear vendas com um tipo para identificação
                        ...formattedSales.map((sale: any) => {
                          return {
                            ...sale,
                            type: 'sale',
                            // Já temos o sortDate criado no formattedSales
                          };
                        }),
                        
                        ...clienteNotes.map((note: ClienteNote) => {
                          // Usar a data exatamente como vem do banco, tratando como string
                          const updateDate = (note.updatedAt || note.createdAt || '').toString();


                          // Buscar usuário que criou a anotação
                          const user = (users as User[]).find(u => u.id === note.userId);
                          const userName = user ? user.username : "Usuário não identificado";

                          // Formatar a data para DD/MM/YYYY HH:MM usando o updated_at
                          let formattedNoteDateString = "";
                          if (note.updatedAt) {
                            const rawDate = note.updatedAt.toString();
                            // Formato esperado: 2025-04-16T13:53:08.447
                            const dateParts = rawDate.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                            if (dateParts) {
                              const [_, year, month, day, hours, minutes] = dateParts;
                              // Manter o horário UTC original
                              formattedNoteDateString = `${day}/${month}/${year} ${hours}:${minutes}`;
                            } else {
                              // Fallback para método padrão se o formato não for o esperado
                              const noteDate = new Date(note.updatedAt);
                              formattedNoteDateString = noteDate.toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              });
                            }
                          } else {
                            formattedNoteDateString = "Data não definida";
                          }

                          return {
                            ...note,
                            type: 'note',
                            userName,
                            formattedDate: formattedNoteDateString, // Data formatada como DD/MM/YYYY HH:MM
                            rawDate: note.createdAt, // Preservar data original
                            // Usar a data de atualização para ordenação
                            sortDate: new Date(updateDate).getTime(),
                            updatedAt: updateDate
                          };
                        })
                      ]
                      // Ordenar todos os itens por data, do mais recente para o mais antigo
                      .sort((a, b) => b.sortDate - a.sortDate)
                      .map((item: any) => {
                        // Renderizar com base no tipo
                        if (item.type === 'appointment') {
                          return (
                            <div 
                              key={`appointment-${item.id}`}
                              className="flex flex-col p-2 xxs:p-3 border rounded-md hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 xxs:gap-2 flex-1 min-w-0">
                                  <Calendar className="h-4 w-4 xxs:h-5 xxs:w-5 text-[#00ABD1] flex-shrink-0" />
                                  <h4 className="font-medium text-sm xxs:text-base">Agendamento</h4>
                                  <Badge variant={
                                    item.status === "Concluído" ? "default" :
                                    item.status === "Cancelado" ? "destructive" : 
                                    "outline"
                                  } className="text-xs">
                                    {item.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {(item.status === "Agendado" || item.status === "Confirmado") && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 xxs:h-8 xxs:w-8"
                                          title="Alterar status"
                                        >
                                          <MoreVertical className="h-3 w-3 xxs:h-4 xxs:w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuLabel className="text-xs xxs:text-sm">Alterar Status</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {item.status === "Agendado" && (
                                          <DropdownMenuItem
                                            onClick={() => handleUpdateAppointmentStatus(item.id, "Confirmado")}
                                            className="text-green-600 text-xs xxs:text-sm"
                                          >
                                            <Check className="mr-2 h-3 w-3 xxs:h-4 xxs:w-4" />
                                            Confirmar
                                          </DropdownMenuItem>
                                        )}
                                        {item.status === "Confirmado" && (
                                          <DropdownMenuItem
                                            onClick={() => handleUpdateAppointmentStatus(item.id, "Não foi")}
                                            className="text-orange-600 text-xs xxs:text-sm"
                                          >
                                            <X className="mr-2 h-3 w-3 xxs:h-4 xxs:w-4" />
                                            Não foi
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          onClick={() => handleUpdateAppointmentStatus(item.id, "Cancelado")}
                                          className="text-red-600 text-xs xxs:text-sm"
                                        >
                                          <X className="mr-2 h-3 w-3 xxs:h-4 xxs:w-4" />
                                          Cancelar
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}

                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 xxs:h-8 xxs:w-8"
                                    title="Editar agendamento"
                                    onClick={() => {
                                      const originalAppointment = appointments.find(a => a.id === item.id);
                                      if (originalAppointment) {
                                        handleEditAppointment(originalAppointment);
                                      }
                                    }}
                                  >
                                    <Edit className="h-3 w-3 xxs:h-4 xxs:w-4" />
                                  </Button>

                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 xxs:h-8 xxs:w-8 text-red-500"
                                    title="Excluir agendamento"
                                    onClick={() => handleDeleteAppointment(item.id)}
                                  >
                                    <Trash2 className="h-3 w-3 xxs:h-4 xxs:w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="ml-5 xxs:ml-7 mt-1">
                                <div className="mt-1 xxs:mt-2">
                                  <h3 className="font-medium text-sm xxs:text-base">{item.title}</h3>
                                  <div className="text-xs xxs:text-sm text-muted-foreground mb-1">
                                    {item.formattedDate}
                                  </div>
                                  <p className="text-xs xxs:text-sm text-muted-foreground">{item.address || item.location || "Local não especificado"}</p>
                                  {item.notes && (
                                    <p className="text-xs xxs:text-sm mt-1">{item.notes}</p>
                                  )}
                                  <div className="text-xs text-muted-foreground text-right mt-1 xxs:mt-2">
                                    <Calendar className="h-2 w-2 xxs:h-3 xxs:w-3 inline mr-1" /> Última atualização: {formatDatePreserveTime(item.updatedAt || item.createdAt)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        } else if (item.type === 'visit') {
                          return (
                            <div 
                              key={`visit-${item.id}`}
                              className="flex flex-col p-2 xxs:p-3 border rounded-md hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 xxs:gap-2">
                                  <Home className="h-4 w-4 xxs:h-5 xxs:w-5 text-[#00ABD1] flex-shrink-0" />
                                  <h4 className="font-medium text-sm xxs:text-base">Visita</h4>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 xxs:h-8 xxs:w-8"
                                    title="Editar visita"
                                    onClick={() => handleEditVisit(item as Visit)}
                                  >
                                    <Edit className="h-3 w-3 xxs:h-4 xxs:w-4" />
                                  </Button>

                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 xxs:h-8 xxs:w-8 text-red-500"
                                    title="Excluir visita"
                                    onClick={() => handleDeleteVisit(item.id)}
                                  >
                                    <Trash2 className="h-3 w-3 xxs:h-4 xxs:w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="ml-5 xxs:ml-7 mt-1">
                                <div className="mt-1 xxs:mt-2">
                                  <div className="text-xs xxs:text-sm text-muted-foreground mb-1">
                                    {item.formattedDate}
                                  </div>

                                  {item.temperature !== undefined && (
                                    <div className="mt-1 xxs:mt-2">
                                      <p className="text-xs xxs:text-sm">
                                        <span className="font-medium">Temperatura da Visita: </span>
                                        {item.temperature === 1 
                                          ? "Muito Frio" 
                                          : item.temperature === 2 
                                            ? "Frio" 
                                            : item.temperature === 3 
                                              ? "Morno" 
                                              : item.temperature === 4 
                                                ? "Quente" 
                                                : item.temperature === 5 
                                                  ? "Muito Quente" 
                                                  : `${item.temperature}/5`}
                                      </p>
                                    </div>
                                  )}

                                  {item.visitDescription && (
                                    <div className="mt-1 xxs:mt-2">
                                      <p className="text-xs xxs:text-sm">
                                        <span className="font-medium">Como foi a visita: </span>
                                        {item.visitDescription}
                                      </p>
                                    </div>
                                  )}

                                  {item.nextSteps && (
                                    <div className="mt-1 xxs:mt-2">
                                      <p className="text-xs xxs:text-sm">
                                        <span className="font-medium">Qual o próximo passo: </span>
                                        {item.nextSteps}
                                      </p>
                                    </div>
                                  )}

                                  {item.notes && !item.temperature && !item.visitDescription && !item.nextSteps && (
                                    <p className="text-xs xxs:text-sm mt-1">{item.notes}</p>
                                  )}

                                  <div className="text-xs text-muted-foreground text-right mt-1 xxs:mt-2">
                                    <Calendar className="h-2 w-2 xxs:h-3 xxs:w-3 inline mr-1" /> Última atualização: {formatDatePreserveTime(item.updatedAt || item.visitedAt)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        } else if (item.type === 'sale') {
                          return (
                            <div 
                              key={`sale-${item.id}`}
                              className="flex flex-col p-2 xxs:p-3 border rounded-md hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 xxs:gap-2 flex-1 min-w-0">
                                  <BarChart4 className="h-4 w-4 xxs:h-5 xxs:w-5 text-green-600 flex-shrink-0" />
                                  <h4 className="font-medium text-sm xxs:text-base">Venda</h4>
                                  <Badge variant="default" className="bg-green-600 text-xs">
                                    {item.formattedValue}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 xxs:h-8 xxs:w-8"
                                    onClick={() => handleEditSale(item.id)}
                                    title="Editar venda"
                                  >
                                    <Edit className="h-3 w-3 xxs:h-4 xxs:w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 xxs:h-8 xxs:w-8 text-red-500"
                                    onClick={() => handleDeleteSale(item.id)}
                                    title="Excluir venda"
                                  >
                                    <Trash2 className="h-3 w-3 xxs:h-4 xxs:w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="ml-5 xxs:ml-7 mt-1">
                                <div className="mt-1 xxs:mt-2">
                                  <div className="text-xs xxs:text-sm text-muted-foreground mb-1">
                                    {item.formattedDate}
                                  </div>
                                  
                                  {/* CPF - Adicionado abaixo da data de venda */}
                                  {item.cpf && (
                                    <div className="mt-1">
                                      <p className="text-xs xxs:text-sm">
                                        <span className="font-medium">CPF: </span>
                                        {formatCPF(item.cpf)}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Tipo de Imóvel */}
                                  <div className="mt-1 xxs:mt-2">
                                    <p className="text-xs xxs:text-sm">
                                      <span className="font-medium">Tipo de Imóvel: </span>
                                      {item.propertyType === "Apto" ? "Apartamento" : 
                                        item.propertyType === "Casa" ? "Casa" : 
                                        item.propertyType === "Lote" ? "Lote" : item.propertyType || "Não especificado"}
                                    </p>
                                  </div>

                                  {/* Detalhes específicos do imóvel */}
                                  {item.propertyType === "Apto" && item.builderName && (
                                    <div className="mt-1">
                                      <p className="text-xs xxs:text-sm">
                                        <span className="font-medium">Construtora: </span>
                                        {item.builderName}
                                        {item.developmentName && `, ${item.developmentName}`}
                                        {item.block && `, Bloco ${item.block}`}
                                        {item.unit && `, Unidade ${item.unit}`}
                                      </p>
                                    </div>
                                  )}

                                  {item.propertyType === "Casa" && item.builderName && (
                                    <div className="mt-1">
                                      <p className="text-xs xxs:text-sm">
                                        <span className="font-medium">Vendedor: </span>
                                        {item.builderName}
                                      </p>
                                    </div>
                                  )}

                                  {/* Forma de Pagamento */}
                                  {item.paymentMethod && (
                                    <div className="mt-1">
                                      <p className="text-xs xxs:text-sm">
                                        <span className="font-medium">Pagamento: </span>
                                        {item.paymentMethod}
                                      </p>
                                    </div>
                                  )}

                                  {/* Comissões */}
                                  {(item.commission || item.bonus || item.totalCommission) && (
                                    <div className="mt-1 space-y-1">
                                      {item.commission && (
                                        <p className="text-xs xxs:text-sm">
                                          <span className="font-medium">Comissão: </span>
                                          {formatCurrency(item.commission)}
                                        </p>
                                      )}
                                      {item.bonus && item.bonus !== "0" && (
                                        <p className="text-xs xxs:text-sm">
                                          <span className="font-medium">Bônus: </span>
                                          {formatCurrency(item.bonus)}
                                        </p>
                                      )}
                                      {item.totalCommission && item.totalCommission !== "R$ 0,00" && (
                                        <p className="text-xs xxs:text-sm">
                                          <span className="font-medium">Comissão Total: </span>
                                          {formatCurrency(item.totalCommission)}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Responsáveis */}
                                  <div className="mt-1 xxs:mt-2">
                                    <p className="text-xs xxs:text-sm">
                                      <span className="font-medium">Consultor: </span>
                                      {item.consultantName}
                                    </p>
                                  </div>
                                  
                                  <div className="mt-1">
                                    <p className="text-xs xxs:text-sm">
                                      <span className="font-medium">Corretor: </span>
                                      {item.brokerName}
                                    </p>
                                  </div>

                                  {/* Observações */}
                                  {item.notes && (
                                    <div className="mt-1 xxs:mt-2">
                                      <p className="text-xs xxs:text-sm">
                                        <span className="font-medium">Observações: </span>
                                        {item.notes}
                                      </p>
                                    </div>
                                  )}
                                  
                                  <div className="text-xs text-muted-foreground text-right mt-1 xxs:mt-2">
                                    <Calendar className="h-2 w-2 xxs:h-3 xxs:w-3 inline mr-1" /> Última atualização: {formatDatePreserveTime(item.updatedAt || item.soldAt)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        } else if (item.type === 'note') {
                          return (
                            <div 
                              key={`note-${item.id}`}
                              className="flex flex-col p-2 xxs:p-3 border rounded-md hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 xxs:gap-2">
                                  <PenLine className="h-4 w-4 xxs:h-5 xxs:w-5 text-[#00ABD1] flex-shrink-0" />
                                  <h4 className="font-medium text-sm xxs:text-base">Anotação</h4>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 xxs:h-8 xxs:w-8"
                                    onClick={() => handleEditNote(clienteNotes.find(note => note.id === item.id) as ClienteNote)}
                                    title="Editar anotação"
                                  >
                                    <Edit className="h-3 w-3 xxs:h-4 xxs:w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 xxs:h-8 xxs:w-8 text-red-500"
                                    onClick={() => handleDeleteNote(item.id)}
                                    title="Excluir anotação"
                                  >
                                    <Trash2 className="h-3 w-3 xxs:h-4 xxs:w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="ml-5 xxs:ml-7 mt-1">
                                <div className="mt-1 xxs:mt-2">
                                  <p className="text-xs xxs:text-sm whitespace-pre-wrap">
                                    {item.text}
                                  </p>
                                  <div className="text-xs text-muted-foreground text-right mt-1 xxs:mt-2">
                                    <Calendar className="h-2 w-2 xxs:h-3 xxs:w-3 inline mr-1" /> Última atualização: {formatDatePreserveTime(item.updatedAt || item.rawDate)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Diálogos para ações */}
      <AgendamentoDialog 
        clienteId={clienteId}
        open={agendamentoDialogOpen}
        onOpenChange={setAgendamentoDialogOpen}
        assignedConsultantId={cliente?.assignedTo}
      />
      <VisitaDialog 
        clienteId={clienteId}
        open={visitaDialogOpen}
        onOpenChange={setVisitaDialogOpen}
      />
      <VendaDialog 
        clienteId={clienteId}
        open={vendaDialogOpen}
        onOpenChange={setVendaDialogOpen}
      />

      {/* Diálogo de edição de agendamento */}
      {selectedAppointment && (
        <AppointmentEditDialog 
          appointment={selectedAppointment}
          open={editAppointmentDialogOpen}
          onOpenChange={setEditAppointmentDialogOpen}
          onDelete={() => {
            // Recarregar a lista de agendamentos após a exclusão
            queryClient.invalidateQueries({ queryKey: [`/api/appointments`] });
            queryClient.invalidateQueries({ queryKey: [`/api/appointments`, { clienteId }] });
          }}
        />
      )}

      {/* Diálogo de edição de visita */}
      {selectedVisit && (
        <VisitEditDialog 
          visit={selectedVisit}
          isOpen={editVisitDialogOpen}
          onClose={() => setEditVisitDialogOpen(false)}
        />
      )}

      {/* Diálogos para edição */}
      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent className="max-w-md mx-4 xxs:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base xxs:text-lg">Editar Nome</DialogTitle>
            <DialogDescription className="text-xs xxs:text-sm">
              Atualize o nome completo do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 xxs:space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-xs xxs:text-sm">Nome completo</Label>
              <Input 
                id="edit-name" 
                value={tempName} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempName(e.target.value)} 
                placeholder="Nome completo do cliente"
                className="text-xs xxs:text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 xxs:gap-3">
            <Button variant="outline" onClick={() => setEditNameDialogOpen(false)} className="text-xs xxs:text-sm">
              <span className="sm:hidden">✕</span>
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
            <Button 
              onClick={() => updateClienteField('fullName', tempName)}
              disabled={!tempName.trim() || updating}
              className="text-xs xxs:text-sm"
            >
              <span className="sm:hidden">✓</span>
              <span className="hidden sm:inline">Salvar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSourceDialogOpen} onOpenChange={setEditSourceDialogOpen}>
        <DialogContent className="max-w-md mx-4 xxs:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base xxs:text-lg">Editar Origem</DialogTitle>
            <DialogDescription className="text-xs xxs:text-sm">
              Atualize a origem do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 xxs:space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-source" className="text-xs xxs:text-sm">Origem</Label>
              <Input 
                id="edit-source" 
                value={tempSource} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempSource(e.target.value)} 
                placeholder="Origem do cliente"
                className="text-xs xxs:text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 xxs:gap-3">
            <Button variant="outline" onClick={() => setEditSourceDialogOpen(false)} className="text-xs xxs:text-sm">
              <span className="sm:hidden">✕</span>
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
            <Button 
              onClick={() => updateClienteField('source', tempSource)}
              disabled={updating}
              className="text-xs xxs:text-sm"
            >
              <span className="sm:hidden">✓</span>
              <span className="hidden sm:inline">Salvar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPhoneDialogOpen} onOpenChange={setEditPhoneDialogOpen}>
        <DialogContent className="max-w-md mx-4 xxs:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base xxs:text-lg">Editar Telefone</DialogTitle>
            <DialogDescription className="text-xs xxs:text-sm">
              Atualize o número de telefone do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 xxs:space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-phone" className="text-xs xxs:text-sm">Telefone</Label>
              <PhoneInput 
                id="edit-phone" 
                value={tempPhone} 
                onChange={(value) => setTempPhone(value)} 
                placeholder="(00) 00000-0000"
                className="text-xs xxs:text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 xxs:gap-3">
            <Button variant="outline" onClick={() => setEditPhoneDialogOpen(false)} className="text-xs xxs:text-sm">
              <span className="sm:hidden">✕</span>
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
            <Button 
              onClick={() => updateClienteField('phone', tempPhone)}
              disabled={updating}
              className="text-xs xxs:text-sm"
            >
              <span className="sm:hidden">✓</span>
              <span className="hidden sm:inline">Salvar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editEmailDialogOpen} onOpenChange={setEditEmailDialogOpen}>
        <DialogContent className="max-w-md mx-4 xxs:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base xxs:text-lg">Editar E-mail</DialogTitle>
            <DialogDescription className="text-xs xxs:text-sm">
              Atualize o endereço de e-mail do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 xxs:space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-xs xxs:text-sm">E-mail</Label>
              <Input 
                id="edit-email" 
                type="email"
                value={tempEmail} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempEmail(e.target.value)} 
                placeholder="E-mail do cliente"
                className="text-xs xxs:text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 xxs:gap-3">
            <Button variant="outline" onClick={() => setEditEmailDialogOpen(false)} className="text-xs xxs:text-sm">
              <span className="sm:hidden">✕</span>
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
            <Button 
              onClick={() => updateClienteField('email', tempEmail)}
              disabled={updating}
              className="text-xs xxs:text-sm"
            >
              <span className="sm:hidden">✓</span>
              <span className="hidden sm:inline">Salvar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editConsultantDialogOpen} onOpenChange={setEditConsultantDialogOpen}>
        <DialogContent className="max-w-md mx-4 xxs:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base xxs:text-lg">Alterar Consultor</DialogTitle>
            <DialogDescription className="text-xs xxs:text-sm">
              Escolha outro consultor para este cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 xxs:space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-consultant" className="text-xs xxs:text-sm">Consultor</Label>
              <Select 
                value={tempConsultantId?.toString()} 
                onValueChange={(value) => setTempConsultantId(parseInt(value))}
              >
                <SelectTrigger className="text-xs xxs:text-sm">
                  <SelectValue placeholder="Selecione um consultor" />
                </SelectTrigger>
                <SelectContent>
                  {(users as User[]).map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()} className="text-xs xxs:text-sm">
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 xxs:gap-3">
            <Button variant="outline" onClick={() => setEditConsultantDialogOpen(false)} className="text-xs xxs:text-sm">
              <span className="sm:hidden">✕</span>
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
            <Button 
              onClick={() => updateClienteField('assignedTo', tempConsultantId)}
              disabled={!tempConsultantId || updating}
              className="text-xs xxs:text-sm"
            >
              <span className="sm:hidden">✓</span>
              <span className="hidden sm:inline">Salvar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para alteração de corretor */}
      <Dialog open={editBrokerDialogOpen} onOpenChange={setEditBrokerDialogOpen}>
        <DialogContent className="max-w-md mx-4 xxs:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base xxs:text-lg">Alterar Corretor</DialogTitle>
            <DialogDescription className="text-xs xxs:text-sm">
              Escolha outro corretor para este cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 xxs:space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-broker" className="text-xs xxs:text-sm">Corretor</Label>
              <Select 
                value={tempBrokerId?.toString()} 
                onValueChange={(value) => setTempBrokerId(parseInt(value))}
              >
                <SelectTrigger className="text-xs xxs:text-sm">
                  <SelectValue placeholder="Selecione um corretor" />
                </SelectTrigger>
                <SelectContent>
                  {(users as User[])
                    .filter((user) => user.role === "Corretor")
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()} className="text-xs xxs:text-sm">
                        {user.username}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 xxs:gap-3">
            <Button variant="outline" onClick={() => setEditBrokerDialogOpen(false)} className="text-xs xxs:text-sm">
              <span className="sm:hidden">✕</span>
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
            <Button 
              onClick={() => updateClienteField('brokerId', tempBrokerId)}
              disabled={!tempBrokerId || updating}
              className="text-xs xxs:text-sm"
            >
              <span className="sm:hidden">✓</span>
              <span className="hidden sm:inline">Salvar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação para exclusão de cliente */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md mx-4 xxs:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base xxs:text-lg">Excluir Cliente</DialogTitle>
            <DialogDescription className="text-xs xxs:text-sm">
              Você tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 xxs:space-y-4 py-2">
            <div className="p-2 xxs:p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-xs xxs:text-sm">
                Ao excluir este cliente, todos os dados relacionados como agendamentos, visitas e vendas também poderão ser afetados.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 xxs:gap-3">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="text-xs xxs:text-sm">
              <span className="sm:hidden">✕</span>
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteCliente}
              disabled={updating}
              className="text-xs xxs:text-sm"
            >
              <span className="sm:hidden">{updating ? "..." : "🗑️"}</span>
              <span className="hidden sm:inline">{updating ? "Excluindo..." : "Excluir Cliente"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para adicionar anotação ao cliente */}
      <ClienteNoteDialog 
        clienteId={clienteId}
        userId={currentUser?.id || 0}
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        onSuccess={() => {
          // Atualizar a lista de anotações
          toast({
            title: "Anotação adicionada",
            description: "A anotação foi adicionada com sucesso.",
          });
        }}
      />

      {/* Diálogo para editar anotação */}
      {selectedNote && (
        <ClienteNoteEditDialog 
          clienteId={clienteId}
          note={selectedNote}
          open={editNoteDialogOpen}
          onOpenChange={setEditNoteDialogOpen}
          onSuccess={() => {
            toast({
              title: "Anotação atualizada",
              description: "A anotação foi atualizada com sucesso.",
            });
          }}
        />
      )}
      
      {/* Diálogo de edição de venda */}
      {selectedSale && (
        <SaleEditDialog 
          sale={selectedSale}
          open={editSaleDialogOpen}
          onOpenChange={setEditSaleDialogOpen}
          onSuccess={() => {
            // Atualizar vendas após edição
            queryClient.invalidateQueries({ queryKey: [`/api/sales`] });
            queryClient.invalidateQueries({ queryKey: [`/api/sales`, { clienteId }] });
            toast({
              title: "Venda atualizada",
              description: "A venda foi atualizada com sucesso.",
            });
          }}
          onDelete={() => {
            // Atualizar vendas após exclusão
            queryClient.invalidateQueries({ queryKey: [`/api/sales`] });
            queryClient.invalidateQueries({ queryKey: [`/api/sales`, { clienteId }] });
          }}
        />
      )}
    </>
  );
}
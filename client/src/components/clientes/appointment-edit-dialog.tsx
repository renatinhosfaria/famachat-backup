import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { brazilFormDateToUTC, utcToFormFields, logDateInfo } from "@/lib/date-utils";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { AppointmentStatus, AppointmentType, User, Appointment } from "@shared/schema";

// Schema para validação do formulário
const formSchema = z.object({
  type: z.string(),
  status: z.string(),
  location: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  date: z.date(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Formato de hora inválido. Use o formato HH:MM",
  }),
  consultantId: z.number().optional(),
  brokerId: z.number().optional(),
});

type AppointmentEditProps = {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: () => void;
};

export function AppointmentEditDialog({ 
  appointment, 
  open, 
  onOpenChange,
  onDelete 
}: AppointmentEditProps) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();
  
  // Buscar usuários para as opções de consultores e corretores
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
  
  // Filtrar consultores e corretores
  const consultants = (users as User[]).filter(user => 
    user.role === "Consultor de Atendimento"
  );
  const brokers = (users as User[]).filter(user => user.role === "Corretor");

  // Preparar valores iniciais do formulário usando nossa função de separação de data/hora
  
  
  let date = new Date();
  let time = "09:00";
  
  if (appointment.scheduledAt) {
    // Usar nossa função utilitária para separar data e hora para o formulário
    const result = utcToFormFields(appointment.scheduledAt);
    date = result.date;
    time = result.time;
    
    // Log para depuração
    logDateInfo("Agendamento - data original", new Date(appointment.scheduledAt));
    logDateInfo("Agendamento - data para formulário", date);
    
  }
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: appointment.type,
      status: appointment.status,
      location: appointment.location || "",
      address: appointment.address || "",
      description: appointment.notes || "",
      date: date,
      time: time,
      consultantId: appointment.userId,
      brokerId: appointment.brokerId || undefined,
    }
  });

  // Atualizar os valores do formulário quando o agendamento mudar
  useEffect(() => {
    if (appointment && open) {
      // Usar nossa função de utilidade para obter data e hora adequadamente
      const { date, time } = utcToFormFields(appointment.scheduledAt);
      
      // Log para depuração
      logDateInfo("Agendamento atualizado - data form", date);
      
      
      form.reset({
        type: appointment.type,
        status: appointment.status,
        location: appointment.location || "",
        address: appointment.address || "",
        description: appointment.notes || "",
        date: date,
        time: time,
        consultantId: appointment.userId,
        brokerId: appointment.brokerId || undefined,
      });
    }
  }, [appointment, form, open]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      
      
      
      // Usar nossa função utilitária para criar a string de data no formato correto
      const dateStr = brazilFormDateToUTC(values.date, values.time);
      
      // Log para depuração
      logDateInfo("Agendamento - dados do formulário", values.date);
      logDateInfo("Agendamento - convertido para UTC", new Date(dateStr));
      
      // Extrair apenas os campos necessários para o servidor e remover date e time que são apenas para UI
      const { date, time, description, ...rest } = values;
      
      // Enviar scheduledAt como string formatada para preservar o horário informado pelo usuário
      const appointmentData = {
        ...rest,
        notes: description || "", // Garantir que notes seja enviado mesmo quando vazio
        scheduledAt: dateStr, // Usando nossa função utilitária para gerar a data
        clienteId: appointment.clienteId,
        userId: values.consultantId || currentUser?.id, // Usar o consultantId se disponível, senão o usuário atual (adicionado null check)
      };
      
      
      
      // Atualizar o agendamento
      await apiRequest({
        url: `/api/appointments/${appointment.id}`,
        method: "PUT",
        body: appointmentData,
      });
      
      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: [`/api/appointments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/appointments`, { clienteId: appointment.clienteId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${appointment.clienteId}`] });
      
      toast({
        title: "Agendamento atualizado",
        description: "O agendamento foi atualizado com sucesso.",
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao atualizar agendamento",
        description: "Não foi possível atualizar o agendamento. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      
      // Excluir o agendamento
      await apiRequest({
        url: `/api/appointments/${appointment.id}`,
        method: "DELETE",
      });
      
      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: [`/api/appointments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/appointments`, { clienteId: appointment.clienteId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${appointment.clienteId}`] });
      
      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi excluído com sucesso.",
      });
      
      // Chamar o callback de exclusão se fornecido
      if (onDelete) {
        onDelete();
      }
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao excluir agendamento",
        description: "Não foi possível excluir o agendamento. Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Agendamento</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Campos Tipo e Status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(AppointmentType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(AppointmentStatus).map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Os campos de consultor e corretor */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="consultantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consultor de Atendimento</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar consultor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {consultants.map((consultant) => (
                          <SelectItem key={consultant.id} value={consultant.id.toString()}>
                            {consultant.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="brokerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Corretor</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar corretor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {brokers.map((broker) => (
                          <SelectItem key={broker.id} value={broker.id.toString()}>
                            {broker.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecionar data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local</FormLabel>
                  <FormControl>
                    <Input placeholder="Local do agendamento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Endereço detalhado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalhes adicionais sobre o agendamento"
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex justify-between pt-2">
              <div className="flex gap-2">
                {showDeleteConfirm ? (
                  <>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={handleDelete}
                      disabled={isSubmitting}
                    >
                      Confirmar Exclusão
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isSubmitting}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isSubmitting}
                  >
                    Excluir
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
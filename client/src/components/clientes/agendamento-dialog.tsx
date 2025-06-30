import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { brazilFormDateToUTC, logDateInfo } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AppointmentType, AppointmentStatus, User, Role, Department } from "@shared/schema";

const formSchema = z.object({
  date: z.date({ required_error: "Por favor, selecione uma data" }),
  time: z.string().min(5, { message: "Por favor, informe o horário" }),
  location: z.string().min(3, { message: "Por favor, informe o local" }),
  address: z.string().min(3, { message: "Por favor, informe o endereço" }),
  description: z.string().optional(),
  type: z.string({ required_error: "Por favor, selecione o tipo" }),
  status: z.string({ required_error: "Por favor, selecione o status" }),
  consultantId: z.number({ required_error: "Por favor, selecione o consultor" }),
  brokerId: z.number({ required_error: "Por favor, selecione o corretor" }),
  title: z.string().optional(), // Título opcional, será gerado automaticamente no servidor
});

type AgendamentoProps = {
  clienteId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedConsultantId?: number | null; // ID do consultor atribuído ao cliente
};

export function AgendamentoDialog({ clienteId, open, onOpenChange, assignedConsultantId }: AgendamentoProps) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  
  // Buscar usuários para as opções de consultores e corretores
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
  
  // Filtrar consultores e corretores
  const consultants = (users as User[]).filter(user => 
    user.role === Role.CONSULTANT
  );
  const brokers = (users as User[]).filter(user => 
    user.department === Department.VENDAS && 
    (user.role === Role.BROKER_SENIOR || 
     user.role === Role.BROKER_JUNIOR || 
     user.role === Role.BROKER_TRAINEE || 
     user.role === Role.EXECUTIVE)
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      time: "",
      location: "",
      address: "",
      description: "",
      type: AppointmentType.VISIT,
      status: AppointmentStatus.SCHEDULED,
      consultantId: assignedConsultantId !== null ? assignedConsultantId : undefined,
      brokerId: undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);
      
      // O título será gerado automaticamente pelo servidor com base no tipo e horário
      
      // Garantir que temos o ID do usuário atual
      if (!currentUser?.id) {
        toast({
          title: "Erro ao criar agendamento",
          description: "Você precisa estar logado para criar um agendamento.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Log para debug - verificar qual ID de usuário está sendo utilizado
      

      // Combinar a data e hora em um único valor para scheduledAt
      // Usando a função de utilitário para garantir que o horário seja enviado corretamente
      // considerando o fuso horário do Brasil
      const dateStr = brazilFormDateToUTC(values.date, values.time);
      
      // Log para depuração
      logDateInfo("Agendamento - dados do formulário", values.date);
      logDateInfo("Agendamento - convertido para UTC", new Date(dateStr));
      
      // Extrair apenas os campos necessários para o servidor e remover date e time que são apenas para UI
      const { date, time, ...rest } = values;
      
      // Enviar scheduledAt como string formatada para preservar o horário informado pelo usuário
      const appointmentData = {
        ...rest,
        notes: values.description || "", // Garantir que notes seja enviado mesmo quando vazio
        scheduledAt: dateStr, // Enviar no formato 'YYYY-MM-DD HH:MM:SS' para preservar o horário local
        clienteId,
        userId: currentUser.id, // Adicionar o ID do usuário atual
      };
      
      
      
      // Primeiro criar o agendamento
      await apiRequest({
        url: "/api/appointments",
        method: "POST",
        body: appointmentData,
      });
      
      // Atualizar o corretor e o status do cliente para "Agendamento"
      await apiRequest({
        url: `/api/clientes/${clienteId}`,
        method: "PATCH",
        body: { 
          brokerId: values.brokerId || undefined, 
          status: "Agendamento" // Mover automaticamente para a etapa Agendamento
        },
      });
      
      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: [`/api/appointments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes`] }); // Atualizar lista geral de clientes
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/all`] }); // Atualizar lista completa para o Kanban
      
      toast({
        title: "Agendamento criado",
        description: "O agendamento foi criado com sucesso.",
      });
      
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao criar agendamento",
        description: "Não foi possível criar o agendamento. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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
                        {Object.values(AppointmentStatus)
                          .filter(status => status !== AppointmentStatus.COMPLETED)
                          .map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))
                        }
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
                            {consultant.fullName}
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
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  date: z.date({ required_error: "Por favor, selecione uma data" }),
  time: z.string().min(5, { message: "Por favor, informe o horário" }),
  temperature: z.string().min(1, { message: "Por favor, selecione a temperatura da visita" }),
  visitResult: z.string().min(3, { message: "Por favor, informe como foi a visita" }),
  nextSteps: z.string().min(3, { message: "Por favor, informe qual o próximo passo" }),
});

type VisitaProps = {
  clienteId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function VisitaDialog({ clienteId, open, onOpenChange, onSuccess }: VisitaProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      time: "",
      temperature: "",
      visitResult: "",
      nextSteps: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Combinar a data e hora para criar um timestamp completo
      const dateStr = format(values.date, "yyyy-MM-dd");
      const timeStr = values.time;
      
      // Criar objeto Date com a data e hora especificadas
      const localDate = new Date(`${dateStr}T${timeStr}:00`);
      
      // IMPORTANTE: Precisamos garantir que o horário inserido pelo usuário
      // seja o horário exato armazenado no UTC sem dupla conversão.
      // Quando o usuário insere 11:00, não queremos que vire 14:00 UTC
      
      // Criamos uma data com a hora local específica
      const utcYear = localDate.getFullYear();
      const utcMonth = localDate.getMonth();
      const utcDay = localDate.getDate();
      const localHours = parseInt(timeStr.split(':')[0]);
      const localMinutes = parseInt(timeStr.split(':')[1]);
      
      // Criamos uma data UTC onde a hora UTC corresponde à hora local desejada
      const utcDate = new Date(Date.UTC(utcYear, utcMonth, utcDay, localHours, localMinutes, 0));
      
      // Converter para string ISO para armazenamento no banco
      const visitedAtStr = utcDate.toISOString();
      
      // Obter o ID do usuário atualmente logado
      const userId = currentUser?.id || 1; // Fallback para o ID 1 (Renato) se não estiver logado
      
      const visitData = {
        clienteId,
        userId, // Enviamos o ID do usuário explicitamente
        propertyId: `visita-${Date.now()}`, // Um ID único para a propriedade visitada
        visitedAt: visitedAtStr,
        // Usar os novos campos separados criados na migração
        temperature: parseInt(values.temperature), // Converter string para número
        visitDescription: values.visitResult,
        nextSteps: values.nextSteps,
        // Mantemos a nota em formato legado para compatibilidade com visitas antigas
        notes: `Temperatura: ${
          values.temperature === "1" 
            ? "Muito Frio" 
            : values.temperature === "2" 
              ? "Frio" 
              : values.temperature === "3" 
                ? "Morno" 
                : values.temperature === "4" 
                  ? "Quente" 
                  : values.temperature === "5" 
                    ? "Muito Quente" 
                    : `${values.temperature}/5`
        }\n\nResultado: ${values.visitResult}\n\nPróximos passos: ${values.nextSteps}`,
      };
      
      await apiRequest({
        url: "/api/visits",
        method: "POST",
        body: visitData,
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/visits`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}`] });
      
      toast({
        title: "Visita registrada",
        description: "A visita foi registrada com sucesso.",
      });
      
      form.reset();
      onOpenChange(false);
      
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Erro ao registrar visita",
        description: "Não foi possível registrar a visita. Verifique os dados e tente novamente.",
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
          <DialogTitle>Registrar Visita</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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
              name="temperature"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="font-medium text-lg">Temperatura da Visita</FormLabel>
                  <FormControl>
                    <div className="bg-gradient-to-r from-blue-100 via-purple-50 to-red-100 rounded-lg p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1 text-blue-600">
                          <span className="text-sm font-semibold">FRIO</span>
                        </div>
                        <div className="flex items-center gap-1 text-red-600">
                          <span className="text-sm font-semibold">QUENTE</span>
                        </div>
                      </div>
                      
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col"
                      >
                        <div className="flex justify-between items-center relative">
                          {/* Linha colorida de gradiente */}
                          <div className="absolute top-3 left-4 right-4 h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 rounded-full"></div>
                          
                          {/* Botões de rádio */}
                          <div className="flex w-full justify-between relative z-10">
                            <div className="flex flex-col items-center">
                              <RadioGroupItem value="1" id="temp-1" className="mb-2 h-6 w-6 border-blue-500 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600" />
                              <span className="text-xs font-medium text-center w-16">Muito Frio</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <RadioGroupItem value="2" id="temp-2" className="mb-2 h-6 w-6 border-blue-400 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500" />
                              <span className="text-xs font-medium text-center w-12">Frio</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <RadioGroupItem value="3" id="temp-3" className="mb-2 h-6 w-6 border-purple-400 data-[state=checked]:border-purple-500 data-[state=checked]:bg-purple-500" />
                              <span className="text-xs font-medium text-center w-12">Morno</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <RadioGroupItem value="4" id="temp-4" className="mb-2 h-6 w-6 border-red-400 data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500" />
                              <span className="text-xs font-medium text-center w-12">Quente</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <RadioGroupItem value="5" id="temp-5" className="mb-2 h-6 w-6 border-red-500 data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600" />
                              <span className="text-xs font-medium text-center w-16">Muito Quente</span>
                            </div>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visitResult"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Como foi a visita?</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva como foi a visita, interesses manifestados, etc." {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextSteps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qual o próximo passo?</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva quais serão os próximos passos a serem seguidos" {...field} rows={2} />
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
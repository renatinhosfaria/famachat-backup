import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Visit } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { brazilFormDateToUTC, logDateInfo } from "@/lib/date-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const visitSchema = z.object({
  notes: z.string().optional(),
  temperature: z.string().optional(),
  result: z.string().optional(),
  nextSteps: z.string().optional(),
  visitDate: z.date().optional(),
  visitTime: z.string().optional(),
});

type FormValues = z.infer<typeof visitSchema>;

interface VisitEditDialogProps {
  visit: Visit;
  isOpen: boolean;
  onClose: () => void;
}

export function VisitEditDialog({ visit, isOpen, onClose }: VisitEditDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse visit data from fields or legacy notes
  const parseVisitData = (visit: Visit) => {
    try {
      // Primeiro verificamos se temos os novos campos
      if (visit.temperature !== undefined || visit.visitDescription || visit.nextSteps) {
        // Preferimos usar os novos campos se disponíveis
        return {
          notes: visit.notes || "",
          temperature: visit.temperature !== undefined ? String(visit.temperature) : "",
          result: visit.visitDescription || "",
          nextSteps: visit.nextSteps || ""
        };
      }
      
      // Fallback: Se não temos os novos campos, extraímos da nota como antes
      // Formato esperado: "Temperatura: X/5\n\nResultado: Y\n\nPróximos passos: Z"
      const notesText = visit.notes || "";
      
      // Extrair temperatura (queremos apenas o número)
      let temperature = "";
      const tempMatch = notesText.match(/Temperatura:\s*(\d+)\/5/i);
      if (tempMatch && tempMatch[1]) {
        temperature = tempMatch[1].trim();
      }
      
      // Extrair resultado
      let result = "";
      const resultMatch = notesText.match(/Resultado:\s*([^\n]+)/i);
      if (resultMatch && resultMatch[1]) {
        result = resultMatch[1].trim();
      }
      
      // Extrair próximos passos
      let nextSteps = "";
      const nextStepsMatch = notesText.match(/Próximos passos:\s*(.*)/i);
      if (nextStepsMatch && nextStepsMatch[1]) {
        nextSteps = nextStepsMatch[1].trim();
      }
      
      return {
        notes: notesText,
        temperature, // Agora é apenas o número para o RadioGroup
        result,
        nextSteps
      };
    } catch (e) {
      // Em caso de erro, retorne valores vazios
      return {
        notes: visit.notes || "",
        temperature: "",
        result: "",
        nextSteps: ""
      };
    }
  };

  const parsedData = parseVisitData(visit);

  // Extrair data e hora da visita sem conversão de timezone
  const visitDateUtc = visit.visitedAt ? new Date(visit.visitedAt) : new Date();
  
  // Extrair os componentes da data diretamente da string ISO
  const match = visitDateUtc.toISOString().match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  const [_, year, month, day, hours, minutes] = match || [];
  
  // Criar data local sem ajuste de timezone
  const visitDate = new Date(Number(year), Number(month) - 1, Number(day));
  
  const formattedDate = format(visitDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  
  // Usar as horas e minutos extraídos diretamente
  const visitTimeString = `${hours}:${minutes}`;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      notes: parsedData.notes,
      temperature: parsedData.temperature,
      result: parsedData.result,
      nextSteps: parsedData.nextSteps,
      visitDate: visitDate,
      visitTime: visitTimeString
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Formatar os dados da visita para o campo notes (compatibilidade)
      const formattedNotes = `Temperatura: ${
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
                  : values.temperature 
                    ? `${values.temperature}/5` 
                    : "Não informada"
      }\n\nResultado: ${values.result || ""}\n\nPróximos passos: ${values.nextSteps || ""}`;
      
      // Combinar a data e hora para criar um timestamp completo
      let updatedVisitedAt = undefined;
      
      if (values.visitDate && values.visitTime) {
        // Usar a função utilitária para converter da forma correta
        updatedVisitedAt = brazilFormDateToUTC(values.visitDate, values.visitTime);
        
        // Log para depuração
        logDateInfo("Visita atualizada - formulário", new Date(`${format(values.visitDate, "yyyy-MM-dd")}T${values.visitTime}:00`));
        logDateInfo("Visita atualizada - convertida para UTC", new Date(updatedVisitedAt));
      }
      
      // Preparar dados para atualização - usando os novos campos separados
      const updateData = {
        // Campos novos separados
        temperature: values.temperature ? parseInt(values.temperature) : undefined,
        visitDescription: values.result,
        nextSteps: values.nextSteps,
        // Manter campo de notas formatado para compatibilidade com versões anteriores
        notes: formattedNotes,
        // Incluir a data atualizada se houver
        ...(updatedVisitedAt && { visitedAt: updatedVisitedAt })
      };
      
      // Atualizar a visita
      await apiRequest({
        url: `/api/visits/${visit.id}`,
        method: "PATCH",
        body: updateData,
      });
      
      // Invalidar queries para atualizar a UI
      queryClient.invalidateQueries({ queryKey: [`/api/visits`] });
      queryClient.invalidateQueries({ queryKey: [`/api/visits`, { clienteId: visit.clienteId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${visit.clienteId}`] });
      
      toast({
        title: "Visita atualizada",
        description: "Os detalhes da visita foram atualizados com sucesso.",
      });
      
      // Fechar o diálogo
      onClose();
    } catch (error) {
      
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a visita. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Usar a data formatada para exibição no diálogo

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Detalhes da Visita</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="visitDate"
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
                name="visitTime"
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
                        value={field.value || ""}
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
              name="result"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Como foi a visita?</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva como foi a visita, interesses manifestados, etc." 
                      {...field} 
                      rows={3} 
                    />
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
                    <Textarea 
                      placeholder="Descreva quais serão os próximos passos a serem seguidos" 
                      {...field} 
                      rows={2} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
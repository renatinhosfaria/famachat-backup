import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

// Função para ajustar a data para o fuso horário do Brasil (UTC-3)
// Isso evita que o PostgreSQL adicione 3 horas quando converter para UTC
function adjustDateForTimezone(date: Date): Date {
  const adjustedDate = new Date(date);
  adjustedDate.setHours(date.getHours() - 3);
  return adjustedDate;
};
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { CurrencyInput } from "@/components/custom/currency-input";

// Definir o tipo Sale sem a coluna metadata
interface Sale {
  id: number;
  consultantId: number | null;
  brokerId: number | null;
  value: string;
  notes: string | null;
  clienteId: number | null;
  userId: number | null;
  soldAt: Date | string;
  createdAt: Date | null;
  updatedAt: Date | null;
  // Novos campos
  cpf: string | null;
  propertyType: string | null;
  builderName: string | null;
  block: string | null;
  unit: string | null;
  paymentMethod: string | null;
  commission: string | null;
  bonus: string | null;
  totalCommission: string | null;
}
import { Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// Tipos de imóveis disponíveis
const PROPERTY_TYPES = {
  APARTAMENTO: "Apto",
  CASA: "Casa",
  LOTE: "Lote"
} as const;

// Formas de pagamento disponíveis
const PAYMENT_METHODS = {
  A_VISTA: "À vista",
  FINANCIAMENTO_BANCARIO: "Financiamento Bancário",
  FINANCIAMENTO_CONSTRUTORA: "Financiamento Construtora"
} as const;

const formSchema = z.object({
  date: z.date({ required_error: "Por favor, selecione uma data" }),
  cpf: z.string().min(11, { message: "Por favor, informe um CPF válido" }),
  
  // Campos para consultor e corretor
  consultantId: z.coerce.number({
    required_error: "Por favor, selecione o consultor de atendimento",
  }),
  brokerId: z.coerce.number({
    required_error: "Por favor, selecione o corretor",
  }),
  
  propertyType: z.enum(["Apto", "Casa", "Lote"], {
    required_error: "Por favor, selecione o tipo do imóvel",
  }),
  saleValue: z.string().min(1, { message: "Por favor, informe o valor da venda" }),
  paymentMethod: z.enum(["À vista", "Financiamento Bancário", "Financiamento Construtora"], {
    required_error: "Por favor, selecione a forma de pagamento",
  }),
  commission: z.string().min(1, { message: "Por favor, informe a comissão" }),
  bonus: z.string().optional(),
  totalCommission: z.string().optional(),
  notes: z.string().optional(),
  
  // Campos condicionais para apartamento
  builderName: z.string().optional(),
  block: z.string().optional(),
  unit: z.string().optional(),
  
  // Campo condicional para casa
  sellerName: z.string().optional(),
}).refine((data) => {
  // Validar campos para apartamento
  if (data.propertyType === PROPERTY_TYPES.APARTAMENTO) {
    return !!data.builderName && !!data.block && !!data.unit;
  }
  
  // Validar campos para casa
  if (data.propertyType === PROPERTY_TYPES.CASA) {
    return !!data.sellerName;
  }
  
  return true;
}, {
  message: "Por favor, preencha todos os campos obrigatórios para este tipo de imóvel",
  path: ["propertyType"], // Mostrar mensagem de erro próximo ao tipo de imóvel
});

type SaleEditProps = {
  sale: Sale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onDelete?: () => void;
};

export function SaleEditDialog({ sale, open, onOpenChange, onSuccess, onDelete }: SaleEditProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const [selectedPropertyType, setSelectedPropertyType] = useState<string | null>(null);
  
  const [totalCommissionValue, setTotalCommissionValue] = useState("");
  
  // Buscar lista de usuários (consultores e corretores)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: open, // Só busca quando o diálogo estiver aberto
  });
  
  // Filtrar consultores e corretores
  const consultants = users.filter((user) => user.role === Role.CONSULTANT);
  const brokers = users.filter((user) => user.role === Role.BROKER);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(sale.soldAt),
      cpf: "",
      consultantId: sale.consultantId || undefined,
      brokerId: sale.brokerId || undefined,
      propertyType: "Apto", // Valor padrão, será atualizado na inicialização
      saleValue: "",
      paymentMethod: "À vista", // Valor padrão, será atualizado na inicialização
      commission: "",
      bonus: "",
      totalCommission: "",
      notes: sale.notes || "",
      builderName: "",
      block: "",
      unit: "",
      sellerName: "",
    },
  });
  
  // Observar mudanças no tipo de propriedade para exibir os campos adicionais
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'propertyType') {
        setSelectedPropertyType(value.propertyType as string);
      }
      
      // Calcular comissão total quando comissão ou bônus mudar
      if (name === 'commission' || name === 'bonus') {
        // Limpar strings removendo R$ e convertendo vírgula para ponto
        const commissionStr = value.commission ? value.commission.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.') : '0';
        const bonusStr = value.bonus ? value.bonus.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.') : '0';
        
        const commissionValue = parseFloat(commissionStr);
        const bonusValue = parseFloat(bonusStr);
        
        if (!isNaN(commissionValue) || !isNaN(bonusValue)) {
          const totalCommission = (isNaN(commissionValue) ? 0 : commissionValue) + (isNaN(bonusValue) ? 0 : bonusValue);
          const formattedTotal = totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          
          setTotalCommissionValue(`R$ ${formattedTotal}`);
          form.setValue('totalCommission', `R$ ${formattedTotal}`);
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);
  
  // Preencher os campos com os dados da venda quando o diálogo é aberto
  useEffect(() => {
    if (open && sale) {
      // Formatar o valor da venda para exibição
      const valueNumber = Number(sale.value);
      const formattedValue = valueNumber.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      
      // Formatar valores monetários (comissão, bônus)
      const commissionValue = sale.commission ? 
        `R$ ${Number(sale.commission).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
      
      const bonusValue = sale.bonus ? 
        `R$ ${Number(sale.bonus).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
      
      // Utilizar o valor de comissão total armazenado ou calcular
      const totalCommission = sale.totalCommission || "R$ 0,00";
      
      // Builder name pode ser construtora ou vendedor, dependendo do tipo de imóvel
      let builderName = "";
      let sellerName = "";
      
      if (sale.propertyType === PROPERTY_TYPES.APARTAMENTO) {
        builderName = sale.builderName || "";
      } else if (sale.propertyType === PROPERTY_TYPES.CASA) {
        sellerName = sale.builderName || ""; // Usamos builderName para ambos os casos no banco
      }
      
      // Definir valores do formulário com os dados da venda
      form.reset({
        date: new Date(sale.soldAt),
        cpf: sale.cpf || "", 
        consultantId: sale.consultantId || undefined,
        brokerId: sale.brokerId || undefined,
        propertyType: (sale.propertyType || "Apto") as "Apto" | "Casa" | "Lote",
        saleValue: `R$ ${formattedValue}`,
        paymentMethod: (sale.paymentMethod || "À vista") as "À vista" | "Financiamento Bancário" | "Financiamento Construtora",
        commission: commissionValue,
        bonus: bonusValue,
        totalCommission: totalCommission,
        notes: sale.notes || "",
        builderName: builderName,
        block: sale.block || "",
        unit: sale.unit || "",
        sellerName: sellerName,
      });
      
      // Atualizar o tipo de propriedade selecionado
      setSelectedPropertyType(sale.propertyType || "Apto");
      setTotalCommissionValue(totalCommission);
    }
  }, [open, sale, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);
      
      // Agora vamos usar campos diretos em vez de notes
      const builderName = values.propertyType === "Apto" ? 
        values.builderName : 
        (values.propertyType === "Casa" ? values.sellerName : "");
      
      // Preparar os dados da venda com os novos campos específicos
      const saleData = {
        consultantId: values.consultantId,
        brokerId: values.brokerId,
        value: values.saleValue, // Schema vai converter para número
        soldAt: adjustDateForTimezone(values.date), // Ajustado para o fuso horário do Brasil (UTC-3)
        notes: values.notes || "",
        // Novos campos específicos
        cpf: values.cpf,
        propertyType: values.propertyType,
        builderName: builderName,
        block: values.propertyType === "Apto" ? values.block : "",
        unit: values.propertyType === "Apto" ? values.unit : "",
        paymentMethod: values.paymentMethod,
        commission: values.commission,
        bonus: values.bonus || "0",
        totalCommission: totalCommissionValue || "R$ 0,00",
      };
      
      // Atualizar a venda
      await apiRequest({
        url: `/api/sales/${sale.id}`,
        method: "PATCH",
        body: saleData,
      });
      
      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: [`/api/sales`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sales`, { clienteId: sale.clienteId }] });
      
      toast({
        title: "Venda atualizada",
        description: "A venda foi atualizada com sucesso.",
      });
      
      form.reset();
      onOpenChange(false);
      
      // Callback de sucesso
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Erro ao atualizar venda",
        description: "Não foi possível atualizar a venda. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  // Função para excluir a venda
  async function handleDelete() {
    try {
      if (!window.confirm("Tem certeza que deseja excluir esta venda?")) {
        return;
      }
      
      setIsDeleting(true);
      
      await apiRequest({
        url: `/api/sales/${sale.id}`,
        method: "DELETE",
      });
      
      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: [`/api/sales`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sales`, { clienteId: sale.clienteId }] });
      
      toast({
        title: "Venda excluída",
        description: "A venda foi excluída com sucesso.",
      });
      
      onOpenChange(false);
      onDelete?.();
    } catch (error) {
      toast({
        title: "Erro ao excluir venda",
        description: "Não foi possível excluir a venda. Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Venda</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Data da Venda */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da Venda</FormLabel>
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
            
            {/* Campo CPF */}
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input placeholder="000.000.000-00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Consultor de Atendimento */}
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
                        <SelectValue placeholder="Selecione o consultor" />
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
            
            {/* Corretor */}
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
                        <SelectValue placeholder="Selecione o corretor" />
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
            
            {/* Tipo do Imóvel */}
            <FormField
              control={form.control}
              name="propertyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Imóvel</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={PROPERTY_TYPES.APARTAMENTO}>Apartamento</SelectItem>
                      <SelectItem value={PROPERTY_TYPES.CASA}>Casa</SelectItem>
                      <SelectItem value={PROPERTY_TYPES.LOTE}>Lote</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campos condicionais para apartamento */}
            {selectedPropertyType === PROPERTY_TYPES.APARTAMENTO && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-slate-600">Informações do Apartamento</h3>
                
                <FormField
                  control={form.control}
                  name="builderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Construtora/Vendedor</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da construtora ou vendedor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="block"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bloco</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Bloco A" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 101" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            
            {/* Campo condicional para casa */}
            {selectedPropertyType === PROPERTY_TYPES.CASA && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-slate-600">Informações da Casa</h3>
                
                <FormField
                  control={form.control}
                  name="sellerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Vendedor</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do vendedor da casa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            {/* Forma de Pagamento e Valor */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pagamento</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a forma de pagamento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={PAYMENT_METHODS.A_VISTA}>À vista</SelectItem>
                        <SelectItem value={PAYMENT_METHODS.FINANCIAMENTO_BANCARIO}>Financiamento Bancário</SelectItem>
                        <SelectItem value={PAYMENT_METHODS.FINANCIAMENTO_CONSTRUTORA}>Financiamento Construtora</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="saleValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Venda</FormLabel>
                    <FormControl>
                      <CurrencyInput placeholder="R$ 000.000,00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Campos de Comissão */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="commission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comissão</FormLabel>
                      <FormControl>
                        <CurrencyInput placeholder="R$ 00.000,00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="bonus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bônus (opcional)</FormLabel>
                      <FormControl>
                        <CurrencyInput placeholder="R$ 00.000,00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid gap-4">
                <FormItem>
                  <FormLabel>Comissão Total</FormLabel>
                  <div className="flex h-10 w-full rounded-md border border-input bg-slate-50 px-3 py-2 text-sm ring-offset-background items-center">
                    {totalCommissionValue || "R$ 0,00"}
                  </div>
                </FormItem>
              </div>
            </div>

            {/* Observações */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalhes adicionais sobre a venda"
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || isSubmitting}
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
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
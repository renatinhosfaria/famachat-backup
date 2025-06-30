import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { insertClienteSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Estender schema com validações adicionais
const clienteFormSchema = insertClienteSchema
  .extend({
    fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    phone: z.string().min(8, "Telefone deve ter pelo menos 8 caracteres"),
    // Validação de email mais flexível - permite vazio ou qualquer string com @
    email: z.string().refine(
      (email) => email === "" || email.includes("@"),
      "Email deve incluir o símbolo @ (por exemplo: nome@dominio.com)"
    ),
    // Validação para garantir que um consultor seja selecionado
    assignedTo: z.number({
      required_error: "Selecione um consultor de atendimento"
    }),
  });

type ClienteFormValues = z.infer<typeof clienteFormSchema>;

interface CreateClienteDialogProps {
  onClienteCreated?: () => void;
}

export function CreateClienteDialog({ onClienteCreated }: CreateClienteDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Buscar usuários para o select de responsável
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 10 * 60 * 1000, // 10 minutos de cache
  });
  
  const consultores = Array.isArray(users) ? users.filter(
    (user: any) => user.role === "Consultor de Atendimento"
  ) : [];
  
  // Inicializar formulário
  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      source: "Site",
      status: "Sem Atendimento",
      assignedTo: undefined,
    },
  });
  
  // Estado de submissão do formulário
  const isSubmitting = form.formState.isSubmitting;
  
  // Lidar com submissão do formulário
  async function onSubmit(values: ClienteFormValues) {
    try {
      // Enviar dados para API
      await apiRequest({
        url: "/api/clientes",
        method: "POST",
        body: values,
      });
      
      // Feedback e limpeza
      toast({
        title: "Cliente criado",
        description: "O cliente foi criado com sucesso.",
      });
      
      // Invalidar o cache para forçar a atualização dos dados
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
      
      // Resetar formulário
      form.reset();
      
      // Fechar dialog
      setOpen(false);
      
      // Callback opcional
      if (onClienteCreated) {
        onClienteCreated();
      }
    } catch (error) {
      toast({
        title: "Erro ao criar cliente",
        description: "Não foi possível criar o cliente. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 bg-sky-500 hover:bg-sky-600 text-white whitespace-nowrap min-w-[40px] md:min-w-[140px]" size="default">
          <Plus className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Novo Cliente</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
          <DialogDescription>
            Adicione um novo cliente ao sistema.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <PhoneInput 
                        placeholder="(00) 00000-0000"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "Site"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a origem" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Site">Site</SelectItem>
                        <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="Indicação">Indicação</SelectItem>
                        <SelectItem value="Portais">Portais</SelectItem>
                        <SelectItem value="Google">Google</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consultor de Atendimento *</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                      defaultValue={field.value?.toString() || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um consultor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(consultores) && consultores.map((user: any) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
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
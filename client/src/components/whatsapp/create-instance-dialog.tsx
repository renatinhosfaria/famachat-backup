import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { normalizeInstanceName } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// Schema de validação para criar instância do WhatsApp
const createInstanceSchema = z.object({
  userId: z.number().positive("Selecione um usuário"),
  instanceName: z.string().min(3, "Nome da instância deve ter pelo menos 3 caracteres"),
  phone: z.string().min(10, "Digite um número de telefone válido").optional(),
});

type CreateInstanceFormValues = z.infer<typeof createInstanceSchema>;

interface WhatsappCreateInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function WhatsappCreateInstanceDialog({
  open,
  onOpenChange,
  onSuccess,
}: WhatsappCreateInstanceDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [users, setUsers] = useState<any[]>([
    // Dados iniciais para teste
    { id: 1, fullName: "Renato Faria", username: "Renato", phone: "5511999999999" }
  ]);

  // Configurar o formulário com validação zod
  const form = useForm<CreateInstanceFormValues>({
    resolver: zodResolver(createInstanceSchema),
    defaultValues: {
      instanceName: "",
      phone: "",
      // Removido campo isPrimary que não existe mais na tabela
    },
  });
  
  // Formatar número de telefone para o formato internacional (ex: 5534999772714)
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return "";
    
    // Remove todos os caracteres não numéricos
    let digitsOnly = phone.replace(/\D/g, '');
    
    // Remove o 0 inicial se existir (formato brasileiro)
    if (digitsOnly.startsWith('0')) {
      digitsOnly = digitsOnly.substring(1);
    }
    
    // Se já começar com 55, mantém como está
    if (digitsOnly.startsWith('55')) {
      return digitsOnly;
    }
    
    // Caso contrário, adiciona o código do Brasil (55)
    return `55${digitsOnly}`;
  };
  
  // Atualizar campos quando um usuário é selecionado
  const updateFieldsForUser = (userId: number) => {
    console.log("👤 [DEBUG] Usuário selecionado:", userId);
    const selectedUser = users.find(u => u.id === userId);
    console.log("👤 [DEBUG] Dados do usuário encontrado:", selectedUser);
    
    if (selectedUser) {
      // Atualizar o número de telefone
      if (selectedUser.phone) {
        const formattedPhone = formatPhoneNumber(selectedUser.phone);
        console.log("📱 [DEBUG] Telefone formatado:", formattedPhone);
        form.setValue("phone", formattedPhone);
      }
      
      // Gerar nome da instância a partir do primeiro nome do usuário
      const instanceName = normalizeInstanceName(selectedUser.fullName);
      console.log("📝 [DEBUG] Nome da instância gerado:", instanceName);
      
      if (instanceName) {
        form.setValue("instanceName", instanceName);
        console.log("📝 [DEBUG] Nome da instância definido no formulário:", instanceName);
      }
      
      console.log("✅ [DEBUG] Campos atualizados:", {
        phone: form.getValues('phone'),
        instanceName: form.getValues('instanceName')
      });
    }
  };

  // Carregar usuários quando o diálogo é aberto
  const loadUsers = async () => {
    console.log("📋 [DEBUG] Carregando usuários...");
    setIsFetchingUsers(true);
    try {
      const response = await fetch("/api/users");
      console.log("📋 [DEBUG] Resposta da API de usuários:", response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log("📋 [DEBUG] Dados de usuários recebidos:", data);
        
        if (Array.isArray(data)) {
          setUsers(data);
          console.log("📋 [DEBUG] Usuários definidos no estado:", data.length, "usuários");
        } else {
          console.error("📋 [DEBUG] Formato de dados inválido:", typeof data, data);
          toast({
            title: "Formato de dados inválido",
            description: "Os dados dos usuários não estão no formato esperado.",
            variant: "destructive",
          });
        }
      } else {
        console.error("📋 [DEBUG] Erro na resposta:", response.status, response.statusText);
        toast({
          title: "Erro ao buscar usuários",
          description: `Status: ${response.status} - ${response.statusText}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("📋 [DEBUG] Erro ao carregar usuários:", error);
      toast({
        title: "Erro ao carregar usuários",
        description: "Não foi possível carregar a lista de usuários.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingUsers(false);
    }
  };

  // Efeito para carregar usuários quando o diálogo é aberto
  useEffect(() => {
    console.log("🔄 [DEBUG] Efeito useEffect executado. Dialog open:", open);
    if (open) {
      console.log("🔄 [DEBUG] Diálogo aberto, carregando usuários...");
      loadUsers();
    }
  }, [open]);

  // Mutação para criar instância
  const createInstanceMutation = useMutation({
    mutationFn: async (values: CreateInstanceFormValues) => {
      console.log("🚀 [DEBUG] Enviando dados para criar instância:", values);
      console.log("🚀 [DEBUG] Dados serializados:", JSON.stringify(values, null, 2));
      
      try {
        const response = await apiRequest({
          url: "/api/whatsapp/instances",
          method: "POST",
          body: values
        });
        
        console.log("✅ [DEBUG] Resposta da API (sucesso):", response);
        return response;
      } catch (error: any) {
        console.error("❌ [DEBUG] Erro na API:", error);
        console.error("❌ [DEBUG] Detalhes do erro:", {
          message: error?.message,
          status: error?.status,
          statusText: error?.statusText,
          response: error?.response,
          responseData: error?.response?.data
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("✅ [DEBUG] Instância criada com sucesso:", data);
      toast({
        title: "Instância criada",
        description: "A instância de WhatsApp foi criada com sucesso.",
      });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("❌ [DEBUG] Erro no onError:", error);
      
      // Mostrar mensagem de erro mais detalhada quando disponível
      const errorMessage = error?.message || 
                          error?.response?.data?.message || 
                          "Ocorreu um erro ao criar a instância de WhatsApp.";
      
      console.error("❌ [DEBUG] Mensagem de erro final:", errorMessage);
      
      toast({
        title: "Erro ao criar instância",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Enviar formulário
  function onSubmit(values: CreateInstanceFormValues) {
    console.log("📝 [DEBUG] Dados do formulário antes de enviar:", values);
    console.log("📝 [DEBUG] Tipo de userId:", typeof values.userId);
    console.log("📝 [DEBUG] Tipo de instanceName:", typeof values.instanceName);
    console.log("📝 [DEBUG] Tipo de phone:", typeof values.phone);
    console.log("📝 [DEBUG] Tipo de instanciaId:", typeof values.instanciaId);
    console.log("📝 [DEBUG] Valor de instanciaId:", values.instanciaId);
    console.log("📝 [DEBUG] Validação do formulário:", {
      isValid: form.formState.isValid,
      errors: form.formState.errors
    });
    
    // Garantir que os campos obrigatórios estejam presentes e com tipos corretos
    const payload = {
      userId: Number(values.userId), // Garantir que seja número
      instanceName: String(values.instanceName), // Garantir que seja string
      phone: values.phone ? String(values.phone) : undefined, // Opcional
      // Gerar instanciaId se não estiver presente
      instanciaId: values.instanciaId || `${values.instanceName.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`
    };
    
    console.log("📤 [DEBUG] Payload final sendo enviado:", payload);
    console.log("📤 [DEBUG] Tipos do payload:", {
      userId: typeof payload.userId,
      instanceName: typeof payload.instanceName,
      phone: typeof payload.phone,
      instanciaId: typeof payload.instanciaId
    });
    
    createInstanceMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Instância de WhatsApp</DialogTitle>
          <DialogDescription>
            Configure uma nova instância do WhatsApp para um usuário.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário</FormLabel>
                  <Select
                    disabled={isFetchingUsers || createInstanceMutation.isPending}
                    onValueChange={(value) => {
                      const userId = parseInt(value);
                      field.onChange(userId);
                      updateFieldsForUser(userId);
                    }}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o usuário" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.fullName} ({user.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Selecione o usuário para quem esta instância será criada.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="5534999772714"
                      {...field}
                      disabled={createInstanceMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Número de telefone completo com código do país (ex: 5534999772714).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="instanceName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Instância</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="nome_da_instancia"
                      {...field}
                      disabled={createInstanceMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Um nome único para identificar esta instância. Use apenas letras, números e sublinhados.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Removido campo isPrimary que não existe mais na tabela */}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={createInstanceMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createInstanceMutation.isPending}>
                {createInstanceMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Criar Instância
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Schema de validação para enviar mensagens
const sendMessageSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, "Número de telefone deve ter pelo menos 10 dígitos")
    .refine((value) => /^[0-9]+$/.test(value.replace(/\D/g, "")), {
      message: "Número de telefone deve conter apenas dígitos",
    }),
  message: z.string().min(1, "A mensagem não pode estar vazia"),
});

type SendMessageFormValues = z.infer<typeof sendMessageSchema>;

interface WhatsappSendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: number;
  instanceName: string;
  onSuccess?: () => void;
}

export function WhatsappSendMessageDialog({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  onSuccess,
}: WhatsappSendMessageDialogProps) {
  const { toast } = useToast();

  // Configurar o formulário com validação zod
  const form = useForm<SendMessageFormValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: {
      phoneNumber: "",
      message: "",
    },
  });

  // Mutação para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: (values: SendMessageFormValues) => {
      return apiRequest({
        url: "/api/whatsapp/send-message",
        method: "POST",
        body: {
          instanceId,
          phoneNumber: values.phoneNumber,
          message: values.message,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Mensagem enviada",
        description: "A mensagem foi enviada com sucesso.",
      });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: "Ocorreu um erro ao enviar a mensagem.",
        variant: "destructive",
      });
    },
  });

  // Formatar o número de telefone enquanto o usuário digita
  const formatPhoneNumber = (value: string) => {
    // Remover todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, "");
    
    // Adicionar formatação se for um número brasileiro
    if (numbers.startsWith("55") && numbers.length >= 12) {
      // Formato: +55 (XX) XXXXX-XXXX
      return `+${numbers.substring(0, 2)} (${numbers.substring(2, 4)}) ${numbers.substring(
        4,
        9
      )}-${numbers.substring(9, 13)}`;
    }
    
    // Se não tiver formato específico, apenas manter os números
    return numbers;
  };

  // Enviar formulário
  function onSubmit(values: SendMessageFormValues) {
    // Limpar formatação do número antes de enviar
    const cleanNumber = values.phoneNumber.replace(/\D/g, "");
    sendMessageMutation.mutate({
      ...values,
      phoneNumber: cleanNumber,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem de WhatsApp</DialogTitle>
          <DialogDescription>
            Envie uma mensagem utilizando a instância "{instanceName}".
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Telefone</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="5511999999999"
                      {...field}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        field.onChange(formatted);
                      }}
                      disabled={sendMessageMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Digite o número com DDD, sem espaços ou caracteres especiais. 
                    Exemplo: 5511999999999
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Digite sua mensagem aqui..."
                      rows={5}
                      {...field}
                      disabled={sendMessageMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    A mensagem a ser enviada para o número de WhatsApp.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={sendMessageMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={sendMessageMutation.isPending}>
                {sendMessageMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Enviar Mensagem
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
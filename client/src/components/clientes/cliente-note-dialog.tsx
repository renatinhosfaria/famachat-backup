import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { InsertClienteNote } from "@shared/schema";

const clienteNoteSchema = z.object({
  text: z.string().min(3, "A anotação precisa ter pelo menos 3 caracteres"),
  clienteId: z.number(),
  userId: z.number(),
});

type ClienteNoteSchema = z.infer<typeof clienteNoteSchema>;

interface ClienteNoteDialogProps {
  open: boolean;
  clienteId: number;
  userId: number;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ClienteNoteDialog = ({
  open,
  clienteId,
  userId,
  onOpenChange,
  onSuccess,
}: ClienteNoteDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ClienteNoteSchema>({
    resolver: zodResolver(clienteNoteSchema),
    defaultValues: {
      text: "",
      clienteId,
      userId,
    },
  });

  const onSubmit = async (data: ClienteNoteSchema) => {
    setIsSubmitting(true);
    try {
      // Criar data no formato correto sem conversão de timezone
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000`;

      await apiRequest({
        url: `/api/clientes/${clienteId}/notes`,
        method: "POST",
        body: {
          text: data.text,
          userId: data.userId,
          createdAt: dateStr,
          updatedAt: dateStr
        },
      });

      toast({
        title: "Anotação adicionada",
        description: "A anotação foi adicionada com sucesso",
      });

      // Invalidar cache para forçar recarregamento dos dados
      queryClient.invalidateQueries({ queryKey: ["/api/clientes", String(clienteId)] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}/notes`] });

      // Resetar o formulário e fechar o diálogo
      form.reset();
      onOpenChange(false);

      // Executar callback de sucesso, se fornecido
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a anotação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Anotação</DialogTitle>
          <DialogDescription>
            Adicione uma anotação a este cliente. Esta anotação ficará visível no histórico.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto da anotação</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Digite a anotação sobre o cliente aqui..." 
                      className="min-h-[120px]"
                      {...field} 
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
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar Anotação"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
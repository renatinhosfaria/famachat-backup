import React, { useState, useEffect } from "react";
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
import { ClienteNote } from "@shared/schema";

const clienteNoteEditSchema = z.object({
  text: z.string().min(3, "A anotação precisa ter pelo menos 3 caracteres"),
});

type ClienteNoteEditSchema = z.infer<typeof clienteNoteEditSchema>;

interface ClienteNoteEditDialogProps {
  open: boolean;
  clienteId: number;
  note: ClienteNote | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ClienteNoteEditDialog = ({
  open,
  clienteId,
  note,
  onOpenChange,
  onSuccess,
}: ClienteNoteEditDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ClienteNoteEditSchema>({
    resolver: zodResolver(clienteNoteEditSchema),
    defaultValues: {
      text: note?.text || "",
    },
  });

  // Atualizar o formulário quando a nota mudar
  useEffect(() => {
    if (note) {
      form.reset({
        text: note.text,
      });
    }
  }, [note, form]);

  const onSubmit = async (data: ClienteNoteEditSchema) => {
    if (!note) return;
    
    setIsSubmitting(true);
    try {
      await apiRequest({
        url: `/api/clientes/notes/${note.id}`,
        method: "PATCH",
        body: {
          text: data.text.trim(),
        },
      });

      toast({
        title: "Anotação atualizada",
        description: "A anotação foi atualizada com sucesso",
      });

      // Invalidar cache para forçar recarregamento dos dados
      queryClient.invalidateQueries({ queryKey: ["/api/clientes", String(clienteId)] });
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}/notes`] });

      // Fechar o diálogo
      onOpenChange(false);
      
      // Executar callback de sucesso, se fornecido
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a anotação. Tente novamente.",
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
          <DialogTitle>Editar Anotação</DialogTitle>
          <DialogDescription>
            Edite a anotação deste cliente. Esta anotação ficará visível no histórico.
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
              <Button type="submit" disabled={isSubmitting} className="bg-[#00ABD1] hover:bg-[#0096b7]">
                {isSubmitting ? "Salvando..." : "Atualizar Anotação"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
import { KanbanBoard } from "@/components/clientes/kanban-board";
import { CreateClienteDialog } from "@/components/clientes/create-cliente-dialog";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Clientes() {
  const { refetch } = useQuery({
    queryKey: ["/api/clientes"],
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const handleClienteCreated = () => {
    refetch();
    toast({
      title: "Cliente criado",
      description: "O novo cliente foi adicionado com sucesso.",
    });
  };

  return (
    <div className="h-full">
      <KanbanBoard 
        renderNewButton={() => <CreateClienteDialog onClienteCreated={handleClienteCreated} />}
      />
    </div>
  );
}
import { Cliente } from "@shared/schema";
import { ClienteCard } from "./cliente-card";
import { Draggable } from "react-beautiful-dnd";

interface KanbanColumnProps {
  title: string;
  clientes: Cliente[];
  onClienteClick: (cliente: Cliente) => void;
}

export function KanbanColumn({ title, clientes, onClienteClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col h-full min-w-[280px] w-[280px]">
      <div className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-t-md">
        <h3 className="font-medium">{title}</h3>
        <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
          {clientes.length}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 bg-secondary/20 rounded-b-md min-h-[500px]">
        {clientes.length > 0 ? (
          clientes.map((cliente, index) => (
            <Draggable 
              key={cliente.id} 
              draggableId={cliente.id.toString()} 
              index={index}
            >
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  style={{
                    ...provided.draggableProps.style,
                    opacity: snapshot.isDragging ? 0.8 : 1
                  }}
                >
                  <ClienteCard 
                    cliente={cliente} 
                    onCardClick={onClienteClick}
                  />
                </div>
              )}
            </Draggable>
          ))
        ) : (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border border-dashed rounded-md">
            Sem clientes
          </div>
        )}
      </div>
    </div>
  );
}
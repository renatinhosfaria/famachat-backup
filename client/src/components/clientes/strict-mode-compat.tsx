import React, { useEffect, useState } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';

type Props = {
  children: React.ReactNode;
  onDragEnd: (result: DropResult) => void;
};

/**
 * Um componente que envolve o DragDropContext para contornar 
 * problemas de compatibilidade com o React 18 Strict Mode
 */
export function StrictModeDragDropContext({ children, onDragEnd }: Props) {
  // Estado para verificar se o componente foi montado
  const [isInitialRender, setIsInitialRender] = useState(true);

  // No primeiro render, não mostramos o conteúdo em modo estrito do React 18
  useEffect(() => {
    if (isInitialRender) {
      // Isso permite que o React 18 no modo estrito conclua seu segundo render
      // antes que o conteúdo do DragDropContext seja montado
      requestAnimationFrame(() => {
        setIsInitialRender(false);
      });
    }
  }, [isInitialRender]);

  // Se for o render inicial, retornamos null para evitar a dupla montagem em modo estrito
  if (isInitialRender) {
    return null;
  }

  // Depois do primeiro ciclo, montamos normalmente
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {children}
    </DragDropContext>
  );
}
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DetalhesConstrutoraModalProps {
  open: boolean;
  onClose: () => void;
  cnpj: string;
  razaoSocial: string;
  nome: string;
}

export function DetalhesConstrutoraModal({ open, onClose, cnpj, razaoSocial, nome }: DetalhesConstrutoraModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle>Detalhes da Construtora</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <div><span className="font-semibold">Nome:</span> {nome}</div>
          <div><span className="font-semibold">CNPJ:</span> {cnpj || '-'}</div>
          <div><span className="font-semibold">Razão Social:</span> {razaoSocial || '-'}</div>
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="default" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
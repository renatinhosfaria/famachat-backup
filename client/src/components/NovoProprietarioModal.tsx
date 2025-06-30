import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { useForm } from 'react-hook-form';
import { Proprietario, ProprietarioPF, Construtora } from '@/hooks/use-proprietarios';

interface NovoProprietarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Proprietario, 'id'>) => void;
  initialData?: Proprietario | null;
}

export function NovoProprietarioModal({ open, onOpenChange, onSave, initialData }: NovoProprietarioModalProps) {
  // Define o tipo inicial com base no initialData se disponível
  const [tipo, setTipo] = useState<string | null>(
    initialData ? (initialData.tipo === 'Construtora' ? 'construtora' : 'vendedor') : null
  );

  // Formulário para Vendedor Pessoa Física
  interface ProprietarioPFForm {
    tipo: 'Pessoa Física';
    nome: string;
    celular: string;
    email: string;
    cpf: string;
  }
  
  const formVendedor = useForm<ProprietarioPFForm>({
    defaultValues: {
      tipo: 'Pessoa Física',
      nome: '',
      celular: '',
      email: '',
      cpf: '',
    },
  });
  
  // Efeito para atualizar o formulário quando initialData mudar
  useEffect(() => {
    if (initialData && initialData.tipo === 'Pessoa Física') {
      formVendedor.reset({
        tipo: 'Pessoa Física',
        nome: initialData.nome,
        celular: initialData.celular,
        email: initialData.email || '',
        cpf: initialData.cpf || '',
      });
    }
  }, [initialData, formVendedor]);
  
  // Formulário para Construtora
  interface ConstrutoraForm {
    tipo: 'Construtora';
    nome: string;
    cpfCnpj: string;
    razaoSocial: string;
    contatoNome: string;
    contatoCelular: string;
    contatoEmail: string;
    contatos: any[];
  }
  
  const formConstrutora = useForm<ConstrutoraForm>({
    defaultValues: {
      tipo: 'Construtora',
      nome: '',
      cpfCnpj: '',
      razaoSocial: '',
      contatoNome: '',
      contatoCelular: '',
      contatoEmail: '',
      contatos: [],
    },
  });
  
  // Efeito para atualizar o formulário da construtora quando initialData mudar
  useEffect(() => {
    if (initialData && initialData.tipo === 'Construtora') {
      formConstrutora.reset({
        tipo: 'Construtora',
        nome: (initialData as any).nomeConstrutora || initialData.nome || '',
        cpfCnpj: initialData.cpfCnpj || '',
        razaoSocial: initialData.razaoSocial || '',
        contatoNome: initialData.contatoNome || (initialData.contatos && initialData.contatos.length > 0 ? initialData.contatos[0].nome : ''),
        contatoCelular: initialData.contatoCelular || (initialData.contatos && initialData.contatos.length > 0 ? initialData.contatos[0].telefone || '' : ''),
        contatoEmail: initialData.contatoEmail || (initialData.contatos && initialData.contatos.length > 0 ? initialData.contatos[0].email || '' : ''),
        contatos: initialData.contatos || [],
      });
    }
  }, [initialData, formConstrutora]);

  const onSubmitVendedor = (data: Omit<ProprietarioPF, 'id'>) => {
    onSave(data);
    onOpenChange(false);
  };
  
  const onSubmitConstrutora = (data: Omit<Construtora, 'id'>) => {
    // Preparar os dados para incluir os contatos no formato de array
    const formattedData = {
      ...data,
      nomeConstrutora: data.nome, // Utilizar o campo nome como nomeConstrutora para a API
      contatos: []
    };
    
    // Se temos dados de contato, adicionar ao array de contatos
    if (data.contatoNome) {
      (formattedData.contatos as any).push({
        nome: data.contatoNome,
        telefone: data.contatoCelular || '',
        email: data.contatoEmail || ''
      });
    }
    
    onSave(formattedData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Proprietário' : 'Novo Proprietário'}</DialogTitle>
        </DialogHeader>
        {!tipo && (
          <div className="space-y-4 mt-4">
            <p className="font-medium">Selecione o tipo de proprietário:</p>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => setTipo('vendedor')}>Vendedor (Pessoa Física)</Button>
              <Button variant="outline" onClick={() => setTipo('construtora')}>Construtora</Button>
            </div>
          </div>
        )}
        {tipo === 'vendedor' && (
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => setTipo(null)}>&larr; Voltar</Button>
            <Form {...formVendedor}>
              <form onSubmit={formVendedor.handleSubmit(onSubmitVendedor)} className="space-y-4 mt-2">
                <FormField name="nome" control={formVendedor.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="celular" control={formVendedor.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Celular</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="email" control={formVendedor.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="cpf" control={formVendedor.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2 mt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-primary text-white">Salvar</Button>
                </div>
              </form>
            </Form>
          </div>
        )}
        {tipo === 'construtora' && (
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => setTipo(null)}>&larr; Voltar</Button>
            <Form {...formConstrutora}>
              <form onSubmit={formConstrutora.handleSubmit(onSubmitConstrutora)} className="space-y-4 mt-2">
                <FormField name="nome" control={formConstrutora.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Construtora</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="cpfCnpj" control={formConstrutora.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value || null)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="razaoSocial" control={formConstrutora.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razão Social</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value || null)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold mb-2">Contato na Construtora</h3>
                  <FormField name="contatoNome" control={formConstrutora.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl><Input {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value || null)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="contatoCelular" control={formConstrutora.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular</FormLabel>
                      <FormControl>
                        <PhoneInput value={field.value || ''} onChange={value => field.onChange(value || null)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="contatoEmail" control={formConstrutora.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value || null)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-primary text-white">Salvar</Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 
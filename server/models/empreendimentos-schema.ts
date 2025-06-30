import { pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Definição da tabela de empreendimentos - exatamente conforme a estrutura atual do banco de dados
export const empreendimentosTable = pgTable('imoveis_empreendimentos', {
  // Dados de identificação
  id: serial('id_empreendimento').primaryKey(),
  
  // Dados do proprietário
  tipoProprietario: text('tipo_proprietario').default('Construtora'),
  nomeProprietario: text('nome_proprietario'),
  contatoProprietario: text('contato_proprietario'),
  telefoneProprietario: text('telefone_proprietario'),
  
  // Dados do empreendimento
  nomeEmpreendimento: text('nome_empreendimento').notNull(),
  tipoImovel: text('tipo_imovel').default('Apartamento'),
  ruaAvenidaEmpreendimento: text('rua_avenida_empreendimento'),
  numeroEmpreendimento: text('numero_empreendimento'),
  complementoEmpreendimento: text('complemento_empreendimento'),
  zonaEmpreendimento: text('zona_empreendimento'),
  bairroEmpreendimento: text('bairro_empreendimento'),
  cidadeEmpreendimento: text('cidade_empreendimento'),
  estadoEmpreendimento: text('estado_empreendimento'),
  cepEmpreendimento: text('cep_empreendimento'),
  
  // Detalhes do empreendimento
  blocoTorresEmpreendimento: text('bloco_torres_empreendimento'),
  andaresEmpreendimento: text('andares_empreendimento'),
  aptoAndarEmpreendimento: text('apto_andar_empreendimento'),
  valorCondominioEmpreendimento: text('valor_condominio_empreendimento'),
  statusEmpreendimento: text('status'),
  prazoEntregaEmpreendimento: text('prazo_entrega_empreendimento'),
  
  // Itens e características
  itensServicosEmpreendimento: jsonb('itens_servicos_empreendimento').$type<string[]>(),
  itensLazerEmpreendimento: jsonb('itens_lazer_empreendimento').$type<string[]>(),
  
  // Mídia do empreendimento
  urlFotoCapaEmpreendimento: jsonb('url_foto_capa_empreendimento'),
  urlFotoEmpreendimento: jsonb('url_foto_empreendimento'),
  urlVideoEmpreendimento: jsonb('url_video_empreendimento'),
  
  // Datas de controle
  dataCadastro: timestamp('data_cadastro').defaultNow(),
  ultimaAtualizacao: timestamp('ultima_atualizacao').defaultNow(),
});

// Schema para inserção de empreendimentos
export const insertEmpreendimentoSchema = createInsertSchema(empreendimentosTable);

// Schema para seleção de empreendimentos
export const selectEmpreendimentoSchema = createSelectSchema(empreendimentosTable);

// Tipos para TypeScript
export type Empreendimento = z.infer<typeof selectEmpreendimentoSchema>;
export type InsertEmpreendimento = z.infer<typeof insertEmpreendimentoSchema>;
export type EmpreendimentoTable = typeof empreendimentosTable.$inferSelect;
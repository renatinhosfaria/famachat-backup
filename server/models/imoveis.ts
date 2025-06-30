import { pgTable, uuid, varchar, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { proprietarios } from './proprietarios';

export const imoveis = pgTable('imoveis', {
  id: uuid('id').primaryKey().defaultRandom(),
  referencia: text('referencia').notNull(),
  tipo: varchar('tipo', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('Ativo'),
  tipoProprietario: varchar('tipo_proprietario', { length: 20 }).notNull().default('Construtora'),
  endereco: text('endereco').notNull().default(''),
  nomeEmpreendimento: varchar('nome_empreendimento', { length: 100 }),
  rua: varchar('rua', { length: 100 }),
  numero: varchar('numero', { length: 20 }),
  complemento: varchar('complemento', { length: 50 }),
  bairro: varchar('bairro', { length: 50 }),
  cidade: varchar('cidade', { length: 50 }),
  estado: varchar('estado', { length: 2 }),
  cep: varchar('cep', { length: 20 }),
  blocos: varchar('blocos', { length: 50 }),
  andares: varchar('andares', { length: 20 }),
  aptosPorAndar: varchar('aptos_por_andar', { length: 20 }),
  valorCondominio: varchar('valor_condominio', { length: 30 }),
  proprietarioId: uuid('proprietario_id').references(() => proprietarios.id),
  servicos: jsonb('servicos'),
  lazer: jsonb('lazer'),
  apartamentos: jsonb('apartamentos'),
  fotos: jsonb('fotos'), // array de caminhos
  fotoCapaIdx: integer('foto_capa_idx'),
  videos: jsonb('videos'), // array de caminhos
  valorVenda: varchar('valor_venda', { length: 30 }).notNull().default('0'),
  tituloDescritivo: varchar('titulo_descritivo', { length: 200 }),
  descricaoCompleta: text('descricao_completa'),
  statusPublicacao: varchar('status_publicacao', { length: 20 }),
  dataCadastro: timestamp('data_cadastro').defaultNow(),
  ultimaAtualizacao: timestamp('ultima_atualizacao').defaultNow(),
}); 
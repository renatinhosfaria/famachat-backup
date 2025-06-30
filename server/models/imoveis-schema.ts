import { pgTable, serial, text, timestamp, integer, uuid } from 'drizzle-orm/pg-core';

// Definição da tabela de proprietários pessoa física
export const proprietariosPF = pgTable('imoveis_proprietarios_pf', {
  id: serial('id_proprietario_pf').primaryKey(),
  nome: text('nome').notNull().default(''),
  telefone: text('telefone').notNull().default(''),
  email: text('email'),
  cpf: text('cpf').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Definição da tabela de construtoras
export const imoveis_construtoras = pgTable('imoveis_construtoras', {
  id: serial('id_construtora').primaryKey(),
  nomeConstrutora: text('nome_construtora').notNull().default(''),
  razaoSocial: text('razao_social').default(''),
  cpfCnpj: text('cpf_cnpj').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Definição da tabela de contatos das construtoras
export const imoveis_contatos_construtora = pgTable('imoveis_contatos_construtora', {
  id: serial('id_contato_construtora').primaryKey(),
  construtoraId: integer('id_construtora'),
  nome: text('nome').notNull().default(''),
  telefone: text('telefone').default(''),
  email: text('email').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Definição da tabela de imóveis
export const imoveis = pgTable('imoveis', {
  id: uuid('id').primaryKey().defaultRandom()
  // Outros campos relacionados a imóveis
});
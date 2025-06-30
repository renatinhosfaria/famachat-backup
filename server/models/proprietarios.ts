import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const proprietarios = pgTable('proprietarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipo: varchar('tipo', { length: 20 }).notNull(), // 'Pessoa Física' ou 'Construtora'
  nome: varchar('nome', { length: 100 }).notNull(),
  celular: varchar('celular', { length: 20 }),
  email: varchar('email', { length: 100 }),
  cpfCnpj: varchar('cpf_cnpj', { length: 20 }),
  razaoSocial: varchar('razao_social', { length: 100 }),
  contatoNome: varchar('contato_nome', { length: 100 }),
  contatoCelular: varchar('contato_celular', { length: 20 }),
  contatoEmail: varchar('contato_email', { length: 100 }),
  dataCadastro: timestamp('data_cadastro').defaultNow(),
  ultimaAtualizacao: timestamp('ultima_atualizacao').defaultNow(),
}); 
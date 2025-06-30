import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const apartamentos = pgTable('apartamentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Referência ao empreendimento
  referenciaEmpreendimento: text('referencia_empreendimento').notNull(),
  
  // Dados do Apartamento
  referenciaApartamento: text('referencia_apartamento').notNull(),
  statusApartamento: text('status_apartamento').notNull().default('Em construção'),
  areaPrivativaApartamento: text('area_privativa_apartamento'),
  quartosApartamento: text('quartos_apartamento'),
  suitesApartamento: text('suites_apartamento'),
  banheirosApartamento: text('banheiros_apartamento'),
  vagasGaragemApartamento: text('vagas_garagem_apartamento'),
  tipoGaragemApartamento: text('tipo_garagem_apartamento'),
  sacadaVarandaApartamento: text('sacada_varanda_apartamento'),
  caracteristicasApartamento: jsonb('caracteristicas_apartamento'),
  
  // Fotos e vídeos
  urlFotoCapaApartamento: text('url_foto_capa_apartamento'),
  urlFotoApartamento: jsonb('url_foto_apartamento'),
  urlVideoApartamento: jsonb('url_video_apartamento'),
  
  // Campos de controle
  dataCadastro: timestamp('data_cadastro').defaultNow(),
  ultimaAtualizacao: timestamp('ultima_atualizacao').defaultNow(),
});

// Esquema para validação de inserção
export const insertApartamentosSchema = createInsertSchema(apartamentos)
  .omit({ id: true, dataCadastro: true, ultimaAtualizacao: true });

// Tipos para uso no código
export type InsertApartamento = z.infer<typeof insertApartamentosSchema>;
export type Apartamento = typeof apartamentos.$inferSelect;
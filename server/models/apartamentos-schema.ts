import { z } from 'zod';

// Esquema para validação de criação de apartamento
export const criarApartamentoSchema = z.object({
  id_empreendimento: z.number({
    required_error: "ID do empreendimento é obrigatório"
  }),
  status_apartamento: z.string().optional().default('Disponível'),
  area_privativa_apartamento: z.number().optional().nullable(),
  quartos_apartamento: z.number().optional().nullable(),
  suites_apartamento: z.number().optional().nullable(),
  banheiros_apartamento: z.number().optional().nullable(),
  vagas_garagem_apartamento: z.number().optional().nullable(),
  tipo_garagem_apartamento: z.string().optional().default(''),
  sacada_varanda_apartamento: z.boolean().optional().default(false),
  caracteristicas_apartamento: z.union([
    z.string(),
    z.array(z.string()).transform(arr => JSON.stringify(arr))
  ]).optional().default('[]'),
  valor_venda_apartamento: z.number().optional().nullable(),
  titulo_descritivo_apartamento: z.string().optional().default(''),
  descricao_apartamento: z.string().optional().default(''),
  status_publicacao_apartamento: z.string().optional().default('Não publicado')
});

// Esquema para validação de atualização de apartamento
export const atualizarApartamentoSchema = z.object({
  id_empreendimento: z.number().optional(),
  status_apartamento: z.string().optional(),
  area_privativa_apartamento: z.number().optional().nullable(),
  quartos_apartamento: z.number().optional().nullable(),
  suites_apartamento: z.number().optional().nullable(),
  banheiros_apartamento: z.number().optional().nullable(),
  vagas_garagem_apartamento: z.number().optional().nullable(),
  tipo_garagem_apartamento: z.string().optional(),
  sacada_varanda_apartamento: z.boolean().optional(),
  caracteristicas_apartamento: z.union([
    z.string(),
    z.array(z.string()).transform(arr => JSON.stringify(arr))
  ]).optional(),
  valor_venda_apartamento: z.number().optional().nullable(),
  titulo_descritivo_apartamento: z.string().optional(),
  descricao_apartamento: z.string().optional(),
  status_publicacao_apartamento: z.string().optional()
});

// Esquema para validação de apartamento
export const apartamentoSchema = z.object({
  id_apartamento: z.number(),
  id_empreendimento: z.number(),
  status_apartamento: z.string(),
  area_privativa_apartamento: z.number().nullable(),
  quartos_apartamento: z.number().nullable(),
  suites_apartamento: z.number().nullable(),
  banheiros_apartamento: z.number().nullable(),
  vagas_garagem_apartamento: z.number().nullable(),
  tipo_garagem_apartamento: z.string(),
  sacada_varanda_apartamento: z.boolean(),
  caracteristicas_apartamento: z.string(),
  valor_venda_apartamento: z.number().nullable(),
  titulo_descritivo_apartamento: z.string(),
  descricao_apartamento: z.string(),
  status_publicacao_apartamento: z.string(),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

// Tipo para criação de apartamento
export type CriarApartamento = z.infer<typeof criarApartamentoSchema>;

// Tipo para atualização de apartamento
export type AtualizarApartamento = z.infer<typeof atualizarApartamentoSchema>;

// Tipo para apartamento
export type Apartamento = z.infer<typeof apartamentoSchema>;
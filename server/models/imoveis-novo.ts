import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const imoveisNovo = pgTable('imoveis_novo', {
  id: uuid('id').primaryKey().defaultRandom(),
  referencia: text('referencia').notNull(),
  
  // Dados do Proprietário
  tipoProprietario: varchar('tipo_proprietario', { length: 50 }).notNull().default('Construtora'),
  nomeProprietario: text('nome_proprietario'),
  contatoProprietario: text('contato_proprietario'),
  telefoneProprietario: text('telefone_proprietario'),
  
  // Dados do Tipo de Imóvel
  tipoImovel: varchar('tipo_imovel', { length: 50 }).notNull(),
  
  // Dados do Empreendimento
  nomeEmpreendimento: text('nome_empreendimento'),
  ruaAvenidaEmpreendimento: text('rua_avenida_empreendimento'),
  numeroEmpreendimento: text('numero_empreendimento'),
  complementoEmpreendimento: text('complemento_empreendimento'),
  bairroEmpreendimento: text('bairro_empreendimento'),
  cidadeEmpreendimento: text('cidade_empreendimento'),
  estadoEmpreendimento: varchar('estado_empreendimento', { length: 2 }),
  cepEmpreendimento: text('cep_empreendimento'),
  blocoTorresEmpreendimento: text('bloco_torres_empreendimento'),
  andaresEmpreendimento: text('andares_empreendimento'),
  aptoAndarEmpreendimento: text('apto_andar_empreendimento'),
  valorCondominioEmpreendimento: text('valor_condominio_empreendimento'),
  itensServicosEmpreendimento: jsonb('itens_servicos_empreendimento'),
  itensLazerEmpreendimento: jsonb('itens_lazer_empreendimento'),
  
  // NOVO: Lista completa de apartamentos do empreendimento
  listaApartamentos: jsonb('lista_apartamentos'),
  
  // Dados do Apartamento (mantidos para compatibilidade, representam o 1º apto)
  statusApartamento: text('status_apartamento'),
  areaPrivativaApartamento: text('area_privativa_apartamento'),
  quartosApartamento: text('quartos_apartamento'),
  suitesApartamento: text('suites_apartamento'),
  banheirosApartamento: text('banheiros_apartamento'),
  vagasGaragemApartamento: text('vagas_garagem_apartamento'),
  tipoVagaGaragemApartamento: text('tipo_vaga_garagem_apartamento'),
  sacadaVarandaApartamento: text('sacada_varanda_apartamento'),
  caracteristicasApartamento: jsonb('caracteristicas_apartamento'),
  urlFotoCapaApartamento: text('url_foto_capa_apartamento'),
  urlFotoApartamento: jsonb('url_foto_apartamento'),
  urlVideoApartamento: jsonb('url_video_apartamento'),
  
  // Dados Informações Comerciais
  valorVendaComerciais: text('valor_venda_comerciais').notNull().default('0'),
  tituloDescritivoComerciais: text('titulo_descritivo_comerciais'),
  descricaoCompletaComerciais: text('descricao_completa_comerciais'),
  statusPublicacaoComerciais: varchar('status_publicacao_comerciais', { length: 20 }).notNull().default('Ativo'),
  
  // Campos de controle
  dataCadastro: timestamp('data_cadastro').defaultNow(),
  ultimaAtualizacao: timestamp('ultima_atualizacao').defaultNow(),
});

// Esquema para validação de inserção
export const insertImoveisNovoSchema = createInsertSchema(imoveisNovo)
  .omit({ id: true, dataCadastro: true, ultimaAtualizacao: true });

// Tipos para uso no código
export type InsertImoveisNovo = z.infer<typeof insertImoveisNovoSchema>;
export type ImoveisNovo = typeof imoveisNovo.$inferSelect;
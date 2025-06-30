import { pgTable, text, serial, integer, boolean, timestamp, decimal, numeric, jsonb, time } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Definição do tipo Json para campos jsonb do PostgreSQL
export type Json = 
  | string
  | number
  | boolean
  | null
  | { [key: string]: any }
  | any[];

// User model
export const users = pgTable("sistema_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull(), // "Gestor", "Marketing", "Consultor de Atendimento", "Corretor"
  department: text("department").notNull(), // "Gestão", "Marketing", "Atendimento", "Vendas"
  isActive: boolean("is_active").default(true),
  whatsappInstance: text("whatsapp_instance"),
  whatsappConnected: boolean("whatsapp_connected").default(false),
});

// Enum para fonte do cliente
export const ClienteSource = {
  FACEBOOK: "Facebook",
  FACEBOOK_ADS: "Facebook Ads",
  SITE: "Site",
  INDICACAO: "Indicação",
  WHATSAPP: "WhatsApp",
  LIGACAO: "Ligação",
  INSTAGRAM: "Instagram",
  PORTAIS: "Portais",
  GOOGLE: "Google",
  OUTRO: "Outro"
} as const;

// Enum para método de contato preferido
export const MeioContato = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  TELEFONE: "Telefone",
  PRESENCIAL: "Presencial"
} as const;

// Enum para status do cliente (baseado nos dados reais do banco)
export const ClienteStatus = {
  SEM_ATENDIMENTO: "Sem Atendimento",
  NAO_RESPONDEU: "Não Respondeu",
  EM_ATENDIMENTO: "Em Atendimento",
  AGENDAMENTO: "Agendamento",
  VISITA: "Visita",
  VENDA: "Venda"
} as const;

// Enum para status de leads
export const LeadStatusEnum = {
  NOVO_LEAD: "Novo Lead",
  EM_CONTATO: "Em Contato",
  QUALIFICADO: "Qualificado",
  PROPOSTA: "Proposta",
  NEGOCIACAO: "Negociação",
  FECHADO: "Fechado",
  PERDIDO: "Perdido"
} as const;

// Enum para distribuição de leads
export const DistributionMethodEnum = {
  VOLUME: "volume",
  ROUND_ROBIN: "round_robin",
  WEIGHTED: "weighted"
} as const;

// Enum para roles de usuário
export const UserRole = {
  MANAGER: "Gestor",
  MARKETING: "Marketing", 
  CONSULTANT: "Consultor de Atendimento",
  BROKER_SENIOR: "Corretor Senior",
  EXECUTIVE: "Executivo",
  BROKER_JUNIOR: "Corretor Junior",
  BROKER_TRAINEE: "Corretor Trainee",
} as const;

// Enum para departamentos
export const UserDepartment = {
  GESTAO: "Gestão",
  MARKETING: "Marketing",
  VENDAS: "Vendas",
  ATENDIMENTO: "Central de Atendimento"
} as const;

// Legacy compatibility exports
export const Role = UserRole;
export const Department = UserDepartment;

// WhatsApp Instance Status Enum
export const WhatsAppInstanceStatus = {
  CONNECTED: "Conectado",
  DISCONNECTED: "Desconectado",
  CONNECTING: "Conectando",
  CREATING: "Criando",
  DISCONNECTING: "Desconectando",
  WAITING_QR_SCAN: "Aguardando Scan do QR Code",
  FAILED: "Falha",
  PENDING: "Pendente",
  ERROR: "Erro",
} as const;

// Mapeamento de status da Evolution API para nosso sistema
export const EvolutionAPIStatusMapping = {
  "open": WhatsAppInstanceStatus.CONNECTED,
  "connected": WhatsAppInstanceStatus.CONNECTED,
  "close": WhatsAppInstanceStatus.DISCONNECTED,
  "disconnected": WhatsAppInstanceStatus.DISCONNECTED,
  "connecting": WhatsAppInstanceStatus.CONNECTING,
} as const;

// Enum para tipos de agendamento
export const AppointmentType = {
  VISITA: "Visita",
  REUNIAO: "Reunião",
  ATENDIMENTO: "Atendimento",
  LIGACAO: "Ligação",
  VIDEO_CHAMADA: "Vídeo Chamada"
} as const;

// Enum para status de agendamento
export const AppointmentStatus = {
  AGENDADO: "Agendado",
  CONFIRMADO: "Confirmado",
  EM_ANDAMENTO: "Em Andamento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  NAO_COMPARECEU: "Não Compareceu",
  REAGENDADO: "Reagendado"
} as const;

// Cliente model (antigo Lead)
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  source: text("source"), // "Facebook", "Site", "Indicação", etc.
  sourceDetails: jsonb("source_details").$type<Json>(), // Detalhes da origem (JSON)
  preferredContact: text("preferred_contact"), // Método de contato preferido
  cpf: text("cpf"), // CPF do cliente
  assignedTo: integer("assigned_to").references(() => users.id), // Consultor responsável
  brokerId: integer("broker_id").references(() => users.id), // Corretor responsável
  status: text("status").default("Sem Atendimento"), // Status do cliente no funil de vendas
  hasWhatsapp: boolean("haswhatsapp"), // Cliente tem WhatsApp ativo?
  whatsappJid: text("whatsapp_jid"), // JID do WhatsApp (ex: "553499999999@s.whatsapp.net")
  profilePicUrl: text("profile_pic_url"), // URL da foto de perfil do WhatsApp
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Appointment model
export const appointments = pgTable("clientes_agendamentos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id),
  userId: integer("user_id").references(() => users.id),
  brokerId: integer("broker_id").references(() => users.id), // Corretor responsável pela visita
  assignedTo: integer("assigned_to").references(() => users.id), // Consultor responsável pelo atendimento
  title: text("title"), // Título do agendamento (ex: "Visita - 12/04/2025 14:30")
  type: text("type").notNull(), // "Visita", "Reunião", etc.
  status: text("status").notNull(), // "Agendado", "Cancelado", "Concluído"
  notes: text("notes"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  location: text("location"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Visit model
export const visits = pgTable("clientes_visitas", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id),
  userId: integer("user_id").references(() => users.id),
  brokerId: integer("broker_id").references(() => users.id), // Corretor responsável
  assignedTo: integer("assigned_to").references(() => users.id), // Consultor responsável
  propertyId: text("property_id").notNull(),
  visitedAt: timestamp("visited_at").notNull(),
  notes: text("notes"),
  // Novos campos para registrar detalhes da visita
  temperature: integer("temperature"), // Temperatura da visita (1-5)
  visitDescription: text("visit_description"), // Como foi a visita
  nextSteps: text("next_steps"), // Próximos passos
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sale model
export const sales = pgTable("clientes_vendas", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id),
  userId: integer("user_id").references(() => users.id),
  // Novas colunas para Consultor e Corretor
  consultantId: integer("consultant_id").references(() => users.id),
  assignedTo: integer("assigned_to").references(() => users.id), // Consultor de atendimento responsável
  brokerId: integer("broker_id").references(() => users.id),
  // Campos de venda
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  soldAt: timestamp("sold_at").notNull(),
  notes: text("notes"),
  // Campos detalhados da venda
  cpf: text("cpf"), // CPF do cliente
  propertyType: text("property_type"), // Tipo do imóvel (Apto, Casa, Lote)
  builderName: text("builder_name"), // Nome da construtora/vendedor
  developmentName: text("development_name"), // Nome do empreendimento
  block: text("block"), // Bloco (para apartamentos)
  unit: text("unit"), // Unidade (para apartamentos)
  paymentMethod: text("payment_method"), // Forma de pagamento
  commission: numeric("commission", { precision: 12, scale: 2 }), // Comissão
  bonus: numeric("bonus", { precision: 12, scale: 2 }), // Bônus
  totalCommission: numeric("total_commission", { precision: 12, scale: 2 }), // Comissão total
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Metrics model (to store aggregated metrics)
export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  type: text("type").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  period: text("period"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cliente Notes model (anotações do cliente)
export const clienteNotes = pgTable("clientes_id_anotacoes", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id),
  userId: integer("user_id").references(() => users.id), // Usuário que criou a anotação
  text: text("text").notNull(), // Conteúdo da anotação
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Legacy leads table (alias for sistemaLeads for compatibility)
export const leads = pgTable("sistema_leads", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  source: text("source").notNull(),
  sourceDetails: jsonb("source_details").$type<Json>(),
  status: text("status").default("Novo Lead"),
  assignedTo: integer("assigned_to").references(() => users.id),
  notes: text("notes"),
  isRecurring: boolean("is_recurring").default(false),
  clienteId: integer("cliente_id").references(() => clientes.id),
  tags: jsonb("tags").$type<Json>().default([]),
  lastActivityDate: timestamp("last_activity_date").defaultNow(),
  score: integer("score").default(0),
  interesse: text("interesse"),
  budget: text("budget"),
  metaData: jsonb("meta_data").$type<Json>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sistema de Leads (alias for compatibility)
export const sistemaLeads = leads;

// Sistema de SLA em Cascata - Múltiplos atendimentos por cliente
export const sistemaLeadsCascata = pgTable("sistema_leads_cascata", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id).notNull(),
  leadId: integer("lead_id").references(() => sistemaLeads.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  sequencia: integer("sequencia").notNull(),
  status: text("status").default("Ativo"),
  slaHoras: integer("sla_horas").default(24),
  iniciadoEm: timestamp("iniciado_em").defaultNow(),
  expiraEm: timestamp("expira_em").notNull(),
  finalizadoEm: timestamp("finalizado_em"),
  motivo: text("motivo"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sistema de Configuração de Automação de Leads
export const sistemaConfigAutomacaoLeads = pgTable("sistema_config_automacao_leads", {
  id: serial("id").primaryKey(),
  active: boolean("active").default(true),
  name: text("name").notNull(),
  distributionMethod: text("distribution_method").default("volume"),
  firstContactSla: integer("first_contact_sla").default(30),
  warningPercentage: integer("warning_percentage").default(75),
  criticalPercentage: integer("critical_percentage").default(90),
  autoRedistribute: boolean("auto_redistribute").default(false),
  rotationUsers: jsonb("rotation_users").$type<Json>().default([]),
  byName: boolean("by_name").default(true),
  byPhone: boolean("by_phone").default(true),
  byEmail: boolean("by_email").default(true),
  keepSameConsultant: boolean("keep_same_consultant").default(true),
  assignNewConsultant: boolean("assign_new_consultant").default(false),
  cascadeSlaHours: integer("cascade_sla_hours").default(24),
  cascadeUserOrder: jsonb("cascade_user_order").$type<Json>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sistema de Metas
export const sistemaMetas = pgTable("sistema_metas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  periodo: text("periodo").default("mensal"),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(),
  agendamentos: integer("agendamentos").default(0),
  visitas: integer("visitas").default(0),
  vendas: integer("vendas").default(0),
  conversaoAgendamentos: integer("conversao_agendamentos").default(0),
  conversaoVisitas: integer("conversao_visitas").default(0),
  conversaoVendas: integer("conversao_vendas").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sistema de Horários dos Usuários
export const sistemaUsersHorarios = pgTable("sistema_users_horarios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  diaSemana: text("dia_semana").notNull(),
  horarioInicio: time("horario_inicio").notNull(),
  horarioFim: time("horario_fim").notNull(),
  diaTodo: boolean("dia_todo").default(false),
});

// Sistema de Instâncias WhatsApp
export const sistema_whatsapp_instances = pgTable("sistema_whatsapp_instances", {
  instanciaId: text("instancia_id").primaryKey(),
  instanceName: text("instance_name").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  instanceStatus: text("instance_status"),
  base64: text("base64"),
  webhook: text("webhook"),
  remoteJid: text("remote_jid"),
  lastConnection: timestamp("last_connection"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Alias para compatibilidade
export const sistemaWhatsappInstances = sistema_whatsapp_instances;

export type WhatsappInstance = typeof sistema_whatsapp_instances.$inferSelect;
export type InsertWhatsappInstance = typeof sistema_whatsapp_instances.$inferInsert;



// Sistema de Configuração Facebook
export const sistemaFacebookConfig = pgTable("sistema_facebook_config", {
  id: serial("id").primaryKey(),
  appId: text("app_id").notNull(),
  appSecret: text("app_secret").notNull(),
  accessToken: text("access_token").notNull(),
  userAccessToken: text("user_access_token"),
  verificationToken: text("verification_token"),
  pageId: text("page_id"),
  adAccountId: text("ad_account_id"),
  webhookEnabled: boolean("webhook_enabled").default(false),
  isActive: boolean("is_active").default(true),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sistema de Conteúdo Diário
export const sistemaDailyContent = pgTable("sistema_daily_content", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").default("true"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Imóveis - Construtoras
export const imoveisConstrutoras = pgTable("imoveis_construtoras", {
  idConstrutora: serial("id_construtora").primaryKey(),
  nomeConstrutora: text("nome_construtora").notNull(),
  razaoSocial: text("razao_social"),
  cpfCnpj: text("cpf_cnpj"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Imóveis - Contatos da Construtora
export const imoveisContatosConstrutora = pgTable("imoveis_contatos_construtora", {
  idContatoConstrutora: serial("id_contato_construtora").primaryKey(),
  idConstrutora: integer("id_construtora").references(() => imoveisConstrutoras.idConstrutora),
  nome: text("nome").notNull(),
  telefone: text("telefone").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Imóveis - Proprietários Pessoa Física
export const imoveisProprietariosPf = pgTable("imoveis_proprietarios_pf", {
  idProprietarioPf: serial("id_proprietario_pf").primaryKey(),
  nome: text("nome").notNull(),
  telefone: text("telefone").notNull(),
  email: text("email"),
  cpf: text("cpf"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Imóveis - Empreendimentos
export const imoveisEmpreendimentos = pgTable("imoveis_empreendimentos", {
  idEmpreendimento: serial("id_empreendimento").primaryKey(),
  tipoProprietario: text("tipo_proprietario"),
  nomeProprietario: text("nome_proprietario"),
  contatoProprietario: text("contato_proprietario"),
  telefoneProprietario: text("telefone_proprietario"),
  tipoImovel: text("tipo_imovel"),
  nomeEmpreendimento: text("nome_empreendimento"),
  ruaAvenidaEmpreendimento: text("rua_avenida_empreendimento"),
  numeroEmpreendimento: text("numero_empreendimento"),
  complementoEmpreendimento: text("complemento_empreendimento"),
  bairroEmpreendimento: text("bairro_empreendimento"),
  cidadeEmpreendimento: text("cidade_empreendimento"),
  estadoEmpreendimento: text("estado_empreendimento"),
  cepEmpreendimento: text("cep_empreendimento"),
  zonaEmpreendimento: text("zona_empreendimento"),
  blocoTorresEmpreendimento: text("bloco_torres_empreendimento"),
  andaresEmpreendimento: text("andares_empreendimento"),
  aptoAndarEmpreendimento: text("apto_andar_empreendimento"),
  valorCondominioEmpreendimento: text("valor_condominio_empreendimento"),
  prazoEntregaEmpreendimento: text("prazo_entrega_empreendimento"),
  status: text("status"),
  idConstrutora: integer("id_construtora").references(() => imoveisConstrutoras.idConstrutora),
  itensServicosEmpreendimento: jsonb("itens_servicos_empreendimento").$type<Json>(),
  itensLazerEmpreendimento: jsonb("itens_lazer_empreendimento").$type<Json>(),
  urlFotoCapaEmpreendimento: jsonb("url_foto_capa_empreendimento").$type<Json>(),
  urlFotoEmpreendimento: jsonb("url_foto_empreendimento").$type<Json>(),
  urlVideoEmpreendimento: jsonb("url_video_empreendimento").$type<Json>(),
  dataCadastro: timestamp("data_cadastro").defaultNow(),
  ultimaAtualizacao: timestamp("ultima_atualizacao").defaultNow(),
});

// Imóveis - Apartamentos
export const imoveisApartamentos = pgTable("imoveis_apartamentos", {
  idApartamento: serial("id_apartamento").primaryKey(),
  idEmpreendimento: integer("id_empreendimento").references(() => imoveisEmpreendimentos.idEmpreendimento).notNull(),
  statusApartamento: text("status_apartamento"),
  areaPrivativaApartamento: numeric("area_privativa_apartamento"),
  quartosApartamento: integer("quartos_apartamento"),
  suitesApartamento: integer("suites_apartamento"),
  banheirosApartamento: integer("banheiros_apartamento"),
  vagasGaragemApartamento: integer("vagas_garagem_apartamento"),
  tipoGaragemApartamento: text("tipo_garagem_apartamento"),
  sacadaVarandaApartamento: boolean("sacada_varanda_apartamento"),
  caracteristicasApartamento: text("caracteristicas_apartamento"),
  valorVendaApartamento: numeric("valor_venda_apartamento"),
  tituloDescritivoApartamento: text("titulo_descritivo_apartamento"),
  descricaoApartamento: text("descricao_apartamento"),
  statusPublicacaoApartamento: text("status_publicacao_apartamento"),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
// Schema para atualização de usuários (senha opcional)
export const updateUserSchema = createInsertSchema(users)
  .omit({ id: true })
  .extend({
    passwordHash: z.string().optional(),
  });
export const insertClienteSchema = createInsertSchema(clientes).omit({ id: true, createdAt: true, updatedAt: true });
// Schema específico para atualização parcial de clientes
export const updateClienteSchema = insertClienteSchema.partial();
// Primeiro criamos o schema básico de inserção
const baseInsertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, updatedAt: true });

// Depois modificamos para aceitar tanto Date quanto string para scheduledAt
export const insertAppointmentSchema = baseInsertAppointmentSchema.extend({
  scheduledAt: z.union([
    z.date(),
    z.string().refine((value) => !isNaN(Date.parse(value)), {
      message: "Invalid date string",
    }).transform(value => new Date(value))
  ])
});
// Primeiro criamos o schema básico de inserção para visitas
const baseInsertVisitSchema = createInsertSchema(visits).omit({ id: true, createdAt: true });

// Depois modificamos para aceitar tanto Date quanto string para visitedAt
export const insertVisitSchema = baseInsertVisitSchema.extend({
  visitedAt: z.union([
    z.date(),
    z.string().refine((value) => !isNaN(Date.parse(value)), {
      message: "Invalid date string",
    }).transform(value => new Date(value))
  ])
});

export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMetricSchema = createInsertSchema(metrics).omit({ id: true, createdAt: true });
export const insertClienteNoteSchema = createInsertSchema(clienteNotes).omit({ id: true, createdAt: true, updatedAt: true });

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type UpdateCliente = z.infer<typeof updateClienteSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type Visit = typeof visits.$inferSelect;
export type InsertVisit = z.infer<typeof insertVisitSchema>;

export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;

export type ClienteNote = typeof clienteNotes.$inferSelect;
export type InsertClienteNote = z.infer<typeof insertClienteNoteSchema>;

export type SistemaLead = typeof sistemaLeads.$inferSelect;
export type SistemaLeadsCascata = typeof sistemaLeadsCascata.$inferSelect;
export type SistemaConfigAutomacaoLeads = typeof sistemaConfigAutomacaoLeads.$inferSelect;
export type SistemaMetas = typeof sistemaMetas.$inferSelect;
export type SistemaUsersHorarios = typeof sistemaUsersHorarios.$inferSelect;
export type SistemaWhatsappInstances = typeof sistemaWhatsappInstances.$inferSelect;
export type SistemaFacebookConfig = typeof sistemaFacebookConfig.$inferSelect;
export type SistemaDailyContent = typeof sistemaDailyContent.$inferSelect;

export type ImoveisConstrutoras = typeof imoveisConstrutoras.$inferSelect;
export type ImoveisContatosConstrutora = typeof imoveisContatosConstrutora.$inferSelect;
export type ImoveisProprietariosPf = typeof imoveisProprietariosPf.$inferSelect;
export type ImoveisEmpreendimentos = typeof imoveisEmpreendimentos.$inferSelect;
export type ImoveisApartamentos = typeof imoveisApartamentos.$inferSelect;

// Schemas de inserção para as novas tabelas
export const insertSistemaLeadSchema = createInsertSchema(sistemaLeads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSistemaMetasSchema = createInsertSchema(sistemaMetas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSistemaUsersHorariosSchema = createInsertSchema(sistemaUsersHorarios).omit({ id: true });
export const insertSistemaWhatsappInstancesSchema = createInsertSchema(sistemaWhatsappInstances).omit({ 
  instanciaId: true, // Gerado automaticamente pelo servidor
  createdAt: true, 
  updatedAt: true 
});
export const insertSistemaFacebookConfigSchema = createInsertSchema(sistemaFacebookConfig).omit({ id: true, createdAt: true, updatedAt: true, lastUpdated: true });
export const insertSistemaDailyContentSchema = createInsertSchema(sistemaDailyContent).omit({ id: true, createdAt: true });

export const insertImoveisConstructorasSchema = createInsertSchema(imoveisConstrutoras).omit({ idConstrutora: true, createdAt: true, updatedAt: true });
export const insertImoveisContatosConstructoraSchema = createInsertSchema(imoveisContatosConstrutora).omit({ idContatoConstrutora: true, createdAt: true, updatedAt: true });
export const insertImoveisProprietariosPfSchema = createInsertSchema(imoveisProprietariosPf).omit({ idProprietarioPf: true, createdAt: true, updatedAt: true });
export const insertImoveisEmpreendimentosSchema = createInsertSchema(imoveisEmpreendimentos).omit({ idEmpreendimento: true, dataCadastro: true, ultimaAtualizacao: true });
export const insertImoveisApartamentosSchema = createInsertSchema(imoveisApartamentos).omit({ idApartamento: true });

// Tipos de inserção para as novas tabelas
export type InsertSistemaLead = z.infer<typeof insertSistemaLeadSchema>;
export type InsertSistemaMetas = z.infer<typeof insertSistemaMetasSchema>;
export type InsertSistemaUsersHorarios = z.infer<typeof insertSistemaUsersHorariosSchema>;
export type InsertSistemaWhatsappInstances = z.infer<typeof insertSistemaWhatsappInstancesSchema>;
export type InsertSistemaFacebookConfig = z.infer<typeof insertSistemaFacebookConfigSchema>;
export type InsertSistemaDailyContent = z.infer<typeof insertSistemaDailyContentSchema>;

export type InsertImoveisConstrutoras = z.infer<typeof insertImoveisConstructorasSchema>;
export type InsertImoveisContatosConstrutora = z.infer<typeof insertImoveisContatosConstructoraSchema>;
export type InsertImoveisProprietariosPf = z.infer<typeof insertImoveisProprietariosPfSchema>;
export type InsertImoveisEmpreendimentos = z.infer<typeof insertImoveisEmpreendimentosSchema>;
export type InsertImoveisApartamentos = z.infer<typeof insertImoveisApartamentosSchema>;

// Legacy Lead types for compatibility
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertSistemaLeadSchema>;
export type UpdateLead = Partial<InsertLead>;

// WhatsApp Instance types
export type WhatsappInstance = typeof sistemaWhatsappInstances.$inferSelect;
export type InsertWhatsappInstance = z.infer<typeof insertSistemaWhatsappInstancesSchema>;

// WhatsApp Log types for compatibility
export interface WhatsappLog {
  id: number;
  instanceId?: string | null;
  type: string;
  message: string;
  data?: any;
  createdAt: Date;
}

export interface InsertWhatsappLog {
  instanceId?: string | null;
  type: string;
  message: string;
  data?: any;
}

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  assignedClientes: many(clientes, { relationName: "cliente_assigned_user" }),
  brokerClientes: many(clientes, { relationName: "cliente_broker_user" }),
  appointments: many(appointments),
  visits: many(visits),
  sales: many(sales),
  metrics: many(metrics),
  clienteNotes: many(clienteNotes),
  sistemaLeads: many(sistemaLeads),
}));

export const clientesRelations = relations(clientes, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [clientes.assignedTo],
    references: [users.id],
    relationName: "cliente_assigned_user"
  }),
  broker: one(users, {
    fields: [clientes.brokerId],
    references: [users.id],
    relationName: "cliente_broker_user"
  }),
  appointments: many(appointments),
  visits: many(visits),
  sales: many(sales),
  notes: many(clienteNotes),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  cliente: one(clientes, {
    fields: [appointments.clienteId],
    references: [clientes.id],
  }),
  user: one(users, {
    fields: [appointments.userId],
    references: [users.id],
  }),
}));

export const visitsRelations = relations(visits, ({ one }) => ({
  cliente: one(clientes, {
    fields: [visits.clienteId],
    references: [clientes.id],
  }),
  user: one(users, {
    fields: [visits.userId],
    references: [users.id],
  }),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  cliente: one(clientes, {
    fields: [sales.clienteId],
    references: [clientes.id],
  }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
  }),
}));

export const clienteNotesRelations = relations(clienteNotes, ({ one }) => ({
  cliente: one(clientes, {
    fields: [clienteNotes.clienteId],
    references: [clientes.id],
  }),
  user: one(users, {
    fields: [clienteNotes.userId],
    references: [users.id],
  }),
}));

export const sistemaLeadsRelations = relations(sistemaLeads, ({ one }) => ({
  assignedUser: one(users, {
    fields: [sistemaLeads.assignedTo],
    references: [users.id],
  }),
  cliente: one(clientes, {
    fields: [sistemaLeads.clienteId],
    references: [clientes.id],
  }),
}));

export const imoveisEmpreendimentosRelations = relations(imoveisEmpreendimentos, ({ one, many }) => ({
  construtora: one(imoveisConstrutoras, {
    fields: [imoveisEmpreendimentos.idConstrutora],
    references: [imoveisConstrutoras.idConstrutora],
  }),
  apartamentos: many(imoveisApartamentos),
}));

export const imoveisApartamentosRelations = relations(imoveisApartamentos, ({ one }) => ({
  empreendimento: one(imoveisEmpreendimentos, {
    fields: [imoveisApartamentos.idEmpreendimento],
    references: [imoveisEmpreendimentos.idEmpreendimento],
  }),
}));

export const imoveisContatosConstructoraRelations = relations(imoveisContatosConstrutora, ({ one }) => ({
  construtora: one(imoveisConstrutoras, {
    fields: [imoveisContatosConstrutora.idConstrutora],
    references: [imoveisConstrutoras.idConstrutora],
  }),
}));

// Legacy compatibility exports (placed at end to avoid declaration order issues)
export const whatsappInstances = sistemaWhatsappInstances;
export const insertWhatsappInstanceSchema = insertSistemaWhatsappInstancesSchema;
export const facebookConfig = sistemaFacebookConfig;
export const leadAutomationConfig = sistemaConfigAutomacaoLeads;
export const insertLeadSchema = insertSistemaLeadSchema;
export const updateLeadSchema = insertSistemaLeadSchema.partial();

// Create the missing lead automation config schema
export const insertLeadAutomationConfigSchema = createInsertSchema(sistemaConfigAutomacaoLeads).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const updateLeadAutomationConfigSchema = insertLeadAutomationConfigSchema.partial();
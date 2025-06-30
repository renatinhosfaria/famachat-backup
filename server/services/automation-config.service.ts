/**
 * Serviço para gerenciar as configurações de automação de leads
 */
import { db } from '../database';
import { eq } from 'drizzle-orm';
import { 
  leadAutomationConfig, 
  type LeadAutomationConfig,
  type InsertLeadAutomationConfig,
  type UpdateLeadAutomationConfig 
} from '@shared/schema';
import { Cache } from '../utils/cache';
import { logger } from '../utils/logger';

// Inicializa o logger para o serviço de configuração de automação
const automationConfigLogger = logger.createLogger("AutomationConfig");

// Cache para configurações de automação (5 minutos)
const CACHE_TTL = 5 * 60 * 1000; 
const CACHE_KEY = 'lead_automation_config';
const automationCache = new Cache<LeadAutomationConfig>(CACHE_TTL);

/**
 * Obtém a configuração de automação atual
 * Caso não exista nenhuma configuração, cria uma configuração padrão
 */
export async function getAutomationConfig(): Promise<LeadAutomationConfig> {
  // Verifica se as configurações estão em cache
  const cachedConfig = automationCache.get(CACHE_KEY);
  if (cachedConfig) {
    automationConfigLogger.debug('Usando configuração de automação em cache');
    return cachedConfig;
  }
  automationConfigLogger.debug('Configuração não encontrada em cache, buscando no banco de dados');

  // Busca a configuração ativa no banco de dados
  const configs = await db
    .select()
    .from(leadAutomationConfig)
    .where(eq(leadAutomationConfig.active, true))
    .limit(1);

  // Se existir, retorna a configuração
  if (configs.length > 0) {
    // Armazena em cache
    automationConfigLogger.debug(`Configuração encontrada com ID: ${configs[0].id}`);
    automationCache.set(CACHE_KEY, configs[0]);
    return configs[0];
  }

  // Se não existir, cria uma configuração padrão
  automationConfigLogger.info('Nenhuma configuração ativa encontrada, criando configuração padrão');
  return await createDefaultConfig();
}

/**
 * Obtém todas as configurações de automação
 */
export async function getAllAutomationConfigs(): Promise<LeadAutomationConfig[]> {
  return await db
    .select()
    .from(leadAutomationConfig)
    .orderBy(leadAutomationConfig.createdAt);
}

/**
 * Obtém uma configuração específica pelo ID
 */
export async function getAutomationConfigById(id: number): Promise<LeadAutomationConfig | undefined> {
  const configs = await db
    .select()
    .from(leadAutomationConfig)
    .where(eq(leadAutomationConfig.id, id))
    .limit(1);

  return configs.length > 0 ? configs[0] : undefined;
}

/**
 * Cria uma nova configuração de automação
 */
export async function createAutomationConfig(
  config: InsertLeadAutomationConfig
): Promise<LeadAutomationConfig> {
  // Log para verificar dados de entrada
  automationConfigLogger.debug(`Criando configuração de automação com dados: ${JSON.stringify(config, null, 2)}`);
  automationConfigLogger.debug(`Usuários selecionados/rotação: ${JSON.stringify(config.rotationUsers)}`);
  
  // Se a nova configuração estiver ativa, desativa todas as outras
  if (config.active) {
    await deactivateAllConfigs();
  }

  // Insere a nova configuração
  const [newConfig] = await db
    .insert(leadAutomationConfig)
    .values(config)
    .returning();

  // Log para verificar dados gravados
  automationConfigLogger.debug(`Nova configuração criada: ${JSON.stringify(newConfig)}`);
  if (newConfig.rotationUsers && Array.isArray(newConfig.rotationUsers)) {
    automationConfigLogger.debug(`Usuários gravados: ${JSON.stringify(newConfig.rotationUsers)}`);
  } else {
    automationConfigLogger.debug(`Usuários não definidos ou não em formato de array`);
  }
  
  // Limpa o cache
  clearConfigCache();

  return newConfig;
}

/**
 * Atualiza uma configuração de automação existente
 */
export async function updateAutomationConfig(
  id: number,
  config: UpdateLeadAutomationConfig
): Promise<LeadAutomationConfig | undefined> {
  // Log para verificar dados de entrada
  automationConfigLogger.debug(`Atualizando configuração de automação ID ${id} com dados: ${JSON.stringify(config, null, 2)}`);
  automationConfigLogger.debug(`Usuários selecionados/rotação: ${JSON.stringify(config.rotationUsers)}`);
  
  // Se a configuração atualizada estiver ativa, desativa todas as outras
  if (config.active) {
    await deactivateAllConfigs();
  }

  // Atualiza a configuração
  const [updatedConfig] = await db
    .update(leadAutomationConfig)
    .set({
      ...config,
      updatedAt: new Date()
    })
    .where(eq(leadAutomationConfig.id, id))
    .returning();

  // Log para verificar dados gravados
  automationConfigLogger.debug(`Configuração atualizada: ${JSON.stringify(updatedConfig)}`);
  if (updatedConfig.rotationUsers && Array.isArray(updatedConfig.rotationUsers)) {
    automationConfigLogger.debug(`Usuários gravados: ${JSON.stringify(updatedConfig.rotationUsers)}`);
  } else {
    automationConfigLogger.debug(`Usuários não definidos ou não em formato de array`);
  }
  
  // Limpa o cache
  clearConfigCache();

  return updatedConfig;
}

/**
 * Exclui uma configuração de automação
 */
export async function deleteAutomationConfig(
  id: number
): Promise<boolean> {
  const result = await db
    .delete(leadAutomationConfig)
    .where(eq(leadAutomationConfig.id, id))
    .returning({ id: leadAutomationConfig.id });

  // Limpa o cache
  clearConfigCache();

  return result.length > 0;
}

/**
 * Desativa todas as configurações
 */
async function deactivateAllConfigs(): Promise<void> {
  automationConfigLogger.debug('Desativando todas as configurações ativas');
  const result = await db
    .update(leadAutomationConfig)
    .set({ active: false })
    .where(eq(leadAutomationConfig.active, true))
    .returning({ id: leadAutomationConfig.id });
    
  if (result.length > 0) {
    automationConfigLogger.debug(`Desativadas ${result.length} configurações: ${JSON.stringify(result.map(r => r.id))}`);
  } else {
    automationConfigLogger.debug('Nenhuma configuração ativa encontrada para desativar');
  }
}

/**
 * Cria uma configuração padrão
 */
async function createDefaultConfig(): Promise<LeadAutomationConfig> {
  const defaultConfig: InsertLeadAutomationConfig = {
    name: "Configuração Padrão",
    active: true,
    distributionMethod: "volume",
    
    // Configurações de identificação de leads recorrentes (novas colunas)
    byName: true,
    byPhone: true,
    byEmail: true,
    keepSameConsultant: true,
    assignNewConsultant: false,
    
    // Colunas originais mantidas
    firstContactSLA: 30,
    warningPercentage: 75,
    criticalPercentage: 90,
    autoRedistribute: false,
    
    // Array vazio de usuários para rotação
    rotationUsers: []
  };

  const [newConfig] = await db
    .insert(leadAutomationConfig)
    .values(defaultConfig)
    .returning();
    
  automationConfigLogger.info(`Configuração padrão criada com ID: ${newConfig.id}`);

  return newConfig;
}

/**
 * Limpa o cache de configurações
 */
function clearConfigCache(): void {
  automationCache.delete(CACHE_KEY);
  automationConfigLogger.debug('Cache de configuração de automação limpo');
}
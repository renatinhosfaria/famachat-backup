// Funções de utilitário que podem ser compartilhadas por todo o servidor
import bcrypt from 'bcrypt';
import { logger } from './utils/logger';

// Inicializa o logger para funções utilitárias
const utilsLogger = logger.createLogger("Utils");

// Mantém o enum LogLevel para retrocompatibilidade temporariamente
// DEPRECATED: Use a classe Logger diretamente
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Função de log melhorada para registrar mensagens estruturadas
 * @deprecated Use a classe Logger do arquivo utils/logger.ts
 * @param message Mensagem a ser registrada
 * @param level Nível de log (debug, info, warn, error)
 * @param context Objeto com informações adicionais para o log
 */
export function log(
  message: string, 
  level: LogLevel | 'info' | 'warn' | 'error' | 'debug' = LogLevel.INFO, 
  context?: Record<string, any>
): void {
  // Normaliza o nível de log
  const normalizedLevel = typeof level === 'string' ? level.toLowerCase() : level;
  
  // Usa o novo sistema de Logger
  switch (normalizedLevel) {
    case LogLevel.DEBUG:
    case 'debug':
      utilsLogger.debug(message, context);
      break;
    case LogLevel.WARN:
    case 'warn':
      utilsLogger.warn(message, context);
      break;
    case LogLevel.ERROR:
    case 'error':
      utilsLogger.error(message, context);
      break;
    case LogLevel.INFO:
    case 'info':
    default:
      utilsLogger.info(message, context);
  }
}

/**
 * Formata um número como valor monetário em Reais (R$)
 * @param value Valor numérico
 * @returns String formatada como moeda
 */
export function formatCurrency(value: number | string): string {
  // Certificar que o valor é um número
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return 'R$ 0,00';
  }
  
  // Formatar com Intl.NumberFormat
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numValue);
}

/**
 * Formata uma data no padrão brasileiro (DD/MM/YYYY)
 * @param date Objeto Date ou string representando uma data
 * @returns String formatada como data no padrão brasileiro
 */
export function formatDate(date: Date | string): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  return dateObj.toLocaleDateString('pt-BR');
}

/**
 * Utilitário para gerar um ID único usando UUID v4
 * @returns String com ID único no formato UUID
 */
export function generateUniqueId(): string {
  // Usar a API crypto do Node.js para gerar UUID v4
  const { randomUUID } = require('crypto');
  return randomUUID();
}

/**
 * Verifica se um valor é nulo ou indefinido
 * @param value Valor a ser verificado
 * @returns Booleano indicando se o valor é nulo ou indefinido
 */
export function isNullOrUndefined(value: any): boolean {
  return value === null || value === undefined;
}

/**
 * Configurações de segurança para hash de senha
 */
const SALT_ROUNDS = 12; // Número de rodadas para geração de salt (recomendado: 10-12)

/**
 * Hash seguro de senha usando bcrypt
 * @param password Senha em texto plano
 * @returns Hash da senha
 */
export async function hashPassword(password: string): Promise<string> {
  // Valida a entrada
  if (!password || password.length < 6) {
    throw new Error('Senha inválida: deve conter pelo menos 6 caracteres');
  }
  
  try {
    // Gera o salt e o hash em uma única operação
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    utilsLogger.error(`Erro ao gerar hash de senha: ${error}`);
    throw new Error('Erro ao criar hash de senha');
  }
}

/**
 * Verifica se uma senha corresponde ao hash armazenado
 * @param password Senha em texto plano
 * @param hash Hash armazenado
 * @returns Booleano indicando se a senha está correta
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    utilsLogger.error(`Erro ao verificar senha: ${error}`);
    return false;
  }
}

/**
 * Verifica se uma string parece ser um hash bcrypt
 * @param str String a ser verificada
 * @returns Verdadeiro se a string parecer um hash bcrypt
 */
export function isBcryptHash(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }
  
  // Hash bcrypt começa com '$2a$', '$2b$' ou '$2y$' e tem comprimento fixo
  const bcryptPattern = /^\$2[aby]\$\d+\$/;
  return bcryptPattern.test(str) && str.length === 60;
}

/**
 * Garante que uma senha seja armazenada como hash
 * Útil para API endpoints que recebem senhas em texto plano
 * @param passwordInput Senha em texto plano ou já hasheada
 * @returns Hash da senha
 */
export async function ensurePasswordHashed(passwordInput: string): Promise<string> {
  // Se a entrada já for hash, retorná-la
  if (isBcryptHash(passwordInput)) {
    return passwordInput;
  }
  
  // Caso contrário, hashear a senha
  return await hashPassword(passwordInput);
}
import { randomUUID } from 'crypto';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Registra uma mensagem de log com informações contextuais
 * @param level Nível do log (DEBUG, INFO, WARN, ERROR)
 * @param message Mensagem de log
 * @param data Dados adicionais (serão serializados)
 * @param exception Exceção, se aplicável
 */
export function log(
  level: LogLevel,
  message: string,
  data?: Record<string, any>,
  exception?: Error
): void {
  // Para produção, poderíamos enviar para um serviço externo
  const timestamp = new Date().toISOString();
  const requestId = process.env.REQUEST_ID || 'no-request-id';
  
  // Sanitizar dados sensíveis
  const sanitizedData = data ? sanitizeData(data) : undefined;
  
  // Formatar a mensagem para facilitar a leitura
  const logEntry = {
    timestamp,
    level,
    message,
    requestId,
    data: sanitizedData,
  };

  // Em produção podemos usar um serviço externo
  if (level === LogLevel.ERROR) {
    if (exception) {
      , exception);
    } else {
      );
    }
  } else if (level === LogLevel.WARN) {
    );
  } else if (level === LogLevel.INFO) {
    );
  } else {
    // DEBUG - apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      );
    }
  }
}

/**
 * Sanitiza dados para evitar que informações sensíveis sejam logadas
 * @param data Dados a serem sanitizados
 * @returns Dados sanitizados
 */
function sanitizeData(data: Record<string, any>): Record<string, any> {
  const sensitiveFields = ['password', 'senha', 'token', 'secret', 'apiKey'];
  const result: Record<string, any> = {};
  
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      
      // Verifica se é um campo sensível
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } 
      // Recursivamente sanitiza objetos
      else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeData(value);
      } 
      // Mantém valores não-sensíveis
      else {
        result[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Gera um ID único para rastreamento de requisições
 * @returns ID único
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Cria middleware para adicionar ID de requisição
 */
export function requestIdMiddleware(req: any, res: any, next: any): void {
  const requestId = generateRequestId();
  process.env.REQUEST_ID = requestId;
  req.requestId = requestId;
  
  // Adiciona request ID ao header de resposta
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

/**
 * Verifica se uma variável é nula ou indefinida
 * @param value Valor a verificar
 * @returns true se for nulo ou indefinido
 */
export function isNullOrUndefined(value: any): boolean {
  return value === null || value === undefined;
}

/**
 * Recupera um valor de um objeto de forma segura
 * @param obj Objeto
 * @param key Chave
 * @returns Valor ou null se o objeto for nulo/indefinido
 */
export function safeGet<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] | null {
  if (isNullOrUndefined(obj)) {
    return null;
  }
  return obj[key];
}
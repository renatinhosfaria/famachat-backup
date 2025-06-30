/**
 * Utilitário de logging para o servidor 
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export class Logger {
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG][${this.context}] ${message}`, data || '');
    }
  }

  info(message: string, data?: any): void {
    console.log(`[INFO][${this.context}] ${message}`, data || '');
  }

  warn(message: string, data?: any): void {
    console.warn(`[WARN][${this.context}] ${message}`, data || '');
  }

  error(message: string, error?: any): void {
    console.error(`[ERROR][${this.context}] ${message}`, error || '');
  }
}

// Classe singleton que permite criar múltiplas instâncias de logger com diferentes contextos
class LoggerFactory {
  private instances: Map<string, Logger> = new Map();
  private defaultLogger: Logger;

  constructor() {
    this.defaultLogger = new Logger();
  }

  createLogger(context: string): Logger {
    if (!this.instances.has(context)) {
      this.instances.set(context, new Logger(context));
    }
    return this.instances.get(context)!;
  }

  // Métodos de conveniência para usar o logger padrão
  debug(message: string, data?: any): void {
    this.defaultLogger.debug(message, data);
  }

  info(message: string, data?: any): void {
    this.defaultLogger.info(message, data);
  }

  warn(message: string, data?: any): void {
    this.defaultLogger.warn(message, data);
  }

  error(message: string, error?: any): void {
    this.defaultLogger.error(message, error);
  }
}

export const logger = new LoggerFactory();
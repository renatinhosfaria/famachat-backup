import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

// Interface para erro com código de status
interface AppError extends Error {
  statusCode?: number;
  errorId?: string;
}

/**
 * Middleware global para tratamento de erros
 * @param err Erro capturado
 * @param req Request do Express
 * @param res Response do Express
 * @param next Função next
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Gera um ID único para o erro para rastreamento
  const errorId = randomUUID();
  
  // Assume status 500 como padrão
  let statusCode = 500;
  let errorMessage = 'Erro interno do servidor';
  let errorDetails: any = undefined;
  
  // Verifica se é um erro com código de status
  if ((err as AppError).statusCode) {
    statusCode = (err as AppError).statusCode;
  }
  
  // Tratamento específico para erros de validação do Zod
  if (err instanceof ZodError) {
    statusCode = 400;
    const validationError = fromZodError(err);
    errorMessage = 'Erro de validação';
    errorDetails = validationError.details;
  }
  
  // Log do erro completo (apenas para o servidor)
  
  
  if (req.path.startsWith('/api')) {
    // Para API, retorna JSON com detalhes do erro
    return res.status(statusCode).json({
      success: false,
      error: {
        message: errorMessage,
        id: errorId,
        details: errorDetails,
      }
    });
  } else {
    // Para rotas não-API, renderiza uma página de erro ou redireciona
    return res.status(statusCode).send(`
      <html>
        <head>
          <title>Erro ${statusCode}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
            h1 { color: #c00; }
            code { background: #f5f5f5; padding: 0.2rem; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>Erro ${statusCode}</h1>
          <p>${errorMessage}</p>
          <p>ID do erro: <code>${errorId}</code></p>
          <p>Por favor, tente novamente ou contate o suporte com este ID.</p>
          <a href="/">Voltar para o início</a>
        </body>
      </html>
    `);
  }
}

/**
 * Factory para criação de erros com status code
 * @param message Mensagem de erro
 * @param statusCode Código HTTP do erro (default: 500)
 * @returns AppError
 */
export function createError(message: string, statusCode = 500): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  return error;
}

/**
 * Middleware para lidar com rotas não encontradas
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = createError('Rota não encontrada', 404);
  next(error);
}
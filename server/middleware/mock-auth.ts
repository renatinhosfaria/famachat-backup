import { Request, Response, NextFunction } from "express";
import { db } from "../database";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";

// Inicializa o logger para este middleware
const authLogger = logger.createLogger("Auth:Mock");

// Extender o tipo Request para incluir sessão
declare global {
  namespace Express {
    interface Request {
      session?: {
        userId?: number;
      };
    }
  }
}

/**
 * Middleware de simulação de autenticação para desenvolvimento
 * Permite acesso às rotas protegidas para demonstração
 * 
 * Este middleware deve ser removido em produção e substituído por
 * um sistema real de autenticação e sessão
 */
export const mockAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Se já temos um userId na sessão, não precisamos fazer nada
    if (req.session && req.session.userId) {
      return next();
    }

    // Para fins de demonstração, usamos o ID 1 (Renato - administrador)
    // ou o ID fornecido em um header especial X-Mock-User-ID
    const mockUserId = req.headers['x-mock-user-id'] ? 
      parseInt(req.headers['x-mock-user-id'] as string) : 1;

    // Simulamos uma sessão para o usuário
    if (!req.session) {
      // Criar uma sessão mock se req.session não existir
      (req as any).session = {};
    }
    
    // Adicionar userId à sessão
    (req.session as any).userId = mockUserId;
    
    // Verificamos se o usuário existe na base de dados
    const user = await db.query.users.findFirst({
      where: eq(users.id, mockUserId)
    });
    
    if (!user) {
      authLogger.warn(`Autenticação simulada: Usuário ${mockUserId} não encontrado na base de dados`);
    } else {
      authLogger.info(`Autenticação simulada: Usando usuário ${user.username} (ID: ${mockUserId})`);
    }

    next();
  } catch (error) {
    authLogger.error(`Erro no middleware de autenticação simulada: ${error}`);
    next();
  }
};
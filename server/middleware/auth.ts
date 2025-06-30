import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Interface para representar o usuário autenticado na requisição
 */
interface AuthenticatedUser {
  id: number;
  username: string;
  role: string;
}

/**
 * Estende o tipo de Request para incluir o usuário autenticado
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware de autenticação
 * Verifica se o token JWT é válido e adiciona o usuário na requisição
 */
export const auth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Token de autenticação não fornecido' 
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_key';
    const decoded = jwt.verify(token, secret) as AuthenticatedUser;
    
    console.log(`[Auth Middleware] Token decodificado: ${JSON.stringify(decoded)}`);
    
    // Adiciona o usuário à requisição
    req.user = decoded;
    
    console.log(`[Auth Middleware] Usuario adicionado à requisição: ${JSON.stringify(req.user)}`);
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        success: false,
        message: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }
    
    console.error('Erro na autenticação:', error);
    return res.status(401).json({ 
      success: false,
      message: 'Erro de autenticação' 
    });
  }
};
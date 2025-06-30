import { Express, Request, Response } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { verifyPassword } from "../utils";
import { auth } from "../middleware/auth";

// Schema para validação de login com email
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "A senha é obrigatória")
});

// Schema para refresh token
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token é obrigatório")
});

// Tipo para resposta de login
type LoginResponse = {
  success: boolean;
  message: string;
  user?: {
    id: number;
    username: string;
    fullName: string;
    email: string;
    role: string;
    department: string;
  };
  accessToken?: string;
  refreshToken?: string;
};

// Função para gerar tokens JWT
function generateTokens(user: any) {
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_key';
  
  // Access token válido por 1 hora
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      department: user.department
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  // Refresh token válido por 7 dias
  const refreshToken = jwt.sign(
    { id: user.id, email: user.email },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
}

export function registerAuthRoutes(app: Express) {
  // Endpoint de login com email
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      // Validar dados de entrada
      const validatedData = loginSchema.parse(req.body);
      const { email, password } = validatedData;
      
      // Buscar usuário pelo email
      const user = await storage.getUserByEmail(email);
      
      // Verificar se o usuário existe
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Email ou senha incorretos"
        } as LoginResponse);
      }
      
      // Verificar se a conta está ativa
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Conta de usuário desativada. Entre em contato com o administrador."
        } as LoginResponse);
      }
      
      // Verificar a senha
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Email ou senha incorretos"
        } as LoginResponse);
      }
      
      // Gerar tokens JWT
      const { accessToken, refreshToken } = generateTokens(user);
      
      // Login bem-sucedido, retornar dados do usuário e tokens
      return res.json({
        success: true,
        message: "Login realizado com sucesso",
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          department: user.department
        },
        accessToken,
        refreshToken
      } as LoginResponse);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Dados de login inválidos",
          errors: error.errors
        });
      }
      
      console.error('Erro no login:', error);
      return res.status(500).json({
        success: false,
        message: "Erro interno do servidor ao processar o login"
      } as LoginResponse);
    }
  });
  
  // Endpoint para refresh do token
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_key';
      
      // Verificar o refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      
      // Buscar o usuário atual
      const user = await storage.getUser(decoded.id);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Usuário não encontrado ou inativo"
        });
      }
      
      // Gerar novos tokens
      const tokens = generateTokens(user);
      
      return res.json({
        success: true,
        message: "Token renovado com sucesso",
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          department: user.department
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      } as LoginResponse);
      
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          message: "Token inválido ou expirado"
        });
      }
      
      console.error('Erro no refresh token:', error);
      return res.status(500).json({
        success: false,
        message: "Erro interno do servidor"
      });
    }
  });
   // Verificar se o usuário está autenticado
  app.get("/api/auth/me", auth, async (req: Request, res: Response) => {
    try {
      console.log('[Auth Me] Endpoint /api/auth/me acessado');
      console.log('[Auth Me] req.user:', req.user);
      
      if (!req.user) {
        console.log('[Auth Me] req.user é undefined - usuário não autenticado');
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }
      
      console.log('[Auth Me] Buscando dados do usuário ID:', req.user.id);
      
      // Buscar dados atualizados do usuário
      const user = await storage.getUser(req.user.id);
      
      console.log('[Auth Me] Usuário encontrado no banco:', user ? 'Sim' : 'Não');
      
      if (!user || !user.isActive) {
        console.log('[Auth Me] Usuário não encontrado ou inativo');
        return res.status(401).json({
          success: false,
          message: "Usuário não encontrado ou inativo"
        });
      }

      console.log('[Auth Me] Retornando dados do usuário com sucesso');
      
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          department: user.department
        }
      });
      
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
      return res.status(500).json({
        success: false,
        message: "Erro interno do servidor"
      });
    }
  });
  
  // Endpoint de logout
  app.post("/api/auth/logout", auth, (req: Request, res: Response) => {
    // Com JWT stateless, o logout é apenas do lado do cliente
    // Aqui poderíamos implementar uma blacklist de tokens se necessário
    return res.json({
      success: true,
      message: "Logout realizado com sucesso"
    });
  });
}
import { Express, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { storage } from "../storage";
import { auth } from "../middleware/auth";

// Schema para redefinição de senha
const resetPasswordSchema = z.object({
  userId: z.number().min(1, "ID do usuário é obrigatório"),
  newPassword: z.string().min(6, "A senha deve ter pelo menos 6 caracteres")
});

// Schema para criação de usuário
const createUserSchema = z.object({
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  fullName: z.string().min(2, "Nome completo é obrigatório"),
  role: z.string().min(1, "Cargo é obrigatório"),
  department: z.string().min(1, "Departamento é obrigatório"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  phone: z.string().optional()
});

export function registerAdminUserRoutes(app: Express) {
  // Listar todos os usuários (apenas para administradores)
  app.get("/api/admin/users", auth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      // Verificar se o usuário é um administrador/gestor
      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser || currentUser.role !== 'Gestor') {
        return res.status(403).json({
          success: false,
          message: "Acesso negado. Apenas gestores podem acessar esta funcionalidade."
        });
      }

      const users = await storage.getAllUsers();
      
      // Remover senhas dos dados retornados
      const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        phone: user.phone,
        isActive: user.isActive
      }));

      return res.json({
        success: true,
        users: safeUsers
      });

    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      return res.status(500).json({
        success: false,
        message: "Erro interno do servidor"
      });
    }
  });

  // Redefinir senha de usuário (apenas para administradores)
  app.post("/api/admin/users/reset-password", auth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      // Verificar se o usuário é um administrador/gestor
      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser || currentUser.role !== 'Gestor') {
        return res.status(403).json({
          success: false,
          message: "Acesso negado. Apenas gestores podem redefinir senhas."
        });
      }

      const { userId, newPassword } = resetPasswordSchema.parse(req.body);

      // Verificar se o usuário alvo existe
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado"
        });
      }

      // Hash da nova senha
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Atualizar a senha no banco
      const updatedUser = await storage.updateUser(userId, {
        username: targetUser.username,
        fullName: targetUser.fullName,
        email: targetUser.email,
        phone: targetUser.phone,
        role: targetUser.role,
        department: targetUser.department,
        passwordHash,
        isActive: targetUser.isActive
      });

      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: "Erro ao atualizar senha"
        });
      }

      return res.json({
        success: true,
        message: `Senha redefinida com sucesso para ${targetUser.fullName}`
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: error.errors
        });
      }

      console.error('Erro ao redefinir senha:', error);
      return res.status(500).json({
        success: false,
        message: "Erro interno do servidor"
      });
    }
  });

  // Criar novo usuário (apenas para administradores)
  app.post("/api/admin/users", auth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      // Verificar se o usuário é um administrador/gestor
      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser || currentUser.role !== 'Gestor') {
        return res.status(403).json({
          success: false,
          message: "Acesso negado. Apenas gestores podem criar usuários."
        });
      }

      const userData = createUserSchema.parse(req.body);

      // Hash da senha
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      // Criar usuário
      const newUser = await storage.createUser({
        username: userData.username,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        department: userData.department,
        phone: userData.phone || null,
        passwordHash,
        isActive: true
      });

      if ('error' in newUser) {
        return res.status(400).json({
          success: false,
          message: newUser.error
        });
      }

      return res.json({
        success: true,
        message: `Usuário ${newUser.fullName} criado com sucesso`,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          department: newUser.department,
          phone: newUser.phone,
          isActive: newUser.isActive
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: error.errors
        });
      }

      console.error('Erro ao criar usuário:', error);
      return res.status(500).json({
        success: false,
        message: "Erro interno do servidor"
      });
    }
  });

  // Ativar/desativar usuário (apenas para administradores)
  app.patch("/api/admin/users/:id/status", auth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      // Verificar se o usuário é um administrador/gestor
      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser || currentUser.role !== 'Gestor') {
        return res.status(403).json({
          success: false,
          message: "Acesso negado. Apenas gestores podem alterar status de usuários."
        });
      }

      const userId = parseInt(req.params.id);
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: "Status deve ser um valor booleano"
        });
      }

      // Não permitir desativar o próprio usuário
      if (userId === req.user.id) {
        return res.status(400).json({
          success: false,
          message: "Você não pode alterar seu próprio status"
        });
      }

      const updatedUser = await storage.updateUserStatus(userId, isActive);

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado"
        });
      }

      return res.json({
        success: true,
        message: `Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso`,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          role: updatedUser.role,
          department: updatedUser.department,
          phone: updatedUser.phone,
          isActive: updatedUser.isActive
        }
      });

    } catch (error) {
      console.error('Erro ao alterar status do usuário:', error);
      return res.status(500).json({
        success: false,
        message: "Erro interno do servidor"
      });
    }
  });
}
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertUserSchema, updateUserSchema, Role, Department, users } from "@shared/schema";
import { db } from "../database";
import { getDateRangeFromPeriod } from "../utils/date-utils";
import { getClientesCountByUserPeriod, getAppointmentsCountByUserPeriod, getVisitsCountByUserPeriod, getSalesCountByUserPeriod } from "../performance-metrics";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

// Função para validar se o papel é compatível com o departamento
function validateRoleForDepartment(role: string, department: string) {
  // Gestores devem estar no departamento de Gestão
  if (role === Role.MANAGER && department !== Department.MANAGEMENT) {
    return false;
  }
  
  // Consultores devem estar no departamento de Central de Atendimento
  if (role === Role.CONSULTANT && department !== Department.CUSTOMER_SERVICE) {
    return false;
  }
  
  // Todos os cargos de vendas devem estar no departamento de Vendas
  const salesRoles = [Role.BROKER_SENIOR, Role.EXECUTIVE, Role.BROKER_JUNIOR, Role.BROKER_TRAINEE];
  if (salesRoles.includes(role as any) && department !== Department.SALES) {
    return false;
  }
  
  // Marketing deve estar no departamento de Marketing
  if (role === Role.MARKETING && department !== Department.MARKETING) {
    return false;
  }
  
  return true;
}

export function registerUserRoutes(app: Express) {
  // Obter todos os usuários
  app.get("/api/users", async (req, res) => {
    try {
      const allUsers = await db.query.users.findMany();
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários", error });
    }
  });
  
  // Endpoint para métricas de desempenho de usuários usando dados reais
  app.get("/api/users/performance", async (req, res) => {
    try {
      const { period } = req.query;
      
      // Obter datas para o período selecionado
      const { startDate, endDate } = getDateRangeFromPeriod(period as string || 'month');
      
      // Buscar todos os usuários
      const allUsers = await db.query.users.findMany();
      logger.info(`Buscando dados de desempenho para ${allUsers.length} usuários no período ${startDate} até ${endDate}`);
      
      if (!allUsers || allUsers.length === 0) {
        logger.warn("Nenhum usuário encontrado");
        return res.json([]);
      }
      
      // Resultado para a resposta
      const userPerformanceData = [];
      
      // Para cada usuário, buscar dados de performance
      for (const user of allUsers) {
        try {
          // Usar uma conexão direta ao PostgreSQL para evitar problemas com o ORM
          const { pool } = await import('../database');
          const client = await pool.connect();
          
          try {
            // 1. Buscar quantidade de agendamentos do usuário no período (busca dual: user_id OU assigned_to OU broker_id)
            const appointmentsQuery = `
              SELECT COUNT(*) AS count 
              FROM clientes_agendamentos 
              WHERE (user_id = $1 OR assigned_to = $1 OR broker_id = $1)
              AND created_at BETWEEN $2 AND $3
            `;
            const appointmentsResult = await client.query(appointmentsQuery, [user.id, startDate, endDate]);
            const appointmentsCount = parseInt(appointmentsResult.rows[0]?.count || '0');
            
            // 2. Buscar quantidade de visitas do usuário no período (busca dual: user_id OU assigned_to OU broker_id)
            const visitsQuery = `
              SELECT COUNT(*) AS count 
              FROM clientes_visitas 
              WHERE (user_id = $1 OR assigned_to = $1 OR broker_id = $1)
              AND created_at BETWEEN $2 AND $3
            `;
            const visitsResult = await client.query(visitsQuery, [user.id, startDate, endDate]);
            const visitsCount = parseInt(visitsResult.rows[0]?.count || '0');
            
            // 3. Buscar quantidade de vendas do usuário no período (busca dual: assigned_to OU broker_id)
            const salesQuery = `
              SELECT COUNT(*) AS count 
              FROM clientes_vendas 
              WHERE (assigned_to = $1 OR broker_id = $1)
              AND created_at BETWEEN $2 AND $3
            `;
            const salesResult = await client.query(salesQuery, [user.id, startDate, endDate]);
            const salesCount = parseInt(salesResult.rows[0]?.count || '0');
            
            // 4. Buscar quantidade de leads/clientes atribuídos ao usuário (busca dual: assigned_to OU broker_id)
            const leadsQuery = `
              SELECT COUNT(*) AS count 
              FROM clientes 
              WHERE (assigned_to = $1 OR broker_id = $1)
              AND created_at BETWEEN $2 AND $3
            `;
            const leadsResult = await client.query(leadsQuery, [user.id, startDate, endDate]);
            const leadsCount = parseInt(leadsResult.rows[0]?.count || '0');
            
            logger.info(`Métricas para usuário ${user.id}: agendamentos=${appointmentsCount}, visitas=${visitsCount}, vendas=${salesCount}`);
            
            // Adicionar dados ao resultado apenas se for dos departamentos Central de Atendimento ou Vendas
            if (user.department === 'Central de Atendimento' || user.department === 'Vendas') {
              userPerformanceData.push({
                id: user.id,
                username: user.username || '',
                fullName: user.fullName || '',
                role: user.role || '',
                department: user.department || '',
                leads: leadsCount,
                appointments: appointmentsCount,
                visits: visitsCount,
                sales: salesCount,
                // A conversão será calculada no frontend
                conversion: 0
              });
            }
          } finally {
            // Sempre liberar a conexão ao terminar
            client.release();
          }
        } catch (userError) {
          logger.error(`Erro ao processar métricas para usuário ${user.id}:`, userError);
          // Continuar com o próximo usuário
        }
      }
      
      logger.info(`Retornando dados reais de desempenho - ${userPerformanceData.length} usuários`);
      return res.json(userPerformanceData);
    } catch (error) {
      logger.error("Erro ao buscar desempenho dos usuários:", error);
      // Retornar array vazio em caso de erro
      res.json([]);
    }
  });

  // Obter usuário por ID
  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Criar novo usuário
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      // Validação extra para garantir que o papel corresponda ao departamento
      const validRoleForDepartment = validateRoleForDepartment(userData.role, userData.department);
      
      if (!validRoleForDepartment) {
        return res.status(400).json({ 
          message: "Invalid role for department", 
          error: "O papel selecionado não é compatível com o departamento escolhido." 
        });
      }
      
      // Verificar se a senha está em formato hash. Se não estiver, fazer o hash
      if (userData.passwordHash) {
        const { ensurePasswordHashed } = await import('../utils');
        userData.passwordHash = await ensurePasswordHashed(userData.passwordHash);
      } else {
        return res.status(400).json({ 
          message: "Password is required", 
          error: "Senha é um campo obrigatório" 
        });
      }
      
      const result = await storage.createUser(userData);
      
      // Verificar se o resultado é um objeto de erro (conflito de Gestor único)
      if (result && typeof result === 'object' && 'error' in result) {
        
        return res.status(409).json({ 
          message: result.error,
          conflict: true
        });
      }
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Atualizar usuário
  app.put("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = updateUserSchema.parse(req.body);
      
      // Validação extra para garantir que o papel corresponda ao departamento
      if (userData.role && userData.department) {
        const validRoleForDepartment = validateRoleForDepartment(userData.role, userData.department);
        
        if (!validRoleForDepartment) {
          return res.status(400).json({ 
            message: "Invalid role for department", 
            error: "O papel selecionado não é compatível com o departamento escolhido." 
          });
        }
      }
      
      // Verificar se a senha precisa ser atualizada
      if (userData.passwordHash) {
        const { ensurePasswordHashed } = await import('../utils');
        userData.passwordHash = await ensurePasswordHashed(userData.passwordHash);
      }
      
      const result = await storage.updateUser(id, userData);
      
      // Verificar se o resultado é um objeto de erro (conflito de Gestor único)
      if (result && typeof result === 'object' && 'error' in result) {
        return res.status(409).json({ 
          message: result.error,
          conflict: true
        });
      }
      
      if (!result) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Excluir usuário
  app.delete("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          message: "ID de usuário inválido" 
        });
      }
      
      const result = await storage.deleteUser(id);
      
      // Verificar se o resultado é um objeto de erro
      if (result && typeof result === 'object' && 'error' in result) {
        // Determinar o status code baseado no tipo de erro
        let statusCode = 400;
        if (result.error.includes("não encontrado")) {
          statusCode = 404;
        } else if (result.error.includes("Gestor") || result.error.includes("não é permitido")) {
          statusCode = 403;
        } else if (result.error.includes("dados relacionados") || result.error.includes("vendas registradas")) {
          statusCode = 409; // Conflict
        }
        
        return res.status(statusCode).json({ 
          message: result.error,
          success: false
        });
      }
      
      // Verificar se a exclusão falhou por outros motivos
      if (!result) {
        return res.status(500).json({ 
          message: "Falha ao excluir usuário",
          success: false 
        });
      }
      
      // Sucesso na exclusão
      res.json({ 
        message: "Usuário excluído com sucesso",
        success: true 
      });
    } catch (error) {
      logger.error(`Erro na rota de exclusão de usuário: ${error}`);
      res.status(500).json({ 
        message: "Erro interno do servidor",
        success: false 
      });
    }
  });

  // Buscar resumo de dados vinculados ao usuário
  app.get("/api/users/:id/data-summary", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ 
          message: "ID de usuário inválido" 
        });
      }

      // Buscar contagem de dados vinculados ao usuário
      const [leadsResult, clientesResult, appointmentsResult, visitsResult, salesResult, notesResult] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as count FROM sistema_leads WHERE assigned_to = ${userId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM clientes WHERE assigned_to = ${userId} OR broker_id = ${userId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM clientes_agendamentos WHERE user_id = ${userId} OR assigned_to = ${userId} OR broker_id = ${userId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM clientes_visitas WHERE user_id = ${userId} OR assigned_to = ${userId} OR broker_id = ${userId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM clientes_vendas WHERE user_id = ${userId} OR assigned_to = ${userId} OR broker_id = ${userId} OR consultant_id = ${userId}`),
        db.execute(sql`SELECT COUNT(*) as count FROM clientes_id_anotacoes WHERE user_id = ${userId}`)
      ]);

      const summary = {
        leads: parseInt(leadsResult.rows[0].count as string) || 0,
        clientes: parseInt(clientesResult.rows[0].count as string) || 0,
        appointments: parseInt(appointmentsResult.rows[0].count as string) || 0,
        visits: parseInt(visitsResult.rows[0].count as string) || 0,
        sales: parseInt(salesResult.rows[0].count as string) || 0,
        notes: parseInt(notesResult.rows[0].count as string) || 0
      };

      res.json(summary);
    } catch (error) {
      logger.error(`Erro ao buscar resumo de dados do usuário: ${error}`);
      res.status(500).json({ 
        message: "Erro ao buscar dados vinculados ao usuário" 
      });
    }
  });

  // Transferir dados do usuário
  app.post("/api/users/:id/transfer-data", async (req, res) => {
    try {
      const fromUserId = parseInt(req.params.id);
      const { transferToUserId } = req.body;
      
      if (isNaN(fromUserId) || isNaN(transferToUserId)) {
        return res.status(400).json({ 
          message: "IDs de usuário inválidos" 
        });
      }

      if (fromUserId === transferToUserId) {
        return res.status(400).json({ 
          message: "Não é possível transferir dados para o mesmo usuário" 
        });
      }

      // Verificar se ambos os usuários existem
      const [fromUser, toUser] = await Promise.all([
        db.query.users.findFirst({ where: (users, { eq }) => eq(users.id, fromUserId) }),
        db.query.users.findFirst({ where: (users, { eq }) => eq(users.id, transferToUserId) })
      ]);

      if (!fromUser || !toUser) {
        return res.status(404).json({ 
          message: "Usuário não encontrado" 
        });
      }

      // Transferir todos os dados em uma transação
      await db.transaction(async (tx) => {
        // Transferir leads
        await tx.execute(sql`
          UPDATE sistema_leads 
          SET assigned_to = ${transferToUserId} 
          WHERE assigned_to = ${fromUserId}
        `);

        // Transferir clientes (assigned_to)
        await tx.execute(sql`
          UPDATE clientes 
          SET assigned_to = ${transferToUserId} 
          WHERE assigned_to = ${fromUserId}
        `);

        // Transferir clientes (broker_id)
        await tx.execute(sql`
          UPDATE clientes 
          SET broker_id = ${transferToUserId} 
          WHERE broker_id = ${fromUserId}
        `);

        // Transferir agendamentos (user_id)
        await tx.execute(sql`
          UPDATE clientes_agendamentos 
          SET user_id = ${transferToUserId} 
          WHERE user_id = ${fromUserId}
        `);

        // Transferir agendamentos (assigned_to)
        await tx.execute(sql`
          UPDATE clientes_agendamentos 
          SET assigned_to = ${transferToUserId} 
          WHERE assigned_to = ${fromUserId}
        `);

        // Transferir agendamentos (broker_id)
        await tx.execute(sql`
          UPDATE clientes_agendamentos 
          SET broker_id = ${transferToUserId} 
          WHERE broker_id = ${fromUserId}
        `);

        // Transferir visitas (user_id)
        await tx.execute(sql`
          UPDATE clientes_visitas 
          SET user_id = ${transferToUserId} 
          WHERE user_id = ${fromUserId}
        `);

        // Transferir visitas (assigned_to)
        await tx.execute(sql`
          UPDATE clientes_visitas 
          SET assigned_to = ${transferToUserId} 
          WHERE assigned_to = ${fromUserId}
        `);

        // Transferir visitas (broker_id)
        await tx.execute(sql`
          UPDATE clientes_visitas 
          SET broker_id = ${transferToUserId} 
          WHERE broker_id = ${fromUserId}
        `);

        // Transferir vendas (user_id)
        await tx.execute(sql`
          UPDATE clientes_vendas 
          SET user_id = ${transferToUserId} 
          WHERE user_id = ${fromUserId}
        `);

        // Transferir vendas (assigned_to)
        await tx.execute(sql`
          UPDATE clientes_vendas 
          SET assigned_to = ${transferToUserId} 
          WHERE assigned_to = ${fromUserId}
        `);

        // Transferir vendas (broker_id)
        await tx.execute(sql`
          UPDATE clientes_vendas 
          SET broker_id = ${transferToUserId} 
          WHERE broker_id = ${fromUserId}
        `);

        // Transferir vendas (consultant_id)
        await tx.execute(sql`
          UPDATE clientes_vendas 
          SET consultant_id = ${transferToUserId} 
          WHERE consultant_id = ${fromUserId}
        `);

        // Transferir notas de clientes
        await tx.execute(sql`
          UPDATE clientes_id_anotacoes 
          SET user_id = ${transferToUserId} 
          WHERE user_id = ${fromUserId}
        `);
      });

      logger.info(`Dados transferidos do usuário ${fromUserId} para ${transferToUserId}`);
      
      res.json({ 
        message: "Dados transferidos com sucesso",
        success: true,
        fromUser: fromUser.fullName,
        toUser: toUser.fullName
      });
    } catch (error) {
      logger.error(`Erro ao transferir dados do usuário: ${error}`);
      res.status(500).json({ 
        message: "Erro ao transferir dados do usuário" 
      });
    }
  });
} 
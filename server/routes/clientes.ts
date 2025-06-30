import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertClienteSchema, insertClienteNoteSchema } from "@shared/schema";
import { ErrorMessages } from "../constants/errorMessages";
import { logger } from "../utils/logger";
import { getDeprecationMessage } from "../constants/deprecatedFunctions";
import { fetchSingleClientProfilePic, AUTO_UPDATE_PROFILE_PICS } from "../services/whatsapp-profile-pic";

// Inicializa o logger para o módulo de Clientes
const clientesLogger = logger.createLogger("ClientesAPI");

export function registerClienteRoutes(app: Express) {
  // Endpoint especial para buscar todos os clientes de uma vez sem paginação
  // Útil para o Kanban Board que precisa carregar todos os clientes
  app.get("/api/clientes/all", async (req: Request, res: Response) => {
    try {
      const { 
        status, 
        assignedTo, 
        brokerId, 
        dualSearch,
        period, 
        search, 
        order,
      } = req.query;

      clientesLogger.debug(`Buscando todos os clientes sem paginação. Filtros: ${JSON.stringify({
        status, assignedTo, brokerId, dualSearch, period, search, order
      })}`);

      let resultClientes;

      // Se dualSearch for especificado, buscar em ambos assigned_to e broker_id
      if (dualSearch) {
        const userId = parseInt(dualSearch as string);
        
        // Buscar clientes onde o usuário é assignedTo
        const clientesAssigned = await storage.getClientes({
          assignedTo: userId,
          status: status as string | undefined,
          period: period as string | undefined,
          search: search as string | undefined,
          order: order as string | undefined,
          pageSize: 2000,
          page: 1
        });
        
        // Buscar clientes onde o usuário é brokerId
        const clientesBroker = await storage.getClientes({
          brokerId: userId,
          status: status as string | undefined,
          period: period as string | undefined,
          search: search as string | undefined,
          order: order as string | undefined,
          pageSize: 2000,
          page: 1
        });
        
        // Combinar e remover duplicatas
        const clientesMap = new Map();
        [...clientesAssigned, ...clientesBroker].forEach(cliente => {
          clientesMap.set(cliente.id, cliente);
        });
        resultClientes = Array.from(clientesMap.values());
        
      } else {
        // Lógica normal para filtros individuais
        const filter = {
          status: status as string | undefined,
          assignedTo: assignedTo ? parseInt(assignedTo as string) : undefined,
          brokerId: brokerId ? parseInt(brokerId as string) : undefined,
          period: period as string | undefined,
          search: search as string | undefined,
          order: order as string | undefined,
          _timestamp: new Date().getTime().toString() // Evitar cache
        };

        resultClientes = await storage.getClientes({
          ...filter,
          pageSize: 2000,
          page: 1
        });
      }

      clientesLogger.debug(`Total de ${resultClientes.length} clientes retornados`);

      return res.json(resultClientes);
    } catch (error) {
      clientesLogger.error(`Erro ao buscar todos os clientes:`, error);
      return res.status(500).json({ message: ErrorMessages.INTERNAL_ERROR });
    }
  });

  // Listar todos os clientes com filtros opcionais e paginação
  app.get("/api/clientes", async (req: Request, res: Response) => {
    try {
      const { 
        status, 
        assignedTo, 
        brokerId, 
        dualSearch,
        period, 
        search, 
        order,
        page,
        pageSize,
        includeCount
      } = req.query;

      // Converter os parâmetros de paginação
      const pageNum = page ? parseInt(page as string) : 1;
      const pageSizeNum = pageSize ? parseInt(pageSize as string) : 100;

      let clientes;

      // Se dualSearch for especificado, buscar em ambos assigned_to e broker_id
      if (dualSearch) {
        const userId = parseInt(dualSearch as string);
        
        // Buscar clientes onde o usuário é assignedTo
        const clientesAssigned = await storage.getClientes({
          assignedTo: userId,
          status: status as string | undefined,
          period: period as string | undefined,
          search: search as string | undefined,
          order: order as string | undefined,
          page: pageNum,
          pageSize: pageSizeNum,
          includeCount: includeCount === 'true'
        });
        
        // Buscar clientes onde o usuário é brokerId
        const clientesBroker = await storage.getClientes({
          brokerId: userId,
          status: status as string | undefined,
          period: period as string | undefined,
          search: search as string | undefined,
          order: order as string | undefined,
          page: pageNum,
          pageSize: pageSizeNum,
          includeCount: includeCount === 'true'
        });
        
        // Combinar e remover duplicatas
        const clientesMap = new Map();
        [...clientesAssigned, ...clientesBroker].forEach(cliente => {
          clientesMap.set(cliente.id, cliente);
        });
        clientes = Array.from(clientesMap.values());
        
      } else {
        // Lógica normal para filtros individuais
        clientes = await storage.getClientes({
          status: status as string | undefined,
          assignedTo: assignedTo ? parseInt(assignedTo as string) : undefined,
          brokerId: brokerId ? parseInt(brokerId as string) : undefined,
          period: period as string | undefined,
          search: search as string | undefined,
          order: order as string | undefined,
          page: pageNum,
          pageSize: pageSizeNum,
          includeCount: includeCount === 'true',
        });
      }

      // Se solicitado, incluir informações de paginação na resposta
      if (includeCount === 'true') {
        const totalCount = (global as any).__clientesCount || 0;
        const totalPages = Math.ceil(totalCount / pageSizeNum);

        res.json({
          data: clientes,
          pagination: {
            total: totalCount,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages: totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          }
        });
      } else {
        res.json(clientes);
      }
    } catch (error) {
      clientesLogger.error(`Erro ao buscar clientes:`, error);
      res.status(500).json({ message: ErrorMessages.FAILED_FETCH_CLIENTS });
    }
  });

  // Obter cliente por ID
  app.get("/api/clientes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const cliente = await storage.getCliente(id);
      if (!cliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }
      res.json(cliente);
    } catch (error) {
      logger.error(`Erro ao buscar cliente:`, error);
      res.status(500).json({ message: ErrorMessages.FAILED_FETCH_CLIENTS });
    }
  });

  // Criar novo cliente
  app.post("/api/clientes", async (req: Request, res: Response) => {
    try {
      const clienteData = insertClienteSchema.parse(req.body);
      const cliente = await storage.createCliente(clienteData);

      // Validar WhatsApp se o cliente tem número de telefone
      if (cliente && cliente.phone) {
        const phoneToValidate = cliente.phone.trim();
        const clienteId = cliente.id;

        // Log de tentativa de validação
        logger.info(`[POST] Tentando validar WhatsApp para novo cliente id=${clienteId} com telefone=${phoneToValidate}`);

        try {
          // Carregar o módulo diretamente para garantir que o erro não seja silenciado
          const whatsappModule = await import('./whatsapp');
          const result = await whatsappModule.validateAndUpdateClienteWhatsappStatus(clienteId, phoneToValidate);

          if (result !== null) {
            clientesLogger.info(`[POST] Novo cliente ${clienteId} tem WhatsApp: ${result}`);

            // Se o cliente tem WhatsApp, buscar a foto de perfil automaticamente
            // Buscar e atualizar foto de perfil do cliente
            if (result === true && AUTO_UPDATE_PROFILE_PICS) {
              try {
                clientesLogger.info(`[POST] Buscando foto de perfil para novo cliente ${clienteId}`);
                const photoResult = await fetchSingleClientProfilePic(clienteId);
                if (photoResult && photoResult.status) {
                  clientesLogger.info(`[POST] Foto de perfil atualizada para cliente ${clienteId}`);
                } else {
                  clientesLogger.info(`[POST] Não foi possível obter foto de perfil para cliente ${clienteId}`);
                }
              } catch (photoError) {
                clientesLogger.error(`[POST] Erro ao buscar foto de perfil para cliente ${clienteId}:`, photoError);
              }
            }
          } else {
            clientesLogger.warn(`[POST] Validação de WhatsApp retornou nulo para cliente ${clienteId}`);
          }
        } catch (validateError) {
          clientesLogger.error(`[POST] Erro ao validar WhatsApp para novo cliente ${clienteId}:`, validateError);
        }
      } else {
        clientesLogger.warn(`[POST] Cliente criado sem telefone ou objeto cliente inválido`);
      }

      res.status(201).json(cliente);
    } catch (error) {
      if (error instanceof z.ZodError) {
        clientesLogger.warn(`Erro de validação ao criar cliente:`, error);
        return res.status(400).json({ message: ErrorMessages.INVALID_CLIENT_DATA, errors: error.errors });
      }
      clientesLogger.error(`Erro ao criar cliente:`, error);
      res.status(500).json({ message: ErrorMessages.FAILED_CREATE_CLIENT });
    }
  });

  // Atualizar cliente
  app.put("/api/clientes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Buscar o cliente atual para comparar depois
      const existingCliente = await storage.getCliente(id);
      if (!existingCliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }

      const clienteData = insertClienteSchema.parse(req.body);

      // Verificar se o telefone está sendo atualizado
      const isPhoneUpdated = clienteData.phone && clienteData.phone.trim() !== existingCliente.phone?.trim();
      const phoneToValidate = isPhoneUpdated ? clienteData.phone.trim() : null;

      // Log explícito para depuração
      logger.info(`[PUT] Verificando telefone para cliente ${id}: antigo=${existingCliente.phone}, novo=${clienteData.phone}, atualizado=${isPhoneUpdated}`);

      // Atualizar o cliente
      const cliente = await storage.updateCliente(id, clienteData);
      if (!cliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }

      // Se o telefone foi alterado, validar WhatsApp em background
      if (isPhoneUpdated && phoneToValidate) {
        // Log de tentativa de validação
        logger.info(`[PUT] Tentando validar WhatsApp para cliente id=${id} com telefone atualizado=${phoneToValidate}`);

        try {
          // Carregar o módulo diretamente para garantir que o erro não seja silenciado
          const whatsappModule = await import('./whatsapp');
          const result = await whatsappModule.validateAndUpdateClienteWhatsappStatus(id, phoneToValidate);

          if (result !== null) {
            logger.info(`[PUT] Cliente ${id} atualizou telefone para ${phoneToValidate} e tem WhatsApp: ${result}`);

            // Buscar e atualizar foto de perfil do cliente
            if (result === true && AUTO_UPDATE_PROFILE_PICS) {
              try {
                logger.info(`[PUT] Buscando foto de perfil para cliente ${id} após atualização de telefone`);
                const photoResult = await fetchSingleClientProfilePic(id);
                if (photoResult && photoResult.status) {
                  logger.info(`[PUT] Foto de perfil atualizada para cliente ${id}`);
                } else {
                  logger.info(`[PUT] Não foi possível obter foto de perfil para cliente ${id}`);
                }
              } catch (photoError) {
                logger.error(`[PUT] Erro ao buscar foto de perfil para cliente ${id}:`, photoError);
              }
            }
          } else {
            logger.warn(`[PUT] Validação de WhatsApp retornou nulo para cliente ${id}`);
          }
        } catch (validateError) {
          logger.error(`[PUT] Erro ao validar WhatsApp para cliente atualizado ${id}:`, validateError);
        }
      } else {
        logger.info(`[PUT] Telefone não foi alterado para cliente ${id} ou dados inválidos`);
      }

      res.json(cliente);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Erro de validação ao atualizar cliente:`, error);
        return res.status(400).json({ message: ErrorMessages.INVALID_CLIENT_DATA, errors: error.errors });
      }
      logger.error(`Erro ao atualizar cliente:`, error);
      res.status(500).json({ message: ErrorMessages.FAILED_UPDATE_CLIENT });
    }
  });

  // Atualizar parcialmente um cliente
  app.patch("/api/clientes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Buscar o cliente atual
      const existingCliente = await storage.getCliente(id);
      if (!existingCliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }

      // Mesclar os dados existentes com os novos dados
      const patchData = req.body;

      // Verificar se o telefone está sendo atualizado
      const isPhoneUpdated = patchData.phone && patchData.phone.trim() !== existingCliente.phone?.trim();
      const phoneToValidate = isPhoneUpdated ? patchData.phone.trim() : null;

      // Log explícito para depuração
      logger.info(`[PATCH] Verificando telefone para cliente ${id}: antigo=${existingCliente.phone}, novo=${patchData.phone}, atualizado=${isPhoneUpdated}`);

      // Atualizar o cliente
      const cliente = await storage.updateCliente(id, patchData);

      // Se o cliente foi atualizado com sucesso e o telefone foi alterado
      if (cliente && isPhoneUpdated && phoneToValidate) {
        // Log de tentativa de validação
        logger.info(`[PATCH] Tentando validar WhatsApp para cliente id=${id} com telefone atualizado=${phoneToValidate}`);

        try {
          // Carregar o módulo diretamente para garantir que o erro não seja silenciado
          const whatsappModule = await import('./whatsapp');
          const result = await whatsappModule.validateAndUpdateClienteWhatsappStatus(id, phoneToValidate);

          if (result !== null) {
            logger.info(`[PATCH] Cliente ${id} atualizou telefone para ${phoneToValidate} e tem WhatsApp: ${result}`);

            // Buscar e atualizar foto de perfil do cliente
            if (result === true && AUTO_UPDATE_PROFILE_PICS) {
              try {
                logger.info(`[PATCH] Buscando foto de perfil para cliente ${id} após atualização de telefone`);
                const photoResult = await fetchSingleClientProfilePic(id);
                if (photoResult && photoResult.status) {
                  logger.info(`[PATCH] Foto de perfil atualizada para cliente ${id}`);
                } else {
                  logger.info(`[PATCH] Não foi possível obter foto de perfil para cliente ${id}`);
                }
              } catch (photoError) {
                logger.error(`[PATCH] Erro ao buscar foto de perfil para cliente ${id}:`, photoError);
              }
            }
          } else {
            logger.warn(`[PATCH] Validação de WhatsApp retornou nulo para cliente ${id}`);
          }
        } catch (validateError) {
          logger.error(`[PATCH] Erro ao validar WhatsApp para cliente atualizado ${id}:`, validateError);
        }
      } else {
        logger.info(`[PATCH] Telefone não foi alterado para cliente ${id} ou dados inválidos`);
      }

      res.json(cliente);
    } catch (error) {
      logger.error(`Erro ao atualizar cliente (patch):`, error);
      res.status(500).json({ message: ErrorMessages.FAILED_UPDATE_CLIENT });
    }
  });

  // =====================================================================
  // Rotas compatíveis com o nome anterior "leads" - APENAS PARA COMPATIBILIDADE
  // Estas rotas são mantidas para compatibilidade com integrações existentes
  // TODO: Remover estas rotas quando todas as integrações forem atualizadas
  // =====================================================================
  app.get("/api/leads", async (req: Request, res: Response) => {
    try {
      logger.warn("Rota /api/leads utilizada (depreciada)", { 
        path: req.path, 
        ip: req.ip,
        message: getDeprecationMessage("api/leads")
      });

      // Adicionar header de depreciação
      res.setHeader('X-Deprecated', getDeprecationMessage("api/leads"));

      const { status, assignedTo, brokerId, period, search, order } = req.query;
      const clientes = await storage.getClientes({
        status: status as string | undefined,
        assignedTo: assignedTo ? parseInt(assignedTo as string) : undefined,
        brokerId: brokerId ? parseInt(brokerId as string) : undefined,
        period: period as string | undefined,
        search: search as string | undefined,
        order: order as string | undefined,
      });
      res.json(clientes);
    } catch (error) {
      logger.error(`Erro ao buscar clientes (rota legada):`, error);
      res.status(500).json({ message: ErrorMessages.FAILED_FETCH_CLIENTS });
    }
  });

  app.get("/api/leads/:id", async (req: Request, res: Response) => {
    try {
      logger.warn("Rota /api/leads/:id utilizada (depreciada)", { 
        path: req.path, 
        id: req.params.id,
        message: getDeprecationMessage("api/leads")
      });

      // Adicionar header de depreciação
      res.setHeader('X-Deprecated', getDeprecationMessage("api/leads"));

      const id = parseInt(req.params.id);

      const cliente = await storage.getCliente(id);
      if (!cliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }
      res.json(cliente);
    } catch (error) {
      logger.error(`Erro ao buscar cliente (rota legada):`, error);
      res.status(500).json({ message: ErrorMessages.FAILED_FETCH_CLIENTS });
    }
  });

  app.post("/api/leads", async (req: Request, res: Response) => {
    try {
      logger.warn("Rota POST /api/leads utilizada (depreciada)", { 
        path: req.path,
        message: getDeprecationMessage("api/leads")
      });

      // Adicionar header de depreciação
      res.setHeader('X-Deprecated', getDeprecationMessage("api/leads"));

      const clienteData = insertClienteSchema.parse(req.body);
      const cliente = await storage.createCliente(clienteData);

      // Validar WhatsApp se o cliente tem número de telefone (mesmo na rota legada)
      if (cliente && cliente.phone) {
        const phoneToValidate = cliente.phone.trim();
        const clienteId = cliente.id;

        // Log de tentativa de validação
        logger.info(`[POST-LEGACY] Tentando validar WhatsApp para novo cliente id=${clienteId} com telefone=${phoneToValidate}`);

        try {
          // Carregar o módulo diretamente para garantir que o erro não seja silenciado
          const whatsappModule = await import('./whatsapp');
          const result = await whatsappModule.validateAndUpdateClienteWhatsappStatus(clienteId, phoneToValidate);

          if (result !== null) {
            logger.info(`[POST-LEGACY] Novo cliente ${clienteId} tem WhatsApp: ${result}`);

            // Buscar e atualizar foto de perfil do cliente
            if (result === true && AUTO_UPDATE_PROFILE_PICS) {
              try {
                logger.info(`[POST-LEGACY] Buscando foto de perfil para novo cliente ${clienteId}`);
                const photoResult = await fetchSingleClientProfilePic(clienteId);
                if (photoResult && photoResult.status) {
                  logger.info(`[POST-LEGACY] Foto de perfil atualizada para cliente ${clienteId}`);
                } else {
                  logger.info(`[POST-LEGACY] Não foi possível obter foto de perfil para cliente ${clienteId}`);
                }
              } catch (photoError) {
                logger.error(`[POST-LEGACY] Erro ao buscar foto de perfil para cliente ${clienteId}:`, photoError);
              }
            }
          } else {
            logger.warn(`[POST-LEGACY] Validação de WhatsApp retornou nulo para cliente ${clienteId}`);
          }
        } catch (validateError) {
          logger.error(`[POST-LEGACY] Erro ao validar WhatsApp para novo cliente ${clienteId}:`, validateError);
        }
      } else {
        logger.warn(`[POST-LEGACY] Cliente criado sem telefone ou objeto cliente inválido`);
      }

      res.status(201).json(cliente);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Erro de validação ao criar cliente (rota legada):`, error);
        return res.status(400).json({ message: ErrorMessages.INVALID_CLIENT_DATA, errors: error.errors });
      }
      logger.error(`Erro ao criar cliente (rota legada):`, error);
      res.status(500).json({ message: ErrorMessages.FAILED_CREATE_CLIENT });
    }
  });

  app.put("/api/leads/:id", async (req: Request, res: Response) => {
    try {
      logger.warn("Rota PUT /api/leads/:id utilizada (depreciada)", { 
        path: req.path, 
        id: req.params.id,
        message: getDeprecationMessage("api/leads")
      });

      // Adicionar header de depreciação
      res.setHeader('X-Deprecated', getDeprecationMessage("api/leads"));

      const id = parseInt(req.params.id);

      // Buscar o cliente atual para comparar depois
      const existingCliente = await storage.getCliente(id);
      if (!existingCliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }

      const clienteData = insertClienteSchema.parse(req.body);

      // Verificar se o telefone está sendo atualizado
      const isPhoneUpdated = clienteData.phone && clienteData.phone.trim() !== existingCliente.phone?.trim();
      const phoneToValidate = isPhoneUpdated ? clienteData.phone.trim() : null;

      // Log explícito para depuração
      logger.info(`[PUT-LEGACY] Verificando telefone para cliente ${id}: antigo=${existingCliente.phone}, novo=${clienteData.phone}, atualizado=${isPhoneUpdated}`);

      // Atualizar o cliente
      const cliente = await storage.updateCliente(id, clienteData);
      if (!cliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }

      // Se o telefone foi alterado, validar WhatsApp em background
      if (isPhoneUpdated && phoneToValidate) {
        // Log de tentativa de validação
        logger.info(`[PUT-LEGACY] Tentando validar WhatsApp para cliente id=${id} com telefone atualizado=${phoneToValidate}`);

        try {
          // Carregar o módulo diretamente para garantir que o erro não seja silenciado
          const whatsappModule = await import('./whatsapp');
          const result = await whatsappModule.validateAndUpdateClienteWhatsappStatus(id, phoneToValidate);

          if (result !== null) {
            logger.info(`[PUT-LEGACY] Cliente ${id} atualizou telefone para ${phoneToValidate} e tem WhatsApp: ${result}`);

            // Se o cliente tem WhatsApp e a opção está ativada, buscar a foto de perfil automaticamente
            if (result === true && AUTO_UPDATE_PROFILE_PICS) {
              try {
                logger.info(`[PUT-LEGACY] Buscando foto de perfil para cliente ${id} após atualização de telefone`);
                const photoResult = await fetchSingleClientProfilePic(id);
                if (photoResult && photoResult.status) {
                  logger.info(`[PUT-LEGACY] Foto de perfil atualizada para cliente ${id}`);
                } else {
                  logger.info(`[PUT-LEGACY] Não foi possível obter foto de perfil para cliente ${id}`);
                }
              } catch (photoError) {
                logger.error(`[PUT-LEGACY] Erro ao buscar foto de perfil para cliente ${id}:`, photoError);
              }
            }
          } else {
            logger.warn(`[PUT-LEGACY] Validação de WhatsApp retornou nulo para cliente ${id}`);
          }
        } catch (validateError) {
          logger.error(`[PUT-LEGACY] Erro ao validar WhatsApp para cliente atualizado ${id}:`, validateError);
        }
      } else {
        logger.info(`[PUT-LEGACY] Telefone não foi alterado para cliente ${id} ou dados inválidos`);
      }

      res.json(cliente);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Erro de validação ao atualizar cliente (rota legada):`, error);
        return res.status(400).json({ message: ErrorMessages.INVALID_CLIENT_DATA, errors: error.errors });
      }
      logger.error(`Erro ao atualizar cliente (rota legada):`, error);
      res.status(500).json({ message: ErrorMessages.FAILED_UPDATE_CLIENT });
    }
  });

  app.patch("/api/leads/:id", async (req: Request, res: Response) => {
    try {
      logger.warn("Rota PATCH /api/leads/:id utilizada (depreciada)", { 
        path: req.path, 
        id: req.params.id,
        message: getDeprecationMessage("api/leads")
      });

      // Adicionar header de depreciação
      res.setHeader('X-Deprecated', getDeprecationMessage("api/leads"));

      const id = parseInt(req.params.id);

      // Buscar o cliente atual
      const existingCliente = await storage.getCliente(id);
      if (!existingCliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }

      // Mesclar os dados existentes com os novos dados
      const patchData = req.body;

      // Verificar se o telefone está sendo atualizado
      const isPhoneUpdated = patchData.phone && patchData.phone.trim() !== existingCliente.phone?.trim();
      const phoneToValidate = isPhoneUpdated ? patchData.phone.trim() : null;

      // Log explícito para depuração
      logger.info(`[PATCH-LEGACY] Verificando telefone para cliente ${id}: antigo=${existingCliente.phone}, novo=${patchData.phone}, atualizado=${isPhoneUpdated}`);

      // Atualizar o cliente
      const cliente = await storage.updateCliente(id, patchData);

      // Se o cliente foi atualizado com sucesso e o telefone foi alterado
      if (cliente && isPhoneUpdated && phoneToValidate) {
        // Log de tentativa de validação
        logger.info(`[PATCH-LEGACY] Tentando validar WhatsApp para cliente id=${id} com telefone atualizado=${phoneToValidate}`);

        try {
          // Carregar o módulo diretamente para garantir que o erro não seja silenciado
          const whatsappModule = await import('./whatsapp');
          const result = await whatsappModule.validateAndUpdateClienteWhatsappStatus(id, phoneToValidate);

          if (result !== null) {
            logger.info(`[PATCH-LEGACY] Cliente ${id} atualizou telefone para ${phoneToValidate} e tem WhatsApp: ${result}`);

            // Se o cliente tem WhatsApp e a opção está ativada, buscar a foto de perfil automaticamente
            if (result === true && AUTO_UPDATE_PROFILE_PICS) {
              try {
                logger.info(`[PATCH-LEGACY] Buscando foto de perfil para cliente ${id} após atualização de telefone`);
                const photoResult = await fetchSingleClientProfilePic(id);
                if (photoResult && photoResult.status) {
                  logger.info(`[PATCH-LEGACY] Foto de perfil atualizada para cliente ${id}`);
                } else {
                  logger.info(`[PATCH-LEGACY] Não foi possível obter foto de perfil para cliente ${id}`);
                }
              } catch (photoError) {
                logger.error(`[PATCH-LEGACY] Erro ao buscar foto de perfil para cliente ${id}: ${photoError}`);
              }
            }
          } else {
            logger.warn(`[PATCH-LEGACY] Validação de WhatsApp retornou nulo para cliente ${id}`);
          }
        } catch (validateError) {
          logger.error(`[PATCH-LEGACY] Erro ao validar WhatsApp para cliente atualizado ${id}: ${validateError}`);
        }
      } else {
        logger.info(`[PATCH-LEGACY] Telefone não foi alterado para cliente ${id} ou dados inválidos`);
      }

      res.json(cliente);
    } catch (error) {
      logger.error(`Erro ao atualizar cliente (patch, rota legada): ${error}`);
      res.status(500).json({ message: ErrorMessages.FAILED_UPDATE_CLIENT });
    }
  });

  // Excluir um cliente
  app.delete("/api/clientes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Verificar se o cliente existe
      const existingCliente = await storage.getCliente(id);
      if (!existingCliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }

      // Excluir o cliente
      const success = await storage.deleteCliente(id);

      if (success) {
        logger.info(`Cliente ${id} excluído com sucesso`);
        return res.status(200).json({ success: true, message: "Cliente excluído com sucesso" });
      } else {
        logger.error(`Falha ao excluir cliente ${id}`);
        return res.status(500).json({ success: false, message: "Falha ao excluir cliente" });
      }
    } catch (error) {
      logger.error(`Erro ao excluir cliente: ${error}`);
      res.status(500).json({ message: "Erro ao excluir cliente" });
    }
  });

  // Cliente Notes
  app.get("/api/clientes/:clienteId/notes", async (req: Request, res: Response) => {
    try {
      const clienteId = parseInt(req.params.clienteId);
      if (isNaN(clienteId)) {
        return res.status(400).json({ message: ErrorMessages.INVALID_DATA });
      }

      // Verificar se o cliente existe
      const cliente = await storage.getCliente(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }

      const notes = await storage.getClienteNotes(clienteId);
      return res.json(notes);
    } catch (error) {
      logger.error(`Erro ao buscar anotações do cliente: ${error}`);
      return res.status(500).json({ message: ErrorMessages.INTERNAL_ERROR });
    }
  });

  app.post("/api/clientes/:clienteId/notes", async (req: Request, res: Response) => {
    try {
      const clienteId = parseInt(req.params.clienteId);
      if (isNaN(clienteId)) {
        return res.status(400).json({ message: ErrorMessages.INVALID_DATA });
      }

      // Verificar se o cliente existe
      const cliente = await storage.getCliente(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: ErrorMessages.CLIENT_NOT_FOUND });
      }

      // Validar os dados da nota
      const validationResult = insertClienteNoteSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados de anotação inválidos", 
          errors: validationResult.error.errors 
        });
      }

      const note = await storage.createClienteNote({
        ...validationResult.data,
        clienteId
      });

      return res.status(201).json(note);
    } catch (error) {
      logger.error(`Erro ao criar anotação do cliente: ${error}`);
      return res.status(500).json({ message: ErrorMessages.INTERNAL_ERROR });
    }
  });

  app.get("/api/clientes/notes/:id", async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: ErrorMessages.INVALID_DATA });
      }

      const note = await storage.getClienteNote(noteId);
      if (!note) {
        return res.status(404).json({ message: "Anotação não encontrada" });
      }

      return res.json(note);
    } catch (error) {
      logger.error(`Erro ao buscar anotação: ${error}`);
      return res.status(500).json({ message: ErrorMessages.INTERNAL_ERROR });
    }
  });

  // Atualizar uma anotação existente
  app.patch("/api/clientes/notes/:id", async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: ErrorMessages.INVALID_DATA });
      }

      const { text } = req.body;
      if (!text || typeof text !== 'string' || text.trim().length < 3) {
        return res.status(400).json({ 
          message: "Texto da anotação inválido. Deve ter pelo menos 3 caracteres." 
        });
      }

      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // UTC-3
      const result = await storage.updateClienteNote(noteId, text.trim(), brasiliaTime);
      if (!result) {
        return res.status(404).json({ message: "Anotação não encontrada" });
      }

      return res.json(result);
    } catch (error) {
      logger.error(`Erro ao atualizar anotação: ${error}`);
      return res.status(500).json({ message: ErrorMessages.INTERNAL_ERROR });
    }
  });

  // Excluir uma anotação
  app.delete("/api/clientes/notes/:id", async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: ErrorMessages.INVALID_DATA });
      }

      const result = await storage.deleteClienteNote(noteId);
      if (!result) {
        return res.status(404).json({ message: "Anotação não encontrada ou já excluída" });
      }

      return res.json({ success: true, message: "Anotação excluída com sucesso" });
    } catch (error) {
      logger.error(`Erro ao excluir anotação: ${error}`);
      return res.status(500).json({ message: ErrorMessages.INTERNAL_ERROR });
    }
  });
}
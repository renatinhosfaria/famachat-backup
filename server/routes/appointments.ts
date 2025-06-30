import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { 
  insertAppointmentSchema, 
  insertVisitSchema, 
  insertSaleSchema 
} from "@shared/schema";

export function registerAppointmentRoutes(app: Express) {
  // Agendamentos
  app.get("/api/appointments", async (req, res) => {
    try {
      const { clienteId, userId, brokerId, status, startDate, endDate } = req.query;
      const appointments = await storage.getAppointments({
        clienteId: clienteId ? parseInt(clienteId as string) : undefined,
        userId: userId ? parseInt(userId as string) : undefined,
        brokerId: brokerId ? parseInt(brokerId as string) : undefined,
        status: status as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      res.json(appointment);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch appointment" });
    }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      // Convertemos a string da data para objeto Date se necessário
      let { scheduledAt, ...rest } = req.body;

      // Se scheduledAt é uma string ISO, convertemos para Date
      if (typeof scheduledAt === 'string') {
        scheduledAt = new Date(scheduledAt);
      }

      // Validamos os dados completos com o schema
      const appointmentData = insertAppointmentSchema.parse({
        ...rest,
        scheduledAt
      });

      // Auto-gerar título baseado no tipo de agendamento e data
      if (!appointmentData.title) {
        const date = new Date(appointmentData.scheduledAt);
        const formattedDate = date.toLocaleDateString('pt-BR');
        const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        appointmentData.title = `${appointmentData.type} - ${formattedDate} ${formattedTime}`;
      }

      const appointment = await storage.createAppointment(appointmentData);
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment data", errors: error.errors });
      }
      
      res.status(500).json({ message: "Failed to create appointment", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/appointments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Tratamento semelhante ao endpoint POST
      let { scheduledAt, ...rest } = req.body;

      // Se scheduledAt é uma string ISO, convertemos para Date
      if (typeof scheduledAt === 'string') {
        scheduledAt = new Date(scheduledAt);
      }

      // Validamos os dados completos com o schema
      const appointmentData = insertAppointmentSchema.parse({
        ...rest,
        scheduledAt,
        updatedAt: new Date() // Atualizar o timestamp de atualização
      });

      // Auto-gerar título se necessário
      if (!appointmentData.title) {
        const date = new Date(appointmentData.scheduledAt);
        const formattedDate = date.toLocaleDateString('pt-BR');
        const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        appointmentData.title = `${appointmentData.type} - ${formattedDate} ${formattedTime}`;
      }

      const appointment = await storage.updateAppointment(id, appointmentData);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      res.json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment data", errors: error.errors });
      }
      
      res.status(500).json({ message: "Failed to update appointment", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAppointment(id);
      if (!success) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      res.json({ message: "Appointment deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete appointment" });
    }
  });

  // Endpoint PATCH para atualizações parciais de agendamento (como mudança de status)
  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Obter o agendamento existente diretamente do banco
      const existingAppointment = await storage.getAppointment(id);
      if (!existingAppointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Preparar os dados para atualização
      const updateData = req.body;

      

      // IMPORTANTE: Se estamos apenas atualizando o status ou outros campos que não incluem 
      // o scheduledAt, NÃO devemos modificar o scheduledAt de forma alguma

      // Se apenas status estiver sendo atualizado, criamos um objeto separado para atualização
      if (updateData.status && Object.keys(updateData).length === 1) {
        

        // Criar um objeto com apenas os campos que queremos atualizar
        // Precisamos especificar o tipo 'as any' para evitar erros de tipo, já que estamos
        // deliberadamente enviando um objeto parcial
        const updateObj = {
          status: updateData.status,
          updatedAt: new Date()
        } as any;

        // Atualizar apenas o status, sem mexer em nenhum outro campo
        const updatedAppointment = await storage.updateAppointment(id, updateObj);

        if (!updatedAppointment) {
          return res.status(404).json({ message: "Agendamento não encontrado" });
        }

        res.json(updatedAppointment);
        return;
      }

      // Para atualizações mais completas, usamos o método anterior
      const updatedAppointment = await storage.updateAppointment(id, {
        ...existingAppointment,     // Manter todos os dados existentes
        ...updateData,              // Sobrescrever com os novos dados
        // Garantir que o ID não seja modificado
        id: existingAppointment.id,
        // Atualizar o timestamp
        updatedAt: new Date()
      });

      if (!updatedAppointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      res.json(updatedAppointment);
    } catch (error) {
      res.status(500).json({ 
        message: "Falha ao atualizar agendamento", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Visitas
  app.get("/api/visits", async (req, res) => {
    try {
      const { clienteId, userId, period } = req.query;
      const visits = await storage.getVisits({
        clienteId: clienteId ? parseInt(clienteId as string) : undefined,
        userId: userId ? parseInt(userId as string) : undefined,
        period: period as string | undefined,
      });
      res.json(visits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch visits" });
    }
  });

  app.get("/api/visits/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const visit = await storage.getVisit(id);
      if (!visit) {
        return res.status(404).json({ message: "Visit not found" });
      }
      res.json(visit);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch visit" });
    }
  });

  app.post("/api/visits", async (req, res) => {
    try {
      // Obter e validar os dados da requisição
      // O userId deve ser enviado pelo front-end - estamos usando gerenciamento de usuário no front
      const visitData = req.body;

      // Se não houver userId na requisição, use 1 (Renato) como padrão
      if (!visitData.userId) {
        visitData.userId = 1; // ID do usuário Renato como fallback
      }

      

      // Validar com o schema
      const validatedData = insertVisitSchema.parse(visitData);

      // Criar a visita
      const visit = await storage.createVisit(validatedData);

      // Atualizar o status do cliente para "Visita" se ainda não estiver
      if (validatedData.clienteId) {
        const cliente = await storage.getCliente(validatedData.clienteId);
        if (cliente && cliente.status !== "Visita") {
          // Usamos os dados completos do cliente existente para evitar conflito de tipos
          await storage.updateCliente(validatedData.clienteId, {
            ...cliente,  // Mantém todos os dados originais
            status: "Visita"  // Atualiza apenas o status
          });
        }
      }

      res.status(201).json(visit);
    } catch (error) {
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid visit data", errors: error.errors });
      }
      res.status(500).json({ 
        message: "Failed to create visit", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.patch("/api/visits/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Obter a visita existente para verificar se existe
      const existingVisit = await storage.getVisit(id);
      if (!existingVisit) {
        return res.status(404).json({ message: "Visita não encontrada" });
      }

      // Preparar os dados para atualização
      const visitData = req.body;

      // Verificar se há conversão de data necessária
      if (visitData.visitedAt && typeof visitData.visitedAt === 'string') {
        visitData.visitedAt = new Date(visitData.visitedAt);
      }

      // Remover updated_at para preservar o valor original
      delete visitData.updatedAt;

      

      // Atualizar a visita preservando o updated_at original
      const updatedVisit = await storage.updateVisit(id, {
        ...visitData,
        updatedAt: existingVisit?.updatedAt 
      });

      res.json(updatedVisit);
    } catch (error) {
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos para visita", errors: error.errors });
      }
      res.status(500).json({ 
        message: "Falha ao atualizar visita", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.delete("/api/visits/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVisit(id);
      if (!success) {
        return res.status(404).json({ message: "Visita não encontrada" });
      }
      res.json({ message: "Visita excluída com sucesso" });
    } catch (error) {
      
      res.status(500).json({ message: "Falha ao excluir visita" });
    }
  });

  // Vendas
  app.get("/api/sales", async (req, res) => {
    try {
      const { clienteId, userId, period } = req.query;
      const sales = await storage.getSales({
        clienteId: clienteId ? parseInt(clienteId as string) : undefined,
        userId: userId ? parseInt(userId as string) : undefined,
        period: period as string | undefined,
      });
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const sale = await storage.getSale(id);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sale" });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const saleData = insertSaleSchema.parse(req.body);
      const sale = await storage.createSale(saleData);
      res.status(201).json(sale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid sale data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create sale" });
    }
  });

  app.put("/api/sales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const saleData = insertSaleSchema.parse(req.body);
      const sale = await storage.updateSale(id, saleData);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid sale data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update sale" });
    }
  });
  
  // Adicionar rota PATCH para permitir atualizações parciais
  app.patch("/api/sales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Buscar a venda atual para não perder dados
      const currentSale = await storage.getSale(id);
      if (!currentSale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      
      // Tratar a data soldAt caso seja enviada no formato string
      let requestData = { ...req.body };
      
      // Se soldAt for enviado como string (formato de data), converter para Date
      if (requestData.soldAt && typeof requestData.soldAt === 'string') {
        try {
          requestData.soldAt = new Date(requestData.soldAt);
        } catch (e) {
          
          // Se a conversão falhar, usar a data original da venda
          requestData.soldAt = currentSale.soldAt;
        }
      }
      
      // Converter campos monetários de string para número
      if (requestData.value && typeof requestData.value === 'string') {
        try {
          const valueStr = requestData.value.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
          requestData.value = parseFloat(valueStr);
        } catch (e: any) {
          
          requestData.value = currentSale.value;
        }
      }
      
      if (requestData.commission && typeof requestData.commission === 'string') {
        try {
          const commissionStr = requestData.commission.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
          requestData.commission = parseFloat(commissionStr);
        } catch (e: any) {
          
          requestData.commission = currentSale.commission;
        }
      }
      
      if (requestData.bonus && typeof requestData.bonus === 'string') {
        try {
          const bonusStr = requestData.bonus.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
          requestData.bonus = parseFloat(bonusStr);
        } catch (e: any) {
          
          requestData.bonus = currentSale.bonus;
        }
      }
      
      // Para o totalCommission, vamos recalcular baseado na comissão e no bônus
      // em vez de usar o valor recebido, garantindo que seja sempre a soma dos dois
      let commissionValue = 0;
      let bonusValue = 0;
      
      // Usar os valores já convertidos ou os valores originais
      if (typeof requestData.commission === 'number') {
        commissionValue = requestData.commission;
      } else if (currentSale.commission) {
        commissionValue = typeof currentSale.commission === 'string' 
          ? parseFloat(currentSale.commission.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.'))
          : currentSale.commission;
      }
      
      if (typeof requestData.bonus === 'number') {
        bonusValue = requestData.bonus;
      } else if (currentSale.bonus) {
        bonusValue = typeof currentSale.bonus === 'string' 
          ? parseFloat(currentSale.bonus.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.'))
          : currentSale.bonus;
      }
      
      // Calcular o total corretamente como a soma da comissão e do bônus
      requestData.totalCommission = commissionValue + bonusValue;
      
      // Mesclar os dados atuais com os novos dados
      const updatedData = {
        ...currentSale,
        ...requestData,
        // Forçar a atualização da data de atualização
        updatedAt: new Date()
      };
      
      // Remover o ID para evitar conflitos na validação
      delete updatedData.id;
      
      // Atualizar a venda
      const sale = await storage.updateSale(id, updatedData);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error: any) {
      
      res.status(500).json({ message: "Failed to update sale", error: error.message });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`[INFO] Recebido pedido para excluir venda com ID: ${id}`);
      
      // Verificar se a venda existe antes de tentar excluir
      const sale = await storage.getSale(id);
      if (!sale) {
        console.log(`[ERROR] Venda não encontrada para exclusão, ID: ${id}`);
        return res.status(404).json({ message: "Sale not found" });
      }
      
      console.log(`[INFO] Venda encontrada, iniciando exclusão, ID: ${id}`);
      const success = await storage.deleteSale(id);
      
      if (!success) {
        console.log(`[ERROR] Falha ao excluir venda, operação retornou false, ID: ${id}`);
        return res.status(500).json({ message: "Failed to delete sale, operation returned false" });
      }
      
      console.log(`[INFO] Venda excluída com sucesso, ID: ${id}`);
      res.json({ message: "Sale deleted", id });
    } catch (error: any) {
      console.error(`[ERROR] Erro ao excluir venda:`, error);
      res.status(500).json({ 
        message: "Failed to delete sale", 
        error: error.message || String(error)
      });
    }
  });
}
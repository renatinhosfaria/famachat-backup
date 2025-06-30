import { db } from "../database";
import { clientes, ClienteStatus, ClienteSource, MeioContato } from "@shared/schema";
import { logger } from "../utils/logger";
import { sql, eq } from "drizzle-orm";
import axios from "axios";
import { processLeadAutomation, LeadProcessingType } from "./lead-automation.service";

// Inicializa o logger para o serviço de leads do Facebook
const facebookLeadLogger = logger.createLogger("FacebookLeadService");

// Tipo para os dados do lead do Facebook
export interface FacebookLeadData {
  id: string;
  created_time: string;
  form_id: string;
  field_data: {
    name: string;
    values: string[];
  }[];
  // Outros campos opcionais
  ad_id?: string;
  adgroup_id?: string;
  campaign_id?: string;
  platform?: string;
  is_organic?: boolean;
}

// Tipo para webhook recebido
export interface FacebookWebhookEntry {
  id: string;
  time: number;
  changes: {
    field: string;
    value: {
      leadgen_id: string;
      page_id: string;
      form_id: string;
      ad_id?: string;
      adgroup_id?: string;
      created_time: number;
      // Campo opcional que pode estar presente em alguns webhooks
      form_data?: Array<{
        name: string;
        values: string[];
      }> | Record<string, string | string[]>;
    };
  }[];
}

/**
 * Serviço para processar leads do Facebook
 */
export class FacebookLeadService {
  /**
   * Processa um evento de webhook do Facebook Lead Ads
   * @param entry Entrada do webhook
   */
  public async processWebhook(entry: FacebookWebhookEntry): Promise<void> {
    try {
      // Para cada alteração no webhook
      for (const change of entry.changes) {
        // Verificar se é um evento de lead
        if (change.field === "leadgen") {
          const leadInfo = change.value;
          
          // Verifica se o webhook contém dados de formulário completos
          if (leadInfo.form_data) {
            logger.info(`Webhook contém dados de formulário completos para o lead ${leadInfo.leadgen_id}`);
            await this.processLeadFromWebhookData(leadInfo);
          } else {
            // Método tradicional - buscar na API do Facebook
            await this.processLead(leadInfo.leadgen_id, leadInfo);
          }
        }
      }
    } catch (error) {
      logger.error(`Erro ao processar webhook do Facebook: ${error}`);
      throw error;
    }
  }
  
  /**
   * Processa um lead usando dados fornecidos diretamente no webhook
   * @param leadInfo Informações do lead do webhook, incluindo form_data
   */
  private async processLeadFromWebhookData(leadInfo: any): Promise<void> {
    try {
      logger.info(`Processando lead ${leadInfo.leadgen_id} com dados do webhook`);
      
      // Transformar os dados do formulário no formato compatível com nossa interface
      const leadData: FacebookLeadData = {
        id: leadInfo.leadgen_id,
        created_time: new Date(leadInfo.created_time * 1000).toISOString(),
        form_id: leadInfo.form_id,
        ad_id: leadInfo.ad_id,
        adgroup_id: leadInfo.adgroup_id,
        field_data: []
      };
      
      // Converter os dados do formulário para nosso formato de field_data
      if (Array.isArray(leadInfo.form_data)) {
        leadData.field_data = leadInfo.form_data;
      } else if (typeof leadInfo.form_data === 'object') {
        // Convertendo de formato de objeto para array de campos
        leadData.field_data = Object.entries(leadInfo.form_data).map(([name, value]) => {
          return {
            name,
            values: Array.isArray(value) ? value : [value]
          };
        });
      }
      
      // Se não houver dados, usar o formato de fallback
      if (!leadData.field_data || leadData.field_data.length === 0) {
        logger.warn(`Dados do formulário no webhook não estão no formato esperado`);
        leadData.field_data = [
          { name: "full_name", values: [`Lead Facebook (${leadInfo.leadgen_id.slice(-6)})`] },
          { name: "email", values: [""] },
          { name: "phone_number", values: [""] }
        ];
      }
      
      await this.convertLeadToClient(leadData, leadInfo);
      logger.info(`Lead do Facebook ${leadInfo.leadgen_id} processado com sucesso usando dados do webhook`);
      
    } catch (error) {
      logger.error(`Erro ao processar lead ${leadInfo.leadgen_id} com dados do webhook: ${error}`);
      throw error;
    }
  }

  /**
   * Processa um lead específico obtendo seus detalhes da API do Facebook
   * @param leadId ID do lead no Facebook
   * @param leadInfo Informações básicas do lead recebidas no webhook
   */
  private async processLead(leadId: string, leadInfo: any): Promise<void> {
    try {
      logger.info(`Processando lead do Facebook com ID: ${leadId}`);
      
      // Buscar configuração do Facebook para obter o token de acesso
      const fbConfig = await db.query.facebookConfig.findFirst({
        where: (config, { eq }) => eq(config.isActive, true)
      });
      
      if (!fbConfig || !fbConfig.accessToken) {
        throw new Error("Configuração do Facebook não encontrada ou token inválido");
      }
      
      let leadData: FacebookLeadData;
      
      try {
        // Fazer chamada real para a API do Facebook para obter os detalhes do lead
        // Usando a versão v20.0 da API, que é a estável em abril de 2025
        logger.info(`Buscando detalhes do lead ${leadId} na API do Facebook (v20.0)`);
        
        // Determinar qual token usar: se temos um userAccessToken com página associada, usamos ele
        // pois provavelmente tem permissão leads_retrieval
        let accessToken = fbConfig.accessToken;
        if (fbConfig.userAccessToken && fbConfig.pageId) {
          logger.info(`Usando user access token associado à página para buscar lead`);
          accessToken = fbConfig.userAccessToken;
        }
        
        const response = await axios.get(
          `https://graph.facebook.com/v20.0/${leadId}`,
          {
            params: {
              access_token: accessToken,
              // Lista ajustada de campos para evitar erros de campo inexistente
              // Começando com os campos essenciais que sempre existem
              fields: 'id,created_time,field_data,form_id'
            }
          }
        );
        
        if (!response.data || !response.data.id) {
          throw new Error(`API do Facebook retornou dados inválidos para o lead ${leadId}`);
        }
        
        leadData = response.data;
        logger.info(`Dados do lead ${leadId} obtidos com sucesso da API do Facebook`);
        
      } catch (apiError: any) {
        // Extrair informações detalhadas do erro para diagnóstico
        let errorMessage = `Erro ao buscar dados do lead na API do Facebook: ${apiError}`;
        let errorReason = "Erro desconhecido";
        
        // Tentar extrair mensagem detalhada do erro da API
        if (apiError.response) {
          const statusCode = apiError.response.status;
          const errorData = apiError.response.data;
          
          errorMessage = `Erro ${statusCode} ao buscar dados do lead na API do Facebook`;
          logger.error(`Status: ${statusCode}`);
          
          if (errorData && errorData.error) {
            // Extrair a mensagem específica do erro
            errorReason = errorData.error.message || errorData.error.type || JSON.stringify(errorData.error);
            logger.error(`Detalhes do erro: ${errorReason}`);
            
            // Diagnóstico específico baseado na mensagem de erro
            if (errorReason.includes("invalid OAuth access token") || 
                errorReason.includes("expired access token")) {
              logger.error("Diagnóstico: Token de acesso inválido ou expirado");
            } else if (errorReason.includes("permission")) {
              logger.error("Diagnóstico: Falta de permissão para acessar dados de leads");
            } else if (errorReason.includes("does not exist")) {
              logger.error("Diagnóstico: O ID do lead não existe ou foi excluído");
            }
          }
        }
        
        // Registrar o erro principal e usar dados de fallback
        logger.error(errorMessage);
        logger.warn(`Usando informações básicas do webhook para processamento do lead ${leadId}`);
        
        // Criar um objeto de lead com dados mínimos disponíveis no webhook
        leadData = {
          id: leadId,
          created_time: new Date(leadInfo.created_time * 1000).toISOString(),
          form_id: leadInfo.form_id,
          ad_id: leadInfo.ad_id,
          adgroup_id: leadInfo.adgroup_id,
          field_data: [
            // Como não temos dados reais, usamos um placeholder que será substituído depois
            { name: "full_name", values: [`Lead Facebook (${leadId.slice(-6)})`] },
            { name: "email", values: [""] },
            { name: "phone_number", values: [""] }
          ]
        };
      }
      
      // Converter lead em cliente
      await this.convertLeadToClient(leadData, leadInfo);
      
      logger.info(`Lead do Facebook ${leadId} processado com sucesso`);
    } catch (error) {
      logger.error(`Erro ao processar lead ${leadId} do Facebook: ${error}`);
      throw error;
    }
  }
  
  /**
   * Converte um lead do Facebook em um lead no sistema e depois em cliente
   * @param leadData Dados do lead do Facebook
   * @param rawInfo Informações brutas do webhook
   */
  private async convertLeadToClient(leadData: FacebookLeadData, rawInfo: any): Promise<void> {
    try {
      // Log detalhado dos dados recebidos do Facebook
      logger.info(`Dados completos do lead do Facebook: ${JSON.stringify(leadData)}`);
      logger.info(`Raw webhook info: ${JSON.stringify(rawInfo)}`);
      
      // Verificar conteúdo de field_data
      if (leadData.field_data) {
        logger.info(`Campos disponíveis no lead: ${leadData.field_data.map(f => f.name).join(', ')}`);
      } else {
        logger.error(`Lead sem field_data`);
      }
      
      // Extrair dados do lead
      const name = this.extractFieldValue(leadData, "full_name") || 
                  this.extractFieldValue(leadData, "name") || 
                  "Lead Facebook";
                  
      const email = this.extractFieldValue(leadData, "email") || null;
      const phone = this.extractFieldValue(leadData, "phone_number") || 
                   this.extractFieldValue(leadData, "phone") || null;
      
      // Log dos dados extraídos
      logger.info(`Dados extraídos: nome=${name}, email=${email}, telefone=${phone}`);
      
      // Garantir que temos um telefone válido (campo obrigatório)
      const validPhone = phone || "Não informado";
      
      // Preparar os dados do lead para processamento pela automação
      const leadToProcess = {
        fullName: name,
        email: email,
        phone: validPhone,
        source: "Facebook Ads",
        notes: `Lead gerado automaticamente do Facebook Ads. ID: ${leadData.id}, Form: ${leadData.form_id}`,
        sourceDetails: {
          leadId: leadData.id,
          formId: leadData.form_id,
          adId: leadData.ad_id || rawInfo.ad_id,
          adgroupId: leadData.adgroup_id || rawInfo.adgroup_id,
          pageId: rawInfo.page_id,
          createdTime: leadData.created_time
        }
      };
      
      // Processar o lead através do serviço de automação
      logger.info(`Processando lead do Facebook através do serviço de automação`);
      logger.info(`Dados enviados para o serviço de automação: ${JSON.stringify(leadToProcess)}`);
      
      try {
        const automationResult = await processLeadAutomation({
          type: LeadProcessingType.NEW_LEAD,
          lead: leadToProcess
        });
        
        logger.info(`Resultado da automação: ${JSON.stringify(automationResult)}`);
        
        if (!automationResult.leadId) {
          logger.error(`ALERTA: Automação não retornou ID de lead válido`);
        }
        
        if (!automationResult.success) {
          logger.error(`Falha na automação do lead do Facebook: ${automationResult.message}`);
          
          // Fallback: usar o método antigo para garantir que o lead seja registrado
          logger.info(`Utilizando método padrão para garantir registro do lead`);
          await this.createLeadWithoutAutomation(leadToProcess, leadData, rawInfo);
          return;
        }
        
        logger.info(`Lead do Facebook processado com sucesso pela automação. ID: ${automationResult.leadId}, Status: ${automationResult.status}`);
        
        // Obter o storage para trabalhar com o lead e conversão para cliente
        const { storage } = await import('../storage');
        
        // NOVA FUNCIONALIDADE: Converter automaticamente o lead para cliente
        if (automationResult.leadId) {
          try {
            logger.info(`Iniciando conversão automática de lead para cliente. Lead ID: ${automationResult.leadId}`);
            
            // Obter lead do banco de dados
            const leadRecord = await storage.getLead(automationResult.leadId);
            if (!leadRecord) {
              logger.error(`Lead não encontrado para conversão automática: ${automationResult.leadId}`);
            } else if (leadRecord.clienteId) {
              logger.info(`Lead ${automationResult.leadId} já está associado ao cliente ${leadRecord.clienteId}`);
            } else {
              // Converter o lead para cliente
              const conversionResult = await storage.convertLeadToCliente(automationResult.leadId);
              
              if ('error' in conversionResult) {
                logger.error(`Erro ao converter lead para cliente automaticamente: ${conversionResult.error}`);
              } else {
                logger.info(`Lead ${automationResult.leadId} convertido automaticamente para cliente ${conversionResult.id}`);
                
                // Atualizar o clienteId para uso posterior na validação de WhatsApp
                const clienteId = conversionResult.id;
                
                // Se temos um lead ID e um número de telefone válido, validar WhatsApp
                if (validPhone && validPhone !== "Não informado") {
                  try {
                    logger.info(`Validando WhatsApp para novo cliente ID=${clienteId} com telefone=${validPhone}`);
                    
                    // Carregar o módulo de WhatsApp e executar a validação
                    const whatsappModule = await import('../routes/whatsapp');
                    const result = await whatsappModule.validateAndUpdateClienteWhatsappStatus(clienteId, validPhone);
                    
                    if (result !== null) {
                      logger.info(`Cliente ${clienteId} do Facebook tem WhatsApp: ${result}`);
                      
                      // Se o cliente tem WhatsApp, tentar buscar a foto de perfil
                      if (result === true) {
                        try {
                          logger.info(`Buscando foto de perfil para cliente do Facebook ${clienteId}`);
                          // Importar o serviço de busca de foto de perfil
                          const { fetchSingleClientProfilePic } = await import('../services/whatsapp-profile-pic');
                          const photoResult = await fetchSingleClientProfilePic(clienteId);
                          
                          if (photoResult && photoResult.status) {
                            logger.info(`Foto de perfil atualizada para cliente do Facebook ${clienteId}`);
                          } else {
                            logger.info(`Não foi possível obter foto de perfil para cliente do Facebook ${clienteId}`);
                          }
                        } catch (photoError) {
                          logger.error(`Erro ao buscar foto de perfil para cliente do Facebook ${clienteId}: ${photoError}`);
                        }
                      }
                    }
                  } catch (validateError) {
                    logger.error(`Erro ao validar WhatsApp para cliente do Facebook: ${validateError}`);
                  }
                } else {
                  logger.info(`Cliente criado sem telefone válido, pulando validação de WhatsApp`);
                }
              }
            }
          } catch (conversionError) {
            logger.error(`Erro durante a conversão automática de lead para cliente: ${conversionError}`);
          }
        } else {
          logger.error(`Lead do Facebook processado sem ID válido, não é possível converter para cliente`);
        }
      } catch (innerError) {
        logger.error(`Erro durante o processamento de automação: ${innerError}`);
        
        // Fallback se a automação falhar por qualquer motivo
        logger.info(`Utilizando método de fallback após erro na automação`);
        await this.createLeadWithoutAutomation(leadToProcess, leadData, rawInfo);
      }
    } catch (error) {
      logger.error(`Erro ao converter lead do Facebook em cliente: ${error}`);
      throw error;
    }
  }
  
  /**
   * Método de fallback para criar lead sem automação,
   * mantendo o comportamento original em caso de falha na automação
   */
  private async createLeadWithoutAutomation(
    leadInfo: any, 
    leadData: FacebookLeadData, 
    rawInfo: any
  ): Promise<void> {
    // Importar dependências
    const { storage } = await import('../storage');
    const { LeadStatusEnum } = await import('../../shared/schema');
    
    // Criar lead no sistema
    const newLead = await storage.createLead({
      fullName: leadInfo.fullName,
      email: leadInfo.email,
      phone: leadInfo.phone,
      source: "Facebook Ads",
      status: LeadStatusEnum.SEM_ATENDIMENTO,
      notes: leadInfo.notes,
      sourceDetails: leadInfo.sourceDetails
    });
    
    logger.info(`Novo lead criado (fallback) na tabela sistema_leads. ID: ${newLead.id}, Nome: ${newLead.fullName}`);
    
    // Criar cliente baseado no lead
    const newClient = await db.insert(clientes).values({
      fullName: leadInfo.fullName,
      email: leadInfo.email,
      phone: leadInfo.phone,
      preferredContact: leadInfo.phone && leadInfo.phone !== "Não informado" 
        ? MeioContato.WHATSAPP 
        : MeioContato.EMAIL,
      status: ClienteStatus.SEM_ATENDIMENTO,
      source: ClienteSource.FACEBOOK_ADS,
      sourceDetails: leadInfo.sourceDetails,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    const clienteId = newClient[0].id;
    logger.info(`Novo cliente criado (fallback) a partir do lead do Facebook. ID: ${clienteId}, Nome: ${newClient[0].fullName}`);
    
    // Atualizar o lead com o ID do cliente
    if (newLead && newLead.id) {
      await storage.updateLead(newLead.id, { clienteId });
      logger.info(`Lead ${newLead.id} atualizado (fallback) com referência ao cliente ${clienteId}`);
    }
    
    // Validar WhatsApp será feito pelo método chamador
  }
  
  /**
   * Extrai o valor de um campo dos dados do lead
   * @param leadData Dados do lead
   * @param fieldName Nome do campo
   * @returns Valor do campo ou nulo
   */
  private extractFieldValue(leadData: FacebookLeadData, fieldName: string): string | null {
    // Lista de possíveis nomes de campo para cada tipo de dado
    const fieldNameMap: Record<string, string[]> = {
      'full_name': ['full_name', 'name', 'full name', 'nome completo', 'nome'],
      'email': ['email', 'e-mail', 'email address', 'endereço de email'],
      'phone': ['phone', 'phone_number', 'telefone', 'celular', 'mobile', 'mobile_phone', 'telephone']
    };
    
    // Use a lista de nomes alternativos se disponível para o campo solicitado
    const possibleNames = fieldNameMap[fieldName] || [fieldName];
    
    // Procura por qualquer um dos nomes possíveis
    for (const name of possibleNames) {
      const field = leadData.field_data?.find(f => 
        f.name.toLowerCase() === name.toLowerCase()
      );
      
      if (field && field.values && field.values.length > 0 && field.values[0]) {
        // Se for um número de telefone, formatá-lo para o padrão brasileiro
        if (fieldName === 'phone' || fieldName === 'phone_number') {
          return this.formatPhoneNumber(field.values[0]);
        }
        return field.values[0];
      }
    }
    
    // Tenta buscar o campo pelo nome exato fornecido como último recurso
    const exactField = leadData.field_data?.find(f => 
      f.name.toLowerCase() === fieldName.toLowerCase()
    );
    
    if (exactField && exactField.values && exactField.values.length > 0) {
      // Se for um número de telefone, formatá-lo para o padrão brasileiro
      if (fieldName === 'phone' || fieldName === 'phone_number') {
        return this.formatPhoneNumber(exactField.values[0]);
      }
      return exactField.values[0] || null;
    }
    
    return null;
  }
  
  /**
   * Formata um número de telefone para o padrão brasileiro
   * @param phoneNumber Número de telefone a ser formatado
   * @returns Número formatado
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remover todos os caracteres não numéricos
    let numbers = phoneNumber.replace(/\D/g, '');
    
    // Se começar com '+55', remover
    if (numbers.startsWith('55')) {
      numbers = numbers.substring(2);
    }
    
    // Se começar com '0', remover
    if (numbers.startsWith('0')) {
      numbers = numbers.substring(1);
    }
    
    // Verificar se é um número de celular válido (com DDD)
    if (numbers.length < 10 || numbers.length > 11) {
      // Se não for um número válido, retornar como está
      return phoneNumber;
    }
    
    // Extrair DDD e número
    const ddd = numbers.substring(0, 2);
    const numero = numbers.length === 11 
      ? `${numbers.substring(2, 7)}-${numbers.substring(7)}` // Celular (com 9 na frente)
      : `${numbers.substring(2, 6)}-${numbers.substring(6)}`; // Telefone fixo
    
    // Retornar no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
    return `(${ddd}) ${numero}`;
  }
}

export const facebookLeadService = new FacebookLeadService();
import axios from 'axios';
import { logger } from '../utils/logger';
import { db } from '../database';
import { facebookConfig } from '@shared/schema';

/**
 * Serviço para gerenciar assinaturas de webhook do Facebook
 */
export class FacebookSubscriptionService {
  /**
   * Assina o webhook no nível do App para receber notificações de leads
   * @param baseUrl URL base do aplicativo (ex: https://seu-app.com)
   * @returns Resultado da assinatura
   */
  public async subscribeToWebhook(baseUrl: string): Promise<{success: boolean, message: string}> {
    try {
      // Buscar configuração do Facebook
      const fbConfig = await db.query.facebookConfig.findFirst({
        where: (config, { eq }) => eq(config.isActive, true)
      });
      
      if (!fbConfig || !fbConfig.appId || !fbConfig.appSecret || !fbConfig.verificationToken) {
        throw new Error("Configuração do Facebook incompleta. Necessário App ID, App Secret e Verification Token.");
      }
      
      // Gerar o app access token (appid|appsecret)
      const appAccessToken = `${fbConfig.appId}|${fbConfig.appSecret}`;
      
      // Construir a URL de callback
      const callbackUrl = `${baseUrl}/api/webhooks/facebook`.replace(/\/+$/, '');
      
      logger.info(`Assinando webhook do Facebook: ${callbackUrl} para o App ${fbConfig.appId}`);
      
      // Fazer a requisição para assinar o webhook (usando v20.0 que é a estável em 2025)
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/${fbConfig.appId}/subscriptions`,
        null,
        {
          params: {
            object: 'page',
            callback_url: callbackUrl,
            fields: 'leadgen',
            verify_token: fbConfig.verificationToken,
            access_token: appAccessToken
          }
        }
      );
      
      if (response.data && response.data.success) {
        logger.info(`Webhook assinado com sucesso para o App ${fbConfig.appId}`);
        return { 
          success: true, 
          message: "Webhook assinado com sucesso!" 
        };
      } else {
        throw new Error(`Resposta inesperada da API do Facebook: ${JSON.stringify(response.data)}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Erro ao assinar webhook do Facebook: ${errorMessage}`);
      return { 
        success: false, 
        message: `Erro ao assinar webhook: ${errorMessage}` 
      };
    }
  }
  
  /**
   * Obtém o status atual das assinaturas de webhook do aplicativo
   * @returns Lista de assinaturas ativas
   */
  public async getSubscriptionStatus(): Promise<any> {
    try {
      // Buscar configuração do Facebook
      const fbConfig = await db.query.facebookConfig.findFirst({
        where: (config, { eq }) => eq(config.isActive, true)
      });
      
      if (!fbConfig || !fbConfig.appId || !fbConfig.appSecret) {
        throw new Error("Configuração do Facebook incompleta. Necessário App ID e App Secret.");
      }
      
      // Gerar o app access token (appid|appsecret)
      const appAccessToken = `${fbConfig.appId}|${fbConfig.appSecret}`;
      
      // Fazer a requisição para verificar assinaturas (usando v20.0 que é a estável em 2025)
      const response = await axios.get(
        `https://graph.facebook.com/v20.0/${fbConfig.appId}/subscriptions`,
        {
          params: {
            access_token: appAccessToken
          }
        }
      );
      
      if (response.data && response.data.data) {
        logger.info(`Status das assinaturas de webhook obtido para o App ${fbConfig.appId}`);
        return {
          success: true,
          subscriptions: response.data.data
        };
      } else {
        throw new Error(`Resposta inesperada da API do Facebook: ${JSON.stringify(response.data)}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Erro ao obter status das assinaturas do webhook: ${errorMessage}`);
      return { 
        success: false, 
        message: `Erro ao verificar assinaturas: ${errorMessage}`,
        subscriptions: []
      };
    }
  }
  
  /**
   * Assina uma página específica para receber notificações de leads
   * @param pageId ID da página a ser assinada
   * @param userAccessToken Token de acesso do usuário com permissões na página
   * @returns Resultado da assinatura
   */
  public async subscribePage(pageId: string, userAccessToken: string): Promise<{success: boolean, message: string}> {
    try {
      logger.info(`Assinando página ${pageId} para receber eventos leadgen`);
      
      // Fazer a requisição para assinar a página (usando v20.0 que é a estável em 2025)
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/${pageId}/subscribed_apps`,
        null,
        {
          params: {
            subscribed_fields: 'leadgen',
            access_token: userAccessToken
          }
        }
      );
      
      if (response.data && response.data.success) {
        logger.info(`Página ${pageId} assinada com sucesso`);
        return { 
          success: true, 
          message: "Página assinada com sucesso!" 
        };
      } else {
        throw new Error(`Resposta inesperada da API do Facebook: ${JSON.stringify(response.data)}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Erro ao assinar página ${pageId}: ${errorMessage}`);
      return { 
        success: false, 
        message: `Erro ao assinar página: ${errorMessage}` 
      };
    }
  }
  
  /**
   * Verifica quais páginas estão assinadas para o aplicativo
   * @param userAccessToken Token de acesso do usuário
   * @returns Lista de páginas assinadas
   */
  public async getSubscribedPages(userAccessToken: string): Promise<any> {
    try {
      // Buscar configuração do Facebook
      const fbConfig = await db.query.facebookConfig.findFirst({
        where: (config, { eq }) => eq(config.isActive, true)
      });
      
      if (!fbConfig || !fbConfig.appId) {
        throw new Error("Configuração do Facebook incompleta. Necessário App ID.");
      }
      
      // Obter as páginas do usuário (usando v20.0 que é a estável em 2025)
      const pagesResponse = await axios.get(
        `https://graph.facebook.com/v20.0/me/accounts`,
        {
          params: {
            access_token: userAccessToken
          }
        }
      );
      
      if (!pagesResponse.data || !pagesResponse.data.data) {
        throw new Error("Não foi possível obter as páginas do usuário");
      }
      
      const pages = pagesResponse.data.data;
      const subscribedPages = [];
      
      // Para cada página, verificar se está assinada
      for (const page of pages) {
        try {
          const subscribedAppsResponse = await axios.get(
            `https://graph.facebook.com/v20.0/${page.id}/subscribed_apps`,
            {
              params: {
                access_token: page.access_token
              }
            }
          );
          
          const isSubscribed = subscribedAppsResponse.data && 
                              subscribedAppsResponse.data.data && 
                              subscribedAppsResponse.data.data.some((app: any) => 
                                app.id === fbConfig.appId && 
                                app.subscribed_fields.includes('leadgen')
                              );
          
          subscribedPages.push({
            id: page.id,
            name: page.name,
            isSubscribed
          });
        } catch (pageError) {
          logger.error(`Erro ao verificar assinatura para página ${page.id}: ${pageError}`);
          subscribedPages.push({
            id: page.id,
            name: page.name,
            isSubscribed: false,
            error: String(pageError)
          });
        }
      }
      
      return {
        success: true,
        pages: subscribedPages
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Erro ao verificar páginas assinadas: ${errorMessage}`);
      return { 
        success: false, 
        message: `Erro ao verificar páginas: ${errorMessage}`,
        pages: []
      };
    }
  }
}

export const facebookSubscriptionService = new FacebookSubscriptionService();
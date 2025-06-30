import { logger } from '../utils/logger';
import axios from 'axios';
import { db } from '../database';
import { clientes } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Inicializa o logger para o serviço de automação WhatsApp
const automationLogger = logger.createLogger("WhatsAppAutomation");

/**
 * Interface para configuração da API WhatsApp customizada
 */
interface CustomWhatsAppApiConfig {
  serverUrl: string;
  apiKey: string;
  instance: string;
}

/**
 * Interface para resposta da API de verificação de números
 */
interface WhatsAppNumberCheckResponse {
  numbers: Array<{
    number: string;
    exists: boolean;
    jid?: string;
  }>;
}

/**
 * Obtém as configurações da API WhatsApp customizada do .env
 */
function getCustomApiConfig(): CustomWhatsAppApiConfig | null {
  const serverUrl = process.env.CUSTOM_WHATSAPP_SERVER_URL;
  const apiKey = process.env.CUSTOM_WHATSAPP_API_KEY;
  const instance = process.env.CUSTOM_WHATSAPP_INSTANCE;

  if (!serverUrl || !apiKey || !instance) {
    automationLogger.warn("Configurações da API WhatsApp customizada não encontradas no .env");
    return null;
  }

  return { serverUrl, apiKey, instance };
}

/**
 * Formata um número de telefone para o padrão brasileiro
 */
function formatPhoneNumber(phone: string): string {
  // Remove todos os caracteres não numéricos
  const cleanNumber = phone.replace(/\D/g, '');
  
  // Se o número já começa com 55 (código do Brasil), mantém como está
  if (cleanNumber.startsWith('55')) {
    return cleanNumber;
  }
  
  // Se não tem código do país, adiciona 55
  return `55${cleanNumber}`;
}

/**
 * Verifica se um número tem conta ativa no WhatsApp usando o endpoint customizado
 * @param phoneNumber Número de telefone para verificar
 * @returns Resultado da verificação ou null em caso de erro
 */
export async function checkWhatsAppAccountStatus(phoneNumber: string): Promise<boolean | null> {
  try {
    const apiConfig = getCustomApiConfig();
    if (!apiConfig) {
      automationLogger.error("API customizada não configurada");
      return null;
    }

    const formattedNumber = formatPhoneNumber(phoneNumber);
    
    automationLogger.info(`Verificando status do WhatsApp para número: ${formattedNumber}`);

    const response = await axios.post(
      `${apiConfig.serverUrl}/chat/whatsappNumbers/${apiConfig.instance}`,
      {
        numbers: [formattedNumber]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiConfig.apiKey
        },
        timeout: 30000 // 30 segundos de timeout
      }
    );

    automationLogger.debug(`Resposta da API: ${JSON.stringify(response.data)}`);

    // Processar a resposta
    if (response.data && Array.isArray(response.data)) {
      const result = response.data.find(item => item.number === formattedNumber);
      if (result) {
        return result.exists === true;
      }
    }

    // Se a resposta não está no formato esperado, tenta processar como objeto
    if (response.data && typeof response.data === 'object') {
      const numberResult = response.data[formattedNumber];
      if (numberResult) {
        return numberResult.exists === true || numberResult.exist === true;
      }
    }

    automationLogger.warn(`Resposta da API não contém resultado para o número ${formattedNumber}`);
    return null;

  } catch (error) {
    automationLogger.error(`Erro ao verificar status do WhatsApp para ${phoneNumber}:`, error);
    return null;
  }
}

/**
 * Automação principal: verifica WhatsApp de um cliente e atualiza no banco
 * @param clienteId ID do cliente
 * @param phoneNumber Número de telefone do cliente
 */
export async function automateWhatsAppCheck(clienteId: number, phoneNumber: string): Promise<void> {
  try {
    automationLogger.info(`Iniciando automação WhatsApp para cliente ${clienteId} com telefone ${phoneNumber}`);

    // Verificar se o cliente tem conta ativa no WhatsApp
    const hasWhatsApp = await checkWhatsAppAccountStatus(phoneNumber);

    if (hasWhatsApp === null) {
      automationLogger.warn(`Não foi possível verificar WhatsApp para cliente ${clienteId}`);
      return;
    }

    // Atualizar o banco de dados com o resultado
    await db.update(clientes)
      .set({
        hasWhatsapp: hasWhatsApp,
        whatsappJid: hasWhatsApp ? `${formatPhoneNumber(phoneNumber)}@s.whatsapp.net` : null,
        updatedAt: new Date()
      })
      .where(eq(clientes.id, clienteId));

    automationLogger.info(
      `Cliente ${clienteId} atualizado com sucesso: hasWhatsApp=${hasWhatsApp}`
    );

  } catch (error) {
    automationLogger.error(`Erro na automação WhatsApp para cliente ${clienteId}:`, error);
  }
}

/**
 * Automação para verificar WhatsApp de múltiplos clientes em lote
 * @param clienteIds Array de IDs dos clientes
 */
export async function automateWhatsAppCheckBatch(clienteIds: number[]): Promise<void> {
  automationLogger.info(`Iniciando verificação em lote para ${clienteIds.length} clientes`);

  for (const clienteId of clienteIds) {
    try {
      // Buscar dados do cliente
      const cliente = await db.query.clientes.findFirst({
        where: eq(clientes.id, clienteId)
      });

      if (!cliente || !cliente.phone) {
        automationLogger.warn(`Cliente ${clienteId} não encontrado ou sem telefone`);
        continue;
      }

      // Executar automação para este cliente
      await automateWhatsAppCheck(clienteId, cliente.phone);

      // Aguardar 2 segundos entre cada verificação para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      automationLogger.error(`Erro ao processar cliente ${clienteId} no lote:`, error);
      // Continua com o próximo cliente mesmo se houver erro
    }
  }

  automationLogger.info(`Verificação em lote concluída para ${clienteIds.length} clientes`);
}

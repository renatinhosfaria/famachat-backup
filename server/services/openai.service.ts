import OpenAI from 'openai';
import { db } from '../database';
import { logger } from '../utils/logger';
import { sql, desc, eq } from 'drizzle-orm';
import { sistema_daily_content, InsertDailyContent } from '../models/daily-content';

// Inicializa o logger para o serviço OpenAI
const openaiLogger = logger.createLogger("OpenAIService");

// Inicializa o cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Interface que representa a resposta da OpenAI
interface DailyContentResponse {
  title: string;
  content: string;
  imagePrompt: string;
  tags: string[];
}

export class OpenAIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      openaiLogger.warn('OPENAI_API_KEY não está configurada. O serviço OpenAI não funcionará corretamente.');
    }
  }

  /**
   * Gera conteúdo diário sobre o mercado imobiliário
   * @param category Categoria do conteúdo (ignorada na versão atual)
   * @returns Conteúdo gerado
   */
  async generateDailyContent(category: string = 'mercado_imobiliario'): Promise<InsertDailyContent | null> {
    try {
      openaiLogger.info(`Gerando conteúdo diário, categoria ${category} (ignorada)`);

      // Verificar se já existe conteúdo gerado hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingContent = await db.select()
        .from(sistema_daily_content)
        .where(
          sql`${sistema_daily_content.created_at} >= ${today.toISOString()}`
        )
        .limit(1);

      if (existingContent.length > 0) {
        openaiLogger.info(`Conteúdo diário já existe para hoje`);
        return null; // Já existe conteúdo para hoje
      }

      // Gerar conteúdo com GPT-4o
      const contentResponse = await this.generateContentWithGPT(category);
      if (!contentResponse) {
        return null;
      }

      // Gerar imagem usando DALL-E
      const imageUrl = await this.generateImageWithDALLE(contentResponse.imagePrompt);
      
      // Criar o objeto de conteúdo diário adequado ao esquema existente
      const newContent: InsertDailyContent = {
        title: contentResponse.title,
        content: contentResponse.content,
        image_url: imageUrl || '',
        active: true
      };

      // Salvar no banco de dados
      const insertedContents = await db.insert(sistema_daily_content)
        .values(newContent)
        .returning();
      
      const savedContent = insertedContents[0];
      openaiLogger.info(`Conteúdo diário gerado com sucesso: ${savedContent.id}`);
      
      return newContent;
    } catch (error) {
      openaiLogger.error('Erro ao gerar conteúdo diário:', error);
      return null;
    }
  }

  /**
   * Gera conteúdo textual com GPT-4o
   * @param category Categoria do conteúdo
   * @returns Resposta formatada
   */
  private async generateContentWithGPT(category: string): Promise<DailyContentResponse | null> {
    try {
      const prompt = this.getPromptForCategory(category);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // o modelo mais recente da OpenAI
        messages: [
          {
            role: "system",
            content: "Você é um especialista no mercado imobiliário brasileiro. Sua missão é criar conteúdo informativo e relevante para profissionais e clientes do setor imobiliário."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.7,
      });

      const responseContent = completion.choices[0].message.content;
      if (!responseContent) {
        openaiLogger.error('Resposta vazia do GPT-4o');
        return null;
      }

      try {
        return JSON.parse(responseContent) as DailyContentResponse;
      } catch (e) {
        openaiLogger.error('Erro ao fazer parse da resposta JSON:', e);
        return null;
      }
    } catch (error) {
      openaiLogger.error('Erro ao gerar conteúdo com GPT-4o:', error);
      return null;
    }
  }

  /**
   * Gera uma imagem com DALL-E 3
   * @param prompt Descrição da imagem
   * @returns URL da imagem gerada
   */
  private async generateImageWithDALLE(prompt: string): Promise<string | null> {
    try {
      // Adiciona contexto brasileiro ao prompt para melhores resultados
      const enhancedPrompt = `Uma imagem profissional e de alta qualidade sobre o mercado imobiliário brasileiro: ${prompt}. Estilo fotográfico profissional, cores vibrantes, em contexto urbano brasileiro.`;
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      if (response && response.data && response.data[0] && response.data[0].url) {
        return response.data[0].url;
      }
      
      return null;
    } catch (error) {
      openaiLogger.error('Erro ao gerar imagem com DALL-E:', error);
      return null;
    }
  }

  /**
   * Obtém o prompt adequado para cada categoria
   * @param category Categoria do conteúdo
   * @returns Prompt para o OpenAI
   */
  private getPromptForCategory(category: string): string {
    const prompts: Record<string, string> = {
      mercado_imobiliario: `Gere um artigo informativo sobre o mercado imobiliário brasileiro atual.
        O conteúdo deve ser relevante para o dia de hoje, com informações atualizadas sobre tendências,
        novidades ou dicas práticas. Adicione estatísticas e exemplos concretos.
        
        A resposta deve estar no formato JSON, seguindo exatamente esta estrutura:
        
        {
          "title": "Título chamativo e informativo do artigo",
          "content": "Conteúdo completo em português do Brasil, com 3-4 parágrafos bem estruturados. Use linguagem profissional mas acessível.",
          "imagePrompt": "Descrição detalhada para gerar uma imagem ilustrativa sobre o conteúdo",
          "tags": ["mercado imobiliário", "imóveis", "investimento", "tendências", "brasil"]
        }`,
      
      dicas_vendas: `Gere um artigo com dicas práticas para corretores imobiliários melhorarem suas vendas.
        Foque em estratégias atuais e eficazes para o mercado brasileiro.
        
        A resposta deve estar no formato JSON, seguindo exatamente esta estrutura:
        
        {
          "title": "Título chamativo e informativo do artigo",
          "content": "Conteúdo completo em português do Brasil, com 3-4 parágrafos bem estruturados. Use linguagem profissional mas acessível.",
          "imagePrompt": "Descrição detalhada para gerar uma imagem ilustrativa sobre o conteúdo",
          "tags": ["vendas imobiliárias", "dicas", "corretores", "negociação", "atendimento"]
        }`
    };
    
    return prompts[category] || prompts.mercado_imobiliario;
  }

  /**
   * Obtém o conteúdo diário mais recente
   * @param category Categoria do conteúdo (ignorada na versão atual)
   * @returns Conteúdo mais recente
   */
  async getLatestContent(category: string = 'mercado_imobiliario') {
    try {
      openaiLogger.info(`Buscando conteúdo mais recente, categoria ${category} (ignorada)`);
      
      const content = await db.select()
        .from(sistema_daily_content)
        .where(
          eq(sistema_daily_content.active, true)
        )
        .orderBy(desc(sistema_daily_content.created_at))
        .limit(1);
      
      if (content.length === 0) {
        return null;
      }
      
      // Adaptar o formato para o que o frontend espera
      return {
        id: content[0].id,
        title: content[0].title,
        content: content[0].content,
        imageUrl: content[0].image_url,
        generatedDate: content[0].created_at,
        isActive: content[0].active,
        category: 'mercado_imobiliario', // Definido fixo já que não existe na tabela
        tags: [] // Tags não existem na tabela atual
      };
    } catch (error) {
      openaiLogger.error(`Erro ao obter conteúdo mais recente: ${error}`);
      return null;
    }
  }
}

export const openAIService = new OpenAIService();
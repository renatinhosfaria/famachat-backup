import { useState, useEffect } from 'react';
import axios from 'axios';

export interface DailyContent {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  category: string;
  tags: string[];
  isActive: boolean;
  generatedDate: string;
}

export function useDailyContent(category: string = 'mercado_imobiliario') {
  const [content, setContent] = useState<DailyContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/openai/daily-content?category=${category}`);
      
      if (response.data.success && response.data.data) {
        setContent(response.data.data);
      } else {
        setContent(null);
      }
    } catch (err) {
      console.error('Erro ao carregar conteúdo diário:', err);
      setError('Não foi possível carregar o conteúdo. Tente novamente mais tarde.');
      setContent(null);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewContent = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.post('/api/openai/generate-content', { category });
      
      if (response.data.success && response.data.data) {
        setContent(response.data.data);
        return true;
      } else {
        fetchContent(); // Tenta buscar conteúdo existente mesmo se a geração falhar
        return false;
      }
    } catch (err) {
      console.error('Erro ao gerar novo conteúdo:', err);
      setError('Não foi possível gerar novo conteúdo. Tente novamente mais tarde.');
      setContent(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [category]);

  return {
    content,
    isLoading,
    error,
    fetchContent,
    generateNewContent
  };
}
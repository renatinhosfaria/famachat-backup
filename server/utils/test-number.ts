/**
 * Script de teste para validação de números do WhatsApp
 * 
 * Este script pode ser executado manualmente para verificar a formatação e validação
 * de números de telefone com a API do WhatsApp.
 */

import axios from 'axios';

// Função de formatação de número (cópia da função em whatsapp-validation.ts)
function formatPhoneNumber(number: string): string {
  // Remover todos os caracteres não numéricos
  const cleanNumber = number.replace(/\D/g, '');
  
  // Se o número estiver vazio, retornamos uma string vazia
  if (!cleanNumber || cleanNumber.length < 8) {
    return '';
  }
  
  // Se o número já começa com 55 (código do Brasil), formatamos removendo o 9º dígito
  if (cleanNumber.startsWith('55')) {
    // Verificar se é um celular (números que começam com 55 + DDD + 9)
    if (cleanNumber.length > 12) {
      // Exemplo: 5511999999999 -> 551199999999 (remover o 9º dígito)
      const ddd = cleanNumber.substring(2, 4);
      const has9thDigit = cleanNumber.substring(4, 5) === '9';
      
      if (has9thDigit) {
        // Remover o 9º dígito: 5511999999999 -> 551199999999
        const mainNumber = cleanNumber.substring(5);
        return `55${ddd}${mainNumber}`;
      }
      
      // Se não tem o 9º dígito, manter como está
      return cleanNumber;
    }
    
    // Se já está no formato correto, retornar como está
    return cleanNumber;
  }
  
  // Outros casos: formatar como 55 + número sem o 9º dígito
  if (cleanNumber.length > 10) {
    // Verificar se o número começa com 9 (após o DDD)
    const ddd = cleanNumber.substring(0, 2);
    const has9thDigit = cleanNumber.substring(2, 3) === '9';
    
    if (has9thDigit) {
      // Remover o 9º dígito: 11999999999 -> 1199999999
      const mainNumber = cleanNumber.substring(3);
      return `55${ddd}${mainNumber}`;
    }
  }
  
  // Caso padrão: adicionar 55 na frente
  return `55${cleanNumber}`;
}

// Configuração da API
const apiUrl = process.env.EVOLUTION_API_URL;
const apiKey = process.env.EVOLUTION_API_KEY;
const instanceName = 'renato'; // Nome da instância do WhatsApp

// Números de teste (exemplos)
const testNumbers = [
  '(34) 98881-9573', // Almira Silva
  '(34) 99866-6569', // Jhennifer Florinda
  '(34) 98430-4278'  // Luanna Rodrigues
];

async function testWhatsAppNumberValidation() {
  if (!apiUrl || !apiKey) {
    
    return;
  }

  
  
  
  

  // Formatar números para teste
  const formattedNumbers = testNumbers.map(n => formatPhoneNumber(n));
  
  
  testNumbers.forEach(n => );
  
  
  formattedNumbers.forEach(n => );
  
  // Primeiro, vamos verificar o estado da conexão da instância
  try {
    const stateUrl = `${apiUrl}/instance/connectionState/${instanceName}`;
    
    
    const stateResponse = await axios.get(
      stateUrl,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        }
      }
    );
    
    
    );
    
    // Verificar se a instância está conectada
    const connectionState = stateResponse.data?.state || 'unknown';
    
    
    if (connectionState !== 'open' && connectionState !== 'connected') {
      `);
      return;
    }
    
    // Agora tentar validar os números
    
    
    // Vamos tentar outra abordagem usando a API existingNumbers
    const existingUrl = `${apiUrl}/chat/existsNumber/${instanceName}`;
    
    
    // Testar com cada número individualmente
    for (const number of formattedNumbers) {
      try {
        
        
        const existingResponse = await axios.get(
          `${existingUrl}/${number}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey
            }
          }
        );
        
        
        );
      } catch (numError) {
        );
        if (axios.isAxiosError(numError) && numError.response) {
          
        }
      }
      
      // Aguardar um pouco entre as requisições para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Tentar o método original (verificação em lote)
    const batchUrl = `${apiUrl}/chat/whatsappNumbers/${instanceName}`;
    
    } }`);
    
    try {
      const response = await axios.post(
        batchUrl,
        { numbers: formattedNumbers },
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
          }
        }
      );
      
      
      );
    } catch (batchError) {
      );
      if (axios.isAxiosError(batchError) && batchError.response) {
        
      }
    }
    
  } catch (error) {
    );
    if (axios.isAxiosError(error) && error.response) {
      
    }
  }
}

// Executar o teste
testWhatsAppNumberValidation().catch(err => );
import { useState, useEffect } from 'react';

// Hook personalizado para armazenar e recuperar dados do localStorage
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // Função que obtém o valor inicial do localStorage ou usa o valor inicial fornecido
  const readValue = (): T => {
    // Se estamos no browser, tenta ler do localStorage
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // Recupera o valor salvo no localStorage
      const item = window.localStorage.getItem(key);
      // Retorna o valor parseado ou o valor inicial se nada foi encontrado
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      
      return initialValue;
    }
  };

  // Estado para manter o valor atual
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Função para salvar valor no localStorage
  const setValue = (value: T) => {
    if (typeof window === 'undefined') {
      
    }

    try {
      // Salva o estado
      const newValue = value instanceof Function ? value(storedValue) : value;
      
      // Salva no localStorage
      window.localStorage.setItem(key, JSON.stringify(newValue));
      
      // Atualiza o estado
      setStoredValue(newValue);
      
      // Dispara um evento para outros componentes que usam o mesmo localStorage key
      window.dispatchEvent(new Event('local-storage'));
    } catch (error) {
      
    }
  };

  // Escuta alterações no localStorage de outras instâncias do hook
  useEffect(() => {
    const handleStorageChange = () => {
      setStoredValue(readValue());
    };
    
    // Escuta o evento 'storage' para mudanças em outras abas/janelas
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage', handleStorageChange);
    };
  }, []);

  return [storedValue, setValue];
}
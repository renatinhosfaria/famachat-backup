import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  configOrMethod: string | { url: string; method: string; body?: unknown; headers?: Record<string, string> },
  urlOrData?: string | unknown,
  data?: unknown | undefined,
): Promise<any> {
  let url: string;
  let method: string;
  let body: unknown | undefined;
  let customHeaders: Record<string, string> = {};

  // Verificar se está sendo chamado com um objeto de configuração
  if (typeof configOrMethod === 'object' && configOrMethod !== null) {
    url = configOrMethod.url;
    method = configOrMethod.method;
    body = configOrMethod.body;
    customHeaders = configOrMethod.headers || {};
  } else {
    // Formato antigo: (method, url, data)
    method = configOrMethod as string;
    url = urlOrData as string;
    body = data;
  }

  // Obter token de autenticação do localStorage
  const accessToken = localStorage.getItem('access_token');

  // Preparar todos os headers
  const headers: Record<string, string> = {
    // Headers padrão
    ...(body ? { "Content-Type": "application/json" } : {}),
    // Token de autenticação se disponível
    ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
    // Headers customizados
    ...customHeaders
  };

  // Removi o log de todas as requisições para não poluir o console
  
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Verificar o tipo de conteúdo retornado
  const contentType = res.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    // Retornar o JSON parseado
    const jsonData = await res.json();
    return jsonData;
  } else {
    // Retornar a resposta original para processamento posterior
    return res;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Extrair a URL base e os parâmetros da chave de consulta
    const baseUrl = queryKey[0] as string;
    
    // Construir URL com parâmetros adicionais
    let url = baseUrl;
    
    // Se houver parâmetros adicionais na chave de consulta (e.g. período)
    if (queryKey.length > 1 && queryKey[1]) {
      // Se for uma string, assume que é o período
      if (typeof queryKey[1] === 'string') {
        url += `?period=${queryKey[1]}`;
      } 
      // Se for um objeto, assume que são parâmetros para query string
      else if (typeof queryKey[1] === 'object') {
        const params = new URLSearchParams();
        const paramsObj = queryKey[1] as Record<string, string>;
        Object.keys(paramsObj).forEach(key => {
          if (paramsObj[key]) params.append(key, paramsObj[key]);
        });
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
      }
    }
    
    // Obter token de autenticação do localStorage
    const accessToken = localStorage.getItem('access_token');
    
    // Preparar headers da requisição
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Fazer a requisição
    const res = await fetch(url, {
      credentials: "include",
      headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

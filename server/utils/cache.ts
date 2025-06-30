/**
 * Cache simples em memória com expiração para otimizar consultas frequentes
 */
export class Cache<T> {
  private store: Map<string, { value: T; expiry: number }>;
  private defaultTTL: number;

  /**
   * Cria uma nova instância de cache
   * @param ttlMs Tempo de vida em milissegundos (default: 5 minutos)
   */
  constructor(ttlMs = 5 * 60 * 1000) {
    this.store = new Map();
    this.defaultTTL = ttlMs;
  }

  /**
   * Obtém um valor do cache
   * @param key Chave para buscar
   * @returns O valor armazenado ou undefined se não existir ou estiver expirado
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Armazena um valor no cache
   * @param key Chave para armazenar
   * @param value Valor a ser armazenado
   * @param ttlMs Tempo de vida em milissegundos (opcional)
   */
  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs || this.defaultTTL;
    const expiry = Date.now() + ttl;
    this.store.set(key, { value, expiry });
  }

  /**
   * Remove um valor do cache
   * @param key Chave a ser removida
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Remove todos os valores do cache que correspondem ao prefixo
   * @param prefix Prefixo das chaves a serem removidas
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Remove entradas expiradas do cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Retorna a quantidade de itens no cache
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Retorna todas as chaves no cache
   */
  get keys(): string[] {
    return Array.from(this.store.keys());
  }
}

// Cache global para consultas de clientes
export const clienteCache = new Cache<any[]>(3 * 60 * 1000); // 3 minutos

// Cache global para consultas de usuários
export const userCache = new Cache<any>(10 * 60 * 1000); // 10 minutos
export const PEDIDOS_CACHE_TTL = 1000 * 60 * 2; // 2 minutos

interface PedidoCacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const pedidosCache = new Map<string, PedidoCacheEntry<unknown>>();

export function getPedidosCache<T = unknown>(zonaId: string) {
  return pedidosCache.get(zonaId) as PedidoCacheEntry<T> | undefined;
}

export function setPedidosCache<T = unknown>(zonaId: string, data: T) {
  pedidosCache.set(zonaId, { data, fetchedAt: Date.now() });
}

export function invalidatePedidosCache(zonaId?: string) {
  if (zonaId) {
    pedidosCache.delete(zonaId);
  } else {
    pedidosCache.clear();
  }
}

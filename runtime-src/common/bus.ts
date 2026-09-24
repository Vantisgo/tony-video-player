// Tiny event bus. Only the "any" channel is used in practice, but the API is
// kept event-keyed to match the original hand-written bus.
export type BusHandler<T> = (payload: T) => void;

export interface Bus<T> {
  on(event: string, fn: BusHandler<T>): () => void;
  emit(event: string, payload: T): void;
}

export function createBus<T>(): Bus<T> {
  const listeners = new Map<string, Set<BusHandler<T>>>();
  return {
    on(event, fn) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(fn);
      return () => {
        listeners.get(event)?.delete(fn);
      };
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          console.error(err);
        }
      });
    },
  };
}

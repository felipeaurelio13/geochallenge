import { useCallback, useRef, useState } from 'react';

type CacheEntry<TData> = {
  data: TData;
  updatedAt: number;
};

type UseApiOptions<TData> = {
  cacheKey?: string;
  ttlMs?: number;
  initialData?: TData;
};

type MutateOptions<TData> = {
  optimisticData?: TData;
  rollbackData?: TData;
};

export function useApi<TData, TArgs extends unknown[] = []>(
  fetcher: (...args: TArgs) => Promise<TData>,
  options?: UseApiOptions<TData>
) {
  const cacheRef = useRef<Map<string, CacheEntry<TData>>>(new Map());
  const [data, setData] = useState<TData | null>(options?.initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(
    async (...args: TArgs) => {
      const key = options?.cacheKey;
      const ttlMs = options?.ttlMs ?? 30_000;
      const now = Date.now();

      if (key) {
        const cached = cacheRef.current.get(key);
        if (cached && now - cached.updatedAt <= ttlMs) {
          setData(cached.data);
          return cached.data;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetcher(...args);
        setData(response);

        if (key) {
          cacheRef.current.set(key, { data: response, updatedAt: now });
        }

        return response;
      } catch (requestError: any) {
        const message = requestError?.response?.data?.error || requestError?.message || 'Unexpected API error';
        setError(message);
        throw requestError;
      } finally {
        setIsLoading(false);
      }
    },
    [fetcher, options?.cacheKey, options?.ttlMs]
  );

  const mutate = useCallback(
    async (mutation: () => Promise<TData>, mutationOptions?: MutateOptions<TData>) => {
      const previousData = data;

      if (mutationOptions?.optimisticData !== undefined) {
        setData(mutationOptions.optimisticData);
      }

      try {
        const response = await mutation();
        setData(response);
        return response;
      } catch (mutationError) {
        if (mutationOptions?.rollbackData !== undefined) {
          setData(mutationOptions.rollbackData);
        } else if (previousData !== null) {
          setData(previousData);
        }
        throw mutationError;
      }
    },
    [data]
  );

  const invalidate = useCallback(() => {
    if (options?.cacheKey) {
      cacheRef.current.delete(options.cacheKey);
    }
  }, [options?.cacheKey]);

  return {
    data,
    error,
    isLoading,
    run,
    mutate,
    setData,
    invalidate,
  };
}

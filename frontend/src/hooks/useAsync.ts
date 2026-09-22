import { useCallback, useEffect, useRef, useState } from "react";

import { getErrorMessage } from "@/services/api";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncResult<T> extends AsyncState<T> {
  reload: () => Promise<void>;
  setData: (updater: T | ((current: T | null) => T | null)) => void;
}

/**
 * Run an async loader and track its state, cancelling stale results so a slow
 * response can never overwrite a newer one.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: { immediate?: boolean } = {},
): UseAsyncResult<T> {
  const { immediate = true } = options;
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const result = await loaderRef.current();
      if (mounted.current && id === requestId.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (error) {
      if (mounted.current && id === requestId.current) {
        setState({ data: null, loading: false, error: getErrorMessage(error) });
      }
    }
  }, []);

  useEffect(() => {
    if (immediate) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater: T | ((current: T | null) => T | null)) => {
    setState((current) => ({
      ...current,
      data:
        typeof updater === "function"
          ? (updater as (value: T | null) => T | null)(current.data)
          : updater,
    }));
  }, []);

  return { ...state, reload, setData };
}

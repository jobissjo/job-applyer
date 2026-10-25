import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { formatApiError } from "@/services/http";

export function useResource<T>(
  loader: () => Promise<T>,
  key: string | number = "",
) {
  const loaderRef = useRef(loader);
  const generation = useRef(0);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const value = await loaderRef.current();
      if (id === generation.current) setData(value);
    } catch (err) {
      if (id === generation.current) setError(formatApiError(err));
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void key;
      void refresh();
      return () => {
        generation.current++;
      };
    }, [refresh, key]),
  );
  return { data, setData, loading, error, refresh };
}
export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const run = async (work: () => Promise<void>, success = "") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setMessage(success);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { busy, error, message, run };
}

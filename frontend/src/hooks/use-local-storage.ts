'use client';

import { useState, useEffect } from 'react';

/**
 * SSR-safe localStorage hook.
 * Returns null on server. Reads and writes to localStorage on client.
 *
 * @example
 * const [value, setValue] = useLocalStorage('key', defaultValue);
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // SSR safe — return initial value on server
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const valueToStore =
        storedValue instanceof Function
          ? storedValue(storedValue)
          : storedValue;
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch {
      // Storage quota exceeded or private browsing — fail silently
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

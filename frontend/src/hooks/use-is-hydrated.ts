'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true after the component has mounted on the client.
 *
 * Use this to gate any code that reads from Zustand persisted stores,
 * localStorage, or any browser API — prevents SSR hydration mismatches.
 *
 * @example
 * const isHydrated = useIsHydrated();
 * if (!isHydrated) return <Skeleton />;
 * return <Component data={store.data} />;
 */
export function useIsHydrated(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}

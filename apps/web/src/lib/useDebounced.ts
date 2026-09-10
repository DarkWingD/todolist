import { useEffect, useState } from 'react';

/**
 * The value, once it has stopped changing for `ms`.
 *
 * Search was firing a query per keystroke — typing "birthday" was eight round
 * trips for seven answers nobody read.
 */
export function useDebounced<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

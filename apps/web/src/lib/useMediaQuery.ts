import { useEffect, useState } from 'react';

/** True while the window matches `query`; tracks resizes. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(
    () => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * The width at which Lists becomes two panes. Below it, the rail (from 768px)
 * plus an index column would leave the open list too narrow to read.
 */
export const DESKTOP_QUERY = '(min-width: 1024px)';

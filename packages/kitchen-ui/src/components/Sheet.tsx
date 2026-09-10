import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCloseOnBack } from '../lib/backstack';

/**
 * The bottom sheet every panel in the app is made of.
 *
 * There were eight of these written by hand, identical in markup and all
 * missing the same things: none announced itself as a dialog, none held focus,
 * none closed on Escape, and none gave focus back to whatever opened it. A
 * keyboard tabbed straight out of the sheet into the screen behind it.
 *
 * It also handles the two things a fixed, bottom-anchored panel gets wrong on a
 * phone. iOS shrinks the visual viewport for the keyboard but leaves the layout
 * viewport alone, so a sheet anchored to the bottom ends up *behind* the
 * keyboard — and most of these open with a field focused, so that is the normal
 * case, not an edge one. And a sheet that has scrolled to its end passes the
 * rest of the gesture to the page underneath, which then scrolls away behind
 * it.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  /** Kept mounted so it can slide out; otherwise it is torn down when closed. */
  keepMounted,
  maxHeight = '82%',
  z = 30,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the dialog for assistive tech. Usually the same words as its heading. */
  title: string;
  children: ReactNode;
  keepMounted?: boolean;
  maxHeight?: string;
  z?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [keyboard, setKeyboard] = useState(0);

  // Back dismisses the sheet before it moves the app — the gesture people
  // reach for, and in an installed PWA there is nothing else it could mean.
  useCloseOnBack(open, onClose);

  // Remember who opened it, and hand focus back on the way out — otherwise
  // closing a sheet drops you at the top of the document.
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement as HTMLElement | null;
      return;
    }
    const el = opener.current;
    opener.current = null;
    if (el && document.contains(el)) el.focus?.();
  }, [open]);

  // A closed sheet that is still in the DOM must be out of the tab order and
  // out of the accessibility tree, not merely translated off-screen.
  useEffect(() => {
    const panel = panelRef.current;
    if (panel) panel.inert = !open;
  }, [open]);

  // Focus the first thing worth typing into. Deferred a frame so it lands after
  // the sheet has been painted in place.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const target = panel.querySelector<HTMLElement>('[data-autofocus]') ?? focusable(panel)[0];
      target?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Escape closes; Tab cycles within the sheet rather than escaping into the
  // screen behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable(panelRef.current);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      const inside = panelRef.current?.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // Ride above the software keyboard instead of sitting behind it.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const update = () => setKeyboard(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setKeyboard(0);
    };
  }, [open]);

  if (!open && !keepMounted) return null;

  return (
    <>
      <div
        className="fixed inset-0 transition-opacity"
        style={{
          background: 'rgba(0,0,0,.4)',
          zIndex: z,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          // Swallow the gesture rather than letting it scroll the screen behind.
          touchAction: 'none',
        }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 mx-auto max-w-md overflow-y-auto p-4"
        style={{
          zIndex: z + 10,
          background: 'var(--color-bg)',
          borderRadius: '22px 22px 0 0',
          maxHeight: `calc(${maxHeight} - ${keyboard}px)`,
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          transform: open ? `translateY(-${keyboard}px)` : 'translateY(110%)',
          transition: 'transform .28s cubic-bezier(.32,.72,0,1)',
          overscrollBehavior: 'contain',
        }}
      >
        <div
          className="mx-auto mb-3 h-1.5 w-10 rounded-full"
          style={{ background: 'var(--color-check-border)' }}
          aria-hidden="true"
        />
        {children}
      </div>
    </>
  );
}

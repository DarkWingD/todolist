import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ShoppingRow } from '../components/ShoppingRow';
import type { ShoppingAdapter, ShoppingItem } from '../adapter';

/**
 * The shopping list: a one-level outline where a meal is a heading and its
 * ingredients sit under it.
 *
 * A group's section follows its heading. A half-shopped meal stays under "To
 * buy" with the bought lines struck through, so you watch it fill up as you
 * shop, and only drops to "Bought" when you tick the meal itself.
 */
/** The usual three-node share glyph, drawn to match the app's stroke icons. */
function ShareIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

export function ShoppingList({
  adapter,
  onShare,
}: {
  adapter: ShoppingAdapter;
  /**
   * Hand the list to wherever the platform sends text. Absent where there is
   * nowhere to send it, and the control is then hidden rather than shown inert.
   */
  onShare?: (items: ShoppingItem[]) => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  // Set while a heading animates out, so its ingredients leave with it.
  const [completingHeadingId, setCompletingHeadingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shopping'],
    queryFn: () => adapter.getItems(),
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['shopping'] });
    setCompletingHeadingId(null);
  };
  // A new item keeps its place in the outline rather than jumping to the top,
  // so it can land off-screen on a long list. Flag it and let the row bring
  // itself into view.
  const add = useMutation({
    mutationFn: (t: string) => adapter.addItem(t),
    onSuccess: (id) => {
      invalidate();
      setFlashId(id);
      window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
    },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; completed: boolean }) => adapter.toggleItem(v.id, v.completed),
    onSuccess: invalidate,
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; title: string }) => adapter.renameItem(v.id, v.title),
    onSuccess: () => {
      invalidate();
      setEditId(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => adapter.removeItem(id),
    onSuccess: () => {
      invalidate();
      setEditId(null);
    },
  });
  const reparent = useMutation({
    mutationFn: (v: { id: string; parentId: string | null }) => adapter.setParent(v.id, v.parentId),
    onSuccess: invalidate,
  });
  const clearBought = useMutation({
    mutationFn: () => adapter.clearCompleted(),
    onSuccess: invalidate,
  });

  const { childrenOf, toBuy, bought } = useMemo(() => {
    const kids = new Map<string, ShoppingItem[]>();
    for (const t of items) {
      if (!t.parentId) continue;
      const list = kids.get(t.parentId) ?? [];
      list.push(t);
      kids.set(t.parentId, list);
    }
    const top = items.filter((t) => !t.parentId);
    return {
      childrenOf: kids,
      toBuy: top.filter((t) => !t.completed),
      bought: top.filter((t) => t.completed),
    };
  }, [items]);

  const addOne = (title: string) => {
    const t = title.trim();
    if (t) add.mutate(t);
  };

  function indent(id: string) {
    const i = toBuy.findIndex((t) => t.id === id);
    const above = i > 0 ? toBuy[i - 1] : undefined;
    if (above) reparent.mutate({ id, parentId: above.id });
  }

  const editItem = items.find((t) => t.id === editId);

  const renderGroup = (t: ShoppingItem) => {
    const kids = childrenOf.get(t.id) ?? [];
    const i = toBuy.findIndex((x) => x.id === t.id);
    return (
      <div key={t.id} className={kids.length > 0 ? 'mb-d3' : undefined}>
        <ShoppingRow
          id={t.id}
          title={t.title}
          flash={flashId === t.id}
          completed={t.completed}
          canIndent={!t.completed && kids.length === 0 && i > 0}
          onIndent={indent}
          onToggle={(id, completed) => toggle.mutate({ id, completed })}
          onOpen={(id) => {
            setEditId(id);
            setEditTitle(items.find((x) => x.id === id)?.title ?? '');
          }}
          onCompleteStart={kids.length > 0 ? setCompletingHeadingId : undefined}
        />
        {kids.length > 0 && (
          <div className="ml-d4 border-l border-border pl-d2">
            {kids.map((c) => (
              <ShoppingRow
                key={c.id}
                id={c.id}
                title={c.title}
                flash={flashId === c.id}
                completed={c.completed}
                canOutdent
                onOutdent={(id) => reparent.mutate({ id, parentId: null })}
                leaving={completingHeadingId === t.id && !c.completed}
                // An ingredient ticked on its own stays under its meal, struck
                // through, so you can watch the meal fill up as you shop.
                animateOut={false}
                onToggle={(id, completed) => toggle.mutate({ id, completed })}
                onOpen={(id) => {
                  setEditId(id);
                  setEditTitle(items.find((x) => x.id === id)?.title ?? '');
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Pinned, so rapid entry works: the list scrolls underneath while the box
          and the keyboard focus stay put. Without this, scrolling to a newly
          added item scrolled the box itself out of reach. */}
      <div className="sticky top-0 z-10 -mx-d4 bg-bg px-d4 pb-d2 pt-1">
        <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-3 shadow-card">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newItem.trim()) {
                addOne(newItem);
                setNewItem('');
              }
            }}
            onPaste={(e) => {
              // Pasting a block of lines adds one item per line, which is how
              // people bring a list over from a message or a recipe.
              const text = e.clipboardData.getData('text');
              if (text.includes('\n')) {
                e.preventDefault();
                text
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .forEach(addOne);
                setNewItem('');
              }
            }}
            placeholder="Add an item…"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
          />
        </div>
      </div>

      {/* Share sits on the section heading's own row rather than a line of its
          own: it's a secondary action and shouldn't cost a whole row of a list
          you read while walking around a shop. Hidden while the list is empty,
          since there is nothing to send. */}
      <div className="mb-d2 mt-d4 flex items-center justify-between">
        <h2
          className="font-bold uppercase text-muted"
          style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
        >
          To buy
        </h2>
        {onShare && items.length > 0 && (
          <button
            type="button"
            onClick={() => void onShare(items)}
            className="-my-1 flex items-center gap-1.5 py-1 pl-2 text-muted"
            style={{ fontSize: 'var(--fs-xs)' }}
          >
            <ShareIcon />
            Share list
          </button>
        )}
      </div>
      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      ) : toBuy.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Empty — add an item above.
        </p>
      ) : (
        toBuy.map(renderGroup)
      )}

      {bought.length > 0 && (
        <>
          <div className="mb-d2 mt-d4 flex items-baseline justify-between gap-d3">
            <h2
              className="font-bold uppercase text-muted"
              style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
            >
              Bought
            </h2>
            <button
              type="button"
              disabled={clearBought.isPending}
              onClick={() => clearBought.mutate()}
              className="font-semibold text-accent disabled:opacity-50"
              style={{ fontSize: 'var(--fs-xs)' }}
            >
              {clearBought.isPending ? 'Clearing…' : 'Clear bought'}
            </button>
          </div>
          {bought.map(renderGroup)}
        </>
      )}

      {editId && editItem && (
        <>
          <div
            className="fixed inset-0 z-30"
            style={{ background: 'rgba(0,0,0,.4)' }}
            onClick={() => setEditId(null)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-4"
            style={{
              background: 'var(--color-bg)',
              borderRadius: '22px 22px 0 0',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <div
              className="mx-auto mb-3 h-1.5 w-10 rounded-full"
              style={{ background: 'var(--color-check-border)' }}
            />
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                editTitle.trim() &&
                rename.mutate({ id: editId, title: editTitle.trim() })
              }
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none"
              style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
            />
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-lg py-2 font-semibold"
                style={{
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--color-danger)',
                  background: 'var(--color-danger-soft)',
                }}
                onClick={() => remove.mutate(editId)}
              >
                Delete
              </button>
              <button
                disabled={!editTitle.trim()}
                className="flex-1 rounded-lg py-2 font-bold text-accent-contrast disabled:opacity-50"
                style={{ fontSize: 'var(--fs-sm)', background: 'var(--color-accent)' }}
                onClick={() => rename.mutate({ id: editId, title: editTitle.trim() })}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

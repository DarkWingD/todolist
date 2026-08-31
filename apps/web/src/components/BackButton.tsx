interface BackButtonProps {
  label: string;
  onClick: () => void;
}

/** Clear, thumb-friendly back control: circular arrow + label. */
export function BackButton({ label, onClick }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`Back to ${label}`}
      className="-ml-1 mb-d3 flex items-center gap-2 py-1 font-semibold text-accent"
    >
      <span
        className="grid place-items-center rounded-full"
        style={{
          width: 34,
          height: 34,
          background: 'var(--color-accent-soft)',
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        ‹
      </span>
      <span style={{ fontSize: 'var(--fs-base)' }}>{label}</span>
    </button>
  );
}

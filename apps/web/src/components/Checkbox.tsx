import { motion } from 'framer-motion';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** Accessible, animated completion toggle. */
export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="grid flex-none place-items-center"
      style={{
        width: 22,
        height: 22,
        marginTop: 1,
        borderRadius: 'var(--radius-check)',
        background: checked ? 'var(--color-accent)' : 'transparent',
        boxShadow: checked ? 'none' : 'inset 0 0 0 2px var(--color-check-border)',
        transition: 'background 0.15s ease',
      }}
    >
      {checked && (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          style={{ color: 'var(--color-accent-contrast)', fontSize: 13, fontWeight: 700 }}
        >
          ✓
        </motion.span>
      )}
    </button>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Reusable refresh button. Spins the icon for 600ms while the onRefresh callback runs.
 * Usage: <RefreshButton onRefresh={fetchData} />
 */
export default function RefreshButton({ onRefresh, label = 'Refresh', style = {} }) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = async () => {
    if (spinning) return;
    setSpinning(true);
    try { await onRefresh(); } finally {
      setTimeout(() => setSpinning(false), 600);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={spinning}
      title="Refresh"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px',
        background: 'var(--bg-2)',
        border: '1px solid var(--bg-4)',
        borderRadius: 10,
        fontSize: 13, fontWeight: 600,
        color: 'var(--label-3)',
        cursor: spinning ? 'default' : 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        ...style,
      }}
      onMouseEnter={e => { if (!spinning) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-4)'; e.currentTarget.style.color = 'var(--label-3)'; }}
    >
      <motion.span
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={spinning ? { duration: 0.6, ease: 'linear', repeat: Infinity } : {}}
        style={{ display: 'inline-block', fontSize: 15, lineHeight: 1 }}
      >
        ↺
      </motion.span>
      {label}
    </button>
  );
}

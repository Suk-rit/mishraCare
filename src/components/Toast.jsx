import { motion, AnimatePresence } from 'framer-motion';

export default function Toast({ message, type = 'info', visible }) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`toast ${type}`}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <span>{icons[type]}</span>
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export default function SubjectSummary({ name, description }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  if (!description) return name;

  return (
    <span
      className="subject-summary"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span>{name}</span>
      <button
        type="button"
        className="summary-trigger"
        aria-label={`Ver resumo de ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      <AnimatePresence>
        {open && <motion.span
          className="summary-tooltip"
          role="tooltip"
          initial={reduceMotion ? false : { opacity: 0, y: 5, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 3, scale: 0.98 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {description}
        </motion.span>}
      </AnimatePresence>
    </span>
  );
}

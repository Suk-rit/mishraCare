import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function OTPInput({ length = 4, onComplete, hasError, onReset }) {
  const [values, setValues] = useState(Array(length).fill(''));
  const [shaking, setShaking] = useState(false);
  const inputs = useRef([]);

  // Shake on error
  useEffect(() => {
    if (hasError) {
      setShaking(true);
      const t = setTimeout(() => {
        setShaking(false);
        setValues(Array(length).fill(''));
        inputs.current[0]?.focus();
        if (onReset) onReset();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [hasError]);

  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1); // digits only
    const next = [...values];
    next[idx] = val;
    setValues(next);

    if (val && idx < length - 1) {
      inputs.current[idx + 1]?.focus();
    }

    if (next.every(v => v !== '')) {
      onComplete(next.join(''));
    }
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !values[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    const next = Array(length).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setValues(next);
    inputs.current[Math.min(pasted.length, length - 1)]?.focus();
    if (pasted.length === length) onComplete(pasted);
  };

  return (
    <div className="otp-boxes" onPaste={handlePaste}>
      {values.map((val, idx) => (
        <motion.input
          key={idx}
          ref={el => inputs.current[idx] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          className={`otp-box${val ? ' filled' : ''}${shaking ? ' error-shake' : ''}`}
          onChange={e => handleChange(e, idx)}
          onKeyDown={e => handleKeyDown(e, idx)}
          autoFocus={idx === 0}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.07, duration: 0.3 }}
        />
      ))}
    </div>
  );
}

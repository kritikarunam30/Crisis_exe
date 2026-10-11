import { useEffect } from 'react';
import toast from 'react-hot-toast';
import fakeWarnings from '../../logic/fakeWarnings';

// Ambient warnings only fire while `active` (during a mission, not on the
// landing page or leaderboard).
export default function FakeWarningToast({ active = true }) {
  useEffect(() => {
    if (!active) return;

    let timeoutId;
    const toastIds = [];

    const fireToast = () => {
      const randomIndex = Math.floor(Math.random() * fakeWarnings.length);
      const message = fakeWarnings[randomIndex];

      const id = toast(message, {
        duration: 4500,
        style: {
          background: 'rgba(5, 15, 29, 0.96)',
          color: '#b8e1fc',
          border: '1px solid rgba(255, 42, 85, 0.5)',
          borderLeft: '4px solid #ff2a55',
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: '12px',
          letterSpacing: '0.05em',
          boxShadow: '0 0 15px rgba(255, 42, 85, 0.25), inset 0 0 10px rgba(0, 240, 255, 0.05)',
          borderRadius: '2px',
          padding: '10px 14px',
        },
        icon: '⚠️',
      });
      toastIds.push(id);

      // Schedule next toast between 25s and 45s
      const nextDelay = Math.floor(Math.random() * 20000) + 25000;
      timeoutId = setTimeout(fireToast, nextDelay);
    };

    // Initial scheduling
    const initialDelay = Math.floor(Math.random() * 20000) + 25000;
    timeoutId = setTimeout(fireToast, initialDelay);

    return () => {
      clearTimeout(timeoutId);
      toastIds.forEach((id) => toast.dismiss(id));
    };
  }, [active]);

  return null; // Has no visible output itself
}

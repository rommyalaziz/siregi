import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export const useIdleTimer = () => {
  const navigate = useNavigate();
  const timeoutRef = useRef<number | null>(null);

  const handleLogout = useCallback(() => {
    // Clear session
    sessionStorage.removeItem('msa_session');
    localStorage.removeItem('msa_session'); // Just in case any old data exists
    
    // Redirect to login
    navigate('/login', { replace: true });
  }, [navigate]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Only set timer if user is logged in
    const session = sessionStorage.getItem('msa_session');
    if (session) {
      timeoutRef.current = window.setTimeout(handleLogout, IDLE_TIMEOUT);
    }
  }, [handleLogout]);

  useEffect(() => {
    // Events to monitor for activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Initial timer setup
    resetTimer();

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer]);

  return null;
};

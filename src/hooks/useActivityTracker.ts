import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes

/**
 * Hook untuk tracking aktivitas user.
 * - Mengirim HEARTBEAT setiap 2 menit saat user aktif (untuk deteksi online/offline)
 * - Tidak mengganggu useIdleTimer yang sudah ada
 */
export const useActivityTracker = () => {
  const intervalRef = useRef<number | null>(null);

  const getSessionUser = useCallback(() => {
    const session = sessionStorage.getItem('msa_session');
    if (!session) return null;
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    const user = getSessionUser();
    if (!user?.id) return;

    try {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        activity_type: 'HEARTBEAT',
        user_agent: navigator.userAgent
      });
    } catch (err) {
      // Silent fail — heartbeat should never block the app
      console.warn('Heartbeat failed:', err);
    }
  }, [getSessionUser]);

  useEffect(() => {
    const user = getSessionUser();
    if (!user?.id) return;

    // Send initial heartbeat on mount
    sendHeartbeat();

    // Set up recurring heartbeat
    intervalRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [getSessionUser, sendHeartbeat]);

  return null;
};

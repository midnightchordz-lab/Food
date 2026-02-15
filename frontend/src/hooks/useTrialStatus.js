/**
 * useTrialStatus Hook
 * Cross-platform compatible (Web, iOS, Android)
 * 
 * Provides reactive trial status and premium access state
 */

import { useState, useEffect, useCallback } from 'react';
import trialService from '@/services/trialService';

export function useTrialStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trialService.getTrialStatus();
      if (data.success) {
        setStatus(data.trial);
      } else {
        setError(data.error || 'Failed to load trial status');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startTrial = useCallback(async () => {
    try {
      const platform = trialService.getPlatform();
      const result = await trialService.startTrial(platform);
      await refresh();
      return result;
    } catch (err) {
      throw err;
    }
  }, [refresh]);

  return {
    status,
    loading,
    error,
    refresh,
    startTrial,
    // Convenience getters
    hasAccess: status?.hasAccess || false,
    canStartTrial: status?.canStartTrial || false,
    isTrialActive: status?.isActive || false,
    isPaid: status?.isPaid || false,
    trialExpired: status?.trialExpired || false,
    daysRemaining: status?.daysRemaining || 0,
    plan: status?.plan || 'free'
  };
}

export default useTrialStatus;

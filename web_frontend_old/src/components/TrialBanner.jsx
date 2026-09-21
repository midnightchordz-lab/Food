/**
 * TrialBanner Component
 * Cross-platform compatible (Web, iOS, Android)
 * 
 * Shows contextual trial/subscription banners:
 * - "Start Free Trial" for eligible users
 * - "Trial Active (X days remaining)" for active trials
 * - "Trial Expired - Upgrade" for expired trials
 * - Hidden for paid users
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Sparkles, Clock, Crown, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import trialService from '@/services/trialService';

export default function TrialBanner({ onUpgradeClick }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await trialService.getTrialStatus();
      if (data.success) {
        setStatus(data.trial);
      }
    } catch (error) {
      console.error('[TrialBanner] Error loading status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleStartTrial = async () => {
    setStarting(true);
    try {
      const platform = trialService.getPlatform();
      await trialService.startTrial(platform);
      toast.success('7-day trial started! Enjoy premium features.');
      loadStatus();
    } catch (error) {
      toast.error(error.message || 'Failed to start trial');
    } finally {
      setStarting(false);
    }
  };

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Default: navigate to subscription page
      window.location.href = '/subscription';
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Don't show while loading
  if (loading) return null;
  
  // Don't show if dismissed
  if (dismissed) return null;
  
  // Don't show if no status
  if (!status) return null;
  
  // Don't show for paid users
  if (status.isPaid) return null;

  // Can start trial
  if (status.canStartTrial) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="relative bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white rounded-xl p-4 mx-4 my-2 shadow-lg"
          data-testid="trial-banner-start"
        >
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-white/20 rounded-full">
              <Gift className="w-6 h-6" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg">Try Premium Free for 7 Days!</h3>
              <p className="text-sm text-white/90 mt-0.5">
                Voice Cooking, AI Chef, unlimited recipes and more.
              </p>
            </div>
            
            <Button
              onClick={handleStartTrial}
              disabled={starting}
              className="flex-shrink-0 bg-white text-purple-700 hover:bg-white/90 font-semibold"
              data-testid="start-trial-btn"
            >
              {starting ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </motion.div>
                  Starting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Start Free Trial
                </span>
              )}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Trial active
  if (status.isActive) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="relative bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl p-4 mx-4 my-2 shadow-lg"
          data-testid="trial-banner-active"
        >
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-white/20 rounded-full">
              <Clock className="w-6 h-6" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg">Premium Trial Active</h3>
              <p className="text-sm text-white/90 mt-0.5">
                {status.daysRemaining} day{status.daysRemaining !== 1 ? 's' : ''} remaining
              </p>
            </div>
            
            <Button
              onClick={handleUpgrade}
              className="flex-shrink-0 bg-white text-emerald-700 hover:bg-white/90 font-semibold"
              data-testid="upgrade-from-trial-btn"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Trial expired
  if (status.trialExpired) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="relative bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl p-4 mx-4 my-2 shadow-lg"
          data-testid="trial-banner-expired"
        >
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-white/20 rounded-full">
              <Crown className="w-6 h-6" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg">Trial Expired</h3>
              <p className="text-sm text-white/90 mt-0.5">
                Upgrade to keep using premium features
              </p>
            </div>
            
            <Button
              onClick={handleUpgrade}
              className="flex-shrink-0 bg-white text-amber-700 hover:bg-white/90 font-semibold"
              data-testid="upgrade-after-trial-btn"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}

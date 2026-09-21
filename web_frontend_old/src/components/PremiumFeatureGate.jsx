/**
 * PremiumFeatureGate Component
 * Cross-platform compatible (Web, iOS, Android)
 * 
 * Wraps premium features and handles access control
 * Shows trial prompts or upgrade CTAs when needed
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Sparkles, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTrialStatus } from '@/hooks/useTrialStatus';

/**
 * PremiumFeatureGate - Wrap premium content with access control
 * 
 * @param {ReactNode} children - Premium content to show when access granted
 * @param {ReactNode} fallback - Optional content to show when no access
 * @param {string} featureName - Name of the feature (for messaging)
 * @param {Function} onUpgradeClick - Custom upgrade handler
 */
export default function PremiumFeatureGate({ 
  children, 
  fallback,
  featureName = 'this feature',
  onUpgradeClick 
}) {
  const { 
    hasAccess, 
    canStartTrial, 
    startTrial, 
    loading,
    refresh 
  } = useTrialStatus();
  
  const [starting, setStarting] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleStartTrial = async () => {
    setStarting(true);
    try {
      await startTrial();
      toast.success('7-day trial started! Enjoy premium features.');
      setShowPrompt(false);
    } catch (err) {
      toast.error(err.message || 'Failed to start trial');
    } finally {
      setStarting(false);
    }
  };

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      window.location.href = '/subscription';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-6 h-6 text-purple-500" />
        </motion.div>
      </div>
    );
  }

  // Has access - show content
  if (hasAccess) {
    return <>{children}</>;
  }

  // No access - show gate
  return (
    <>
      {/* Fallback content or locked state */}
      {fallback || (
        <div 
          className="relative p-8 rounded-xl border-2 border-dashed border-purple-300/50 bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-900/20 dark:to-indigo-900/20"
          data-testid="premium-gate"
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-purple-100 dark:bg-purple-900/40 rounded-full">
              <Lock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Premium Feature
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {featureName} requires premium access
              </p>
            </div>
            
            {canStartTrial ? (
              <Button
                onClick={() => setShowPrompt(true)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                data-testid="try-premium-btn"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Try Free for 7 Days
              </Button>
            ) : (
              <Button
                onClick={handleUpgrade}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                data-testid="upgrade-premium-btn"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Trial Start Modal */}
      <AnimatePresence>
        {showPrompt && canStartTrial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
              data-testid="trial-prompt-modal"
            >
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Start Your Free Trial
                </h2>
                
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Get 7 days of unlimited access to all premium features including {featureName}.
                </p>
                
                <ul className="text-left text-sm space-y-2 mb-6">
                  {['Voice Cooking Mode', 'AI Chef Assistant', 'Unlimited Recipes', 'Priority Support'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPrompt(false)}
                  >
                    Not Now
                  </Button>
                  <Button
                    onClick={handleStartTrial}
                    disabled={starting}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                    data-testid="confirm-start-trial-btn"
                  >
                    {starting ? 'Starting...' : 'Start Free Trial'}
                  </Button>
                </div>
                
                <p className="text-xs text-gray-500 mt-4">
                  No credit card required. Cancel anytime.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

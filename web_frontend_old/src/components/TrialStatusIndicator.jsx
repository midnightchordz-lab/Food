/**
 * Trial Status Indicator - Shows trial days remaining in header
 * Displays for users with active trial, with upgrade CTA
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Clock, Crown } from 'lucide-react';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useAuth } from '@/context/AuthContext';
import './TrialStatusIndicator.css';

function TrialStatusIndicator({ variant = 'default' }) {
  const { isAuthenticated } = useAuth();
  const { isTrialActive, daysRemaining, isPaid, loading } = useTrialStatus();
  
  // Don't show if not authenticated, loading, or user is paid
  if (!isAuthenticated || loading || isPaid) {
    return null;
  }
  
  // Show paid badge for paid users (if we want to show something)
  if (isPaid) {
    return (
      <div className="trial-indicator trial-indicator-pro" data-testid="pro-badge">
        <Crown size={14} />
        <span>Pro</span>
      </div>
    );
  }
  
  // Show trial indicator if trial is active
  if (isTrialActive && daysRemaining > 0) {
    const isUrgent = daysRemaining <= 2;
    const indicatorClass = isUrgent ? 'trial-indicator-urgent' : 'trial-indicator-active';
    
    return (
      <Link 
        to="/pricing" 
        className={`trial-indicator ${indicatorClass} ${variant === 'compact' ? 'trial-indicator-compact' : ''}`}
        data-testid="trial-status-indicator"
        title={`${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left in your premium trial`}
      >
        {isUrgent ? <Clock size={14} /> : <Sparkles size={14} />}
        <span className="trial-indicator-text">
          {variant === 'compact' 
            ? `${daysRemaining}d` 
            : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`
          }
        </span>
        {variant !== 'compact' && (
          <span className="trial-indicator-cta">Upgrade</span>
        )}
      </Link>
    );
  }
  
  // No trial active - don't show anything (or show "Start Trial" if needed)
  return null;
}

export default TrialStatusIndicator;

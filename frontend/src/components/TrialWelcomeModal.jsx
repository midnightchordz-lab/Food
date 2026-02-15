/**
 * Trial Welcome Modal - Shows when new users register and get auto-started trial
 * Displays trial benefits and premium features available
 */
import React from 'react';
import { X, Mic, ChefHat, Sparkles, Smartphone } from 'lucide-react';
import './TrialWelcomeModal.css';

function TrialWelcomeModal({ show, onClose, daysRemaining = 7, endsAt }) {
  if (!show) return null;

  // Format end date if provided
  const formatEndDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div 
      className="trial-welcome-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid="trial-welcome-modal"
    >
      <div className="trial-welcome-modal">
        {/* Close button */}
        <button 
          className="trial-welcome-close"
          onClick={onClose}
          aria-label="Close"
          data-testid="trial-welcome-close"
        >
          <X size={20} />
        </button>

        {/* Welcome header */}
        <div className="trial-welcome-header">
          <div className="trial-welcome-icon">
            <Sparkles size={32} />
          </div>
          <h2>Welcome to MOOD FOOD!</h2>
          <p className="trial-welcome-subtitle">
            Your <strong>{daysRemaining}-day premium trial</strong> has started!
          </p>
        </div>

        {/* Features list */}
        <div className="trial-features">
          <h3>What's Included:</h3>
          <ul>
            <li>
              <Mic className="feature-icon" size={20} />
              <span>Voice Cooking Mode - Hands-free recipe guidance</span>
            </li>
            <li>
              <ChefHat className="feature-icon" size={20} />
              <span>AI Chef Assistant - Personal cooking companion</span>
            </li>
            <li>
              <Sparkles className="feature-icon" size={20} />
              <span>Unlimited Recipe Generation - Create any recipe</span>
            </li>
            <li>
              <Smartphone className="feature-icon" size={20} />
              <span>Full Mobile Access - Cook anywhere</span>
            </li>
          </ul>
        </div>

        {/* Trial info */}
        <div className="trial-info">
          {endsAt && (
            <p className="trial-end-date">
              Trial ends: <strong>{formatEndDate(endsAt)}</strong>
            </p>
          )}
          <p className="trial-note">
            No credit card required. Cancel anytime.
          </p>
        </div>

        {/* CTA button */}
        <button 
          className="trial-start-cooking-btn"
          onClick={onClose}
          data-testid="trial-start-cooking-btn"
        >
          Start Cooking!
        </button>
      </div>
    </div>
  );
}

export default TrialWelcomeModal;

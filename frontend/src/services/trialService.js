/**
 * Trial Service - Web
 * Cross-platform compatible (Web, iOS, Android via Capacitor)
 * 
 * Handles all trial-related API calls
 */

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

class TrialService {
  /**
   * Get current trial status
   * @returns {Promise<Object>} Trial status data
   */
  async getTrialStatus() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      return {
        success: false,
        error: 'Not authenticated',
        trial: { hasAccess: false, canStartTrial: false }
      };
    }

    try {
      const response = await fetch(`${API_URL}/api/trial/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get trial status');
      }

      return await response.json();
    } catch (error) {
      console.error('[TrialService] getTrialStatus error:', error);
      return {
        success: false,
        error: error.message,
        trial: { hasAccess: false, canStartTrial: false }
      };
    }
  }

  /**
   * Start 7-day trial
   * @param {string} platform - 'web', 'ios', or 'android'
   * @returns {Promise<Object>} Trial start result
   */
  async startTrial(platform = 'web') {
    const token = localStorage.getItem('token');

    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${API_URL}/api/trial/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ platform })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail?.error || data.detail || 'Failed to start trial');
      }

      return data;
    } catch (error) {
      console.error('[TrialService] startTrial error:', error);
      throw error;
    }
  }

  /**
   * Check if user has premium access
   * @returns {Promise<Object>} Access check result
   */
  async checkAccess() {
    const token = localStorage.getItem('token');

    if (!token) {
      return {
        success: false,
        hasAccess: false,
        status: { canStartTrial: false }
      };
    }

    try {
      const response = await fetch(`${API_URL}/api/trial/check-access`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          hasAccess: false,
          status: error.detail?.premium || { canStartTrial: false }
        };
      }

      return await response.json();
    } catch (error) {
      console.error('[TrialService] checkAccess error:', error);
      return {
        success: false,
        hasAccess: false,
        status: { canStartTrial: false }
      };
    }
  }

  /**
   * Get platform identifier (for Capacitor apps)
   * @returns {string} Platform name
   */
  getPlatform() {
    // Check if running in Capacitor
    if (window.Capacitor) {
      const platform = window.Capacitor.getPlatform();
      if (platform === 'ios') return 'ios';
      if (platform === 'android') return 'android';
    }
    return 'web';
  }

  /**
   * Handle premium feature access
   * Returns true if user can access, false otherwise
   * Shows appropriate UI for trial/upgrade
   * 
   * @param {Function} onTrialStart - Callback when user starts trial
   * @param {Function} onUpgradeNeeded - Callback when upgrade is needed
   * @returns {Promise<boolean>} Whether user has access
   */
  async handlePremiumAccess(onTrialStart, onUpgradeNeeded) {
    const result = await this.checkAccess();
    
    if (result.hasAccess) {
      return true;
    }

    const status = result.status || {};
    
    if (status.canStartTrial) {
      // User can start trial - show trial prompt
      if (onTrialStart) {
        onTrialStart();
      }
    } else {
      // User needs to upgrade
      if (onUpgradeNeeded) {
        onUpgradeNeeded();
      }
    }
    
    return false;
  }
}

// Export singleton instance
const trialService = new TrialService();
export default trialService;

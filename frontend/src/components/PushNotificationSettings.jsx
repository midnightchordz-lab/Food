import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, Vote, Trophy, Loader2, BellRing } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { isPushAvailable, getNotificationPermission } from '@/services/pushNotificationService';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Push Notification Settings Component — Phase 1
 * Manage push notification preferences for Family Plan users
 */
const PushNotificationSettings = ({ isFamilyPlan = false }) => {
  const { token } = useAuth();
  const [settings, setSettings] = useState({
    enabled: true,
    voting_notifications: true,
    winner_announcements: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasFcmToken, setHasFcmToken] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('default');

  useEffect(() => {
    const fetchSettings = async () => {
      if (!token) return;
      
      try {
        // Get push preferences from backend
        const response = await fetch(`${API_URL}/api/auth/push-preferences`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setSettings(data.preferences || settings);
          setHasFcmToken(data.has_fcm_token || false);
        }

        // Check browser notification permission
        const permission = await getNotificationPermission();
        setPermissionStatus(permission);
      } catch (error) {
        console.error('Failed to fetch push settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [token]);

  const handleToggle = async (setting) => {
    const newSettings = {
      ...settings,
      [setting]: !settings[setting]
    };
    
    setSettings(newSettings);
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/push-preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        toast.success('Settings saved');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Revert on error
      setSettings(settings);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        toast.success('Notifications enabled! You may need to log in again to activate.');
      } else {
        toast.error('Notification permission denied');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  // Show upgrade prompt for non-family plan users
  if (!isFamilyPlan) {
    return (
      <div className="bg-card rounded-2xl border border-border/40 p-6" data-testid="push-settings-disabled">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Bell size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold">Push Notifications</h3>
        </div>
        <p className="text-muted-foreground mb-4">
          Get notified when family members vote or a winner is announced with Family Plan.
        </p>
        <Button
          onClick={() => window.location.href = '/pricing'}
          className="rounded-full"
          data-testid="upgrade-to-family-btn"
        >
          Upgrade to Family Plan
        </Button>
      </div>
    );
  }

  const pushAvailable = isPushAvailable();

  return (
    <div className="bg-card rounded-2xl border border-border/40 p-6" data-testid="push-notification-settings">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Bell size={20} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold">Push Notifications</h3>
      </div>

      {/* Permission warning */}
      {pushAvailable && permissionStatus !== 'granted' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BellRing size={18} className="text-amber-600" />
            <span className="font-medium text-amber-800 dark:text-amber-200">
              Enable notifications
            </span>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
            Allow notifications to receive voting alerts and winner announcements.
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={requestPermission}
            className="rounded-full"
            data-testid="enable-notifications-btn"
          >
            <Bell size={16} className="mr-2" />
            Enable Notifications
          </Button>
        </div>
      )}

      {/* Not supported warning */}
      {!pushAvailable && (
        <div className="bg-muted rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Push notifications are not supported in this browser. Try using Chrome, Firefox, or our mobile app.
          </p>
        </div>
      )}

      {/* Settings toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-muted-foreground" />
            <Label htmlFor="push-enabled" className="cursor-pointer">
              Enable Push Notifications
            </Label>
          </div>
          <Switch
            id="push-enabled"
            checked={settings.enabled}
            onCheckedChange={() => handleToggle('enabled')}
            disabled={saving || !pushAvailable}
            data-testid="push-enabled-toggle"
          />
        </div>

        <div className={`flex items-center justify-between p-3 rounded-xl bg-muted/50 ${!settings.enabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3">
            <Vote size={18} className="text-muted-foreground" />
            <Label htmlFor="voting-notifications" className="cursor-pointer">
              Voting Session Alerts
            </Label>
          </div>
          <Switch
            id="voting-notifications"
            checked={settings.voting_notifications}
            onCheckedChange={() => handleToggle('voting_notifications')}
            disabled={!settings.enabled || saving || !pushAvailable}
            data-testid="voting-notifications-toggle"
          />
        </div>

        <div className={`flex items-center justify-between p-3 rounded-xl bg-muted/50 ${!settings.enabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3">
            <Trophy size={18} className="text-muted-foreground" />
            <Label htmlFor="winner-announcements" className="cursor-pointer">
              Winner Announcements
            </Label>
          </div>
          <Switch
            id="winner-announcements"
            checked={settings.winner_announcements}
            onCheckedChange={() => handleToggle('winner_announcements')}
            disabled={!settings.enabled || saving || !pushAvailable}
            data-testid="winner-announcements-toggle"
          />
        </div>
      </div>

      {/* Status indicator */}
      {hasFcmToken && permissionStatus === 'granted' && (
        <p className="text-sm text-green-600 mt-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Notifications active
        </p>
      )}

      {saving && (
        <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Saving...
        </p>
      )}
    </div>
  );
};

export default PushNotificationSettings;

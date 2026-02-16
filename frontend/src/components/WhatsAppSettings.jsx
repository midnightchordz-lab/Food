import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MessageCircle, Bell, Trophy, UserPlus, Phone, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * WhatsApp Settings Component
 * Manage WhatsApp notification preferences for Family Plan users
 */
const WhatsAppSettings = ({ onPhoneAdd, isFamilyPlan = false }) => {
  const { user, token } = useAuth();
  const [settings, setSettings] = useState({
    enabled: true,
    voting_reminders: true,
    winner_announcements: true,
    family_invites: true
  });
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!token) return;
      
      try {
        const response = await fetch(`${API_URL}/api/family/whatsapp/settings`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings || settings);
          setPhoneNumber(data.phone_number);
        }
      } catch (error) {
        console.error('Failed to fetch WhatsApp settings:', error);
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
      await fetch(`${API_URL}/api/family/whatsapp/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettings)
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
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
      <div className="bg-card rounded-2xl border border-border/40 p-6" data-testid="whatsapp-settings-disabled">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <MessageCircle size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold">WhatsApp Notifications</h3>
        </div>
        <p className="text-muted-foreground mb-4">
          Get voting reminders and winner announcements directly on WhatsApp with Family Plan.
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

  return (
    <div className="bg-card rounded-2xl border border-border/40 p-6" data-testid="whatsapp-settings">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <MessageCircle size={20} className="text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold">WhatsApp Notifications</h3>
      </div>

      {/* Phone number warning */}
      {!phoneNumber && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Phone size={18} className="text-orange-600" />
            <span className="font-medium text-orange-800 dark:text-orange-200">
              Add your phone number
            </span>
          </div>
          <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
            Add your phone number in profile settings to receive WhatsApp notifications.
          </p>
          {onPhoneAdd && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onPhoneAdd}
              className="rounded-full"
              data-testid="add-phone-btn"
            >
              Add Phone Number
            </Button>
          )}
        </div>
      )}

      {/* Settings toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-muted-foreground" />
            <Label htmlFor="whatsapp-enabled" className="cursor-pointer">
              Enable WhatsApp Notifications
            </Label>
          </div>
          <Switch
            id="whatsapp-enabled"
            checked={settings.enabled}
            onCheckedChange={() => handleToggle('enabled')}
            disabled={saving}
            data-testid="whatsapp-enabled-toggle"
          />
        </div>

        <div className={`flex items-center justify-between p-3 rounded-xl bg-muted/50 ${!settings.enabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-muted-foreground" />
            <Label htmlFor="voting-reminders" className="cursor-pointer">
              Voting Reminders
            </Label>
          </div>
          <Switch
            id="voting-reminders"
            checked={settings.voting_reminders}
            onCheckedChange={() => handleToggle('voting_reminders')}
            disabled={!settings.enabled || saving}
            data-testid="voting-reminders-toggle"
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
            disabled={!settings.enabled || saving}
            data-testid="winner-announcements-toggle"
          />
        </div>

        <div className={`flex items-center justify-between p-3 rounded-xl bg-muted/50 ${!settings.enabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3">
            <UserPlus size={18} className="text-muted-foreground" />
            <Label htmlFor="family-invites" className="cursor-pointer">
              Family Invites
            </Label>
          </div>
          <Switch
            id="family-invites"
            checked={settings.family_invites}
            onCheckedChange={() => handleToggle('family_invites')}
            disabled={!settings.enabled || saving}
            data-testid="family-invites-toggle"
          />
        </div>
      </div>

      {saving && (
        <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Saving...
        </p>
      )}
    </div>
  );
};

export default WhatsAppSettings;

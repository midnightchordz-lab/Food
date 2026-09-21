import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Plus, X, Send, Loader2, Copy, Check, Share2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Invite Family Members Component — Phase 1
 * Share invite via SMS or copy link
 * WhatsApp is DORMANT - using SMS fallback
 */
const InviteFamilyMembers = ({ inviteCode, familyName }) => {
  const { token } = useAuth();
  const [phoneNumbers, setPhoneNumbers] = useState(['']);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const addPhoneField = () => {
    if (phoneNumbers.length < 5) {
      setPhoneNumbers([...phoneNumbers, '']);
    }
  };

  const removePhoneField = (index) => {
    if (phoneNumbers.length > 1) {
      const newPhones = phoneNumbers.filter((_, i) => i !== index);
      setPhoneNumbers(newPhones);
    }
  };

  const updatePhone = (index, value) => {
    const cleaned = value.replace(/[^\d+]/g, '');
    const newPhones = [...phoneNumbers];
    newPhones[index] = cleaned;
    setPhoneNumbers(newPhones);
  };

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareInvite = async () => {
    const shareText = `Join ${familyName} on MoodFood! Use invite code: ${inviteCode}`;
    const shareUrl = `${window.location.origin}/family?join=${inviteCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${familyName} on MoodFood`,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Invite link copied!');
    }
  };

  const sendSMSInvites = async () => {
    const validPhones = phoneNumbers.filter(p => p.trim().length >= 10);
    
    if (validPhones.length === 0) {
      toast.error('Please enter at least one valid phone number with country code');
      return;
    }

    setSending(true);
    setResults(null);

    try {
      const response = await fetch(`${API_URL}/api/family/send-sms-invites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone_numbers: validPhones
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        const successCount = data.results.filter(r => r.success).length;
        if (successCount > 0) {
          toast.success(`Sent ${successCount} SMS invite(s)!`);
        }
        // Clear successful numbers
        const failedPhones = data.results
          .filter(r => !r.success)
          .map((_, i) => validPhones[i] || '');
        setPhoneNumbers(failedPhones.length > 0 ? failedPhones : ['']);
      } else {
        toast.error(data.detail || 'Failed to send invites');
      }
    } catch (error) {
      console.error('Error sending invites:', error);
      toast.error('Failed to send invites. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border/40 p-6" data-testid="invite-family-members">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Invite Family Members</h3>
          <p className="text-sm text-muted-foreground">
            Share invite code or send SMS
          </p>
        </div>
      </div>

      {/* Share button - most prominent */}
      <Button
        onClick={shareInvite}
        className="w-full rounded-full mb-4"
        data-testid="share-invite-btn"
      >
        <Share2 size={18} className="mr-2" />
        Share Invite Link
      </Button>

      {/* Invite code display */}
      <div className="bg-muted/50 rounded-xl p-4 mb-6">
        <p className="text-sm text-muted-foreground mb-2 text-center">
          Invite Code
        </p>
        <div className="flex items-center justify-center gap-2">
          <code className="px-6 py-3 bg-background rounded-xl font-mono text-2xl tracking-widest font-bold">
            {inviteCode}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={copyInviteCode}
            className="rounded-full"
            data-testid="copy-invite-code-btn"
          >
            {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
          </Button>
        </div>
      </div>

      {/* SMS invite section */}
      <div className="border-t border-border/40 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={16} className="text-muted-foreground" />
          <p className="text-sm font-medium">Send SMS Invites</p>
        </div>
        
        <div className="space-y-3 mb-4">
          {phoneNumbers.map((phone, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => updatePhone(index, e.target.value)}
                placeholder="+1 234 567 8900"
                className="rounded-xl flex-1"
                data-testid={`phone-input-${index}`}
              />
              {phoneNumbers.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePhoneField(index)}
                  className="rounded-full h-10 w-10 text-muted-foreground hover:text-destructive"
                >
                  <X size={18} />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {phoneNumbers.length < 5 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addPhoneField}
              className="rounded-full"
              data-testid="add-phone-btn"
            >
              <Plus size={16} className="mr-1" />
              Add
            </Button>
          )}
          
          <Button
            onClick={sendSMSInvites}
            disabled={sending}
            variant="secondary"
            className="rounded-full flex-1"
            data-testid="send-sms-btn"
          >
            {sending ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={18} className="mr-2" />
                Send SMS
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {results && (
          <div className="mt-4 p-3 rounded-xl bg-muted/50">
            <p className="text-sm font-medium mb-2">
              {results.filter(r => r.success).length}/{results.length} invites sent
            </p>
            {results.map((result, index) => (
              <div key={index} className={`text-sm ${result.success ? 'text-green-600' : 'text-red-500'}`}>
                {result.success ? '✓' : '✗'} ...{result.phone}
                {result.error && <span className="text-xs ml-1">({result.error})</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteFamilyMembers;

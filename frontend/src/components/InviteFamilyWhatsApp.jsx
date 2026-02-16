import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Plus, X, Send, Loader2, Copy, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Invite Family via WhatsApp Component
 * Send WhatsApp invites to family members
 */
const InviteFamilyWhatsApp = ({ inviteCode, familyName }) => {
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
    // Clean the input - only allow digits and +
    const cleaned = value.replace(/[^\d+]/g, '');
    const newPhones = [...phoneNumbers];
    newPhones[index] = cleaned;
    setPhoneNumbers(newPhones);
  };

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const sendInvites = async () => {
    const validPhones = phoneNumbers.filter(p => p.trim().length >= 10);
    
    if (validPhones.length === 0) {
      alert('Please enter at least one valid phone number with country code');
      return;
    }

    setSending(true);
    setResults(null);

    try {
      const response = await fetch(`${API_URL}/api/family/send-invites`, {
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
        // Clear successful numbers
        const failedPhones = data.results
          .filter(r => !r.success)
          .map((_, i) => validPhones[i] || '');
        setPhoneNumbers(failedPhones.length > 0 ? failedPhones : ['']);
      } else {
        alert(data.detail || 'Failed to send invites');
      }
    } catch (error) {
      console.error('Error sending invites:', error);
      alert('Failed to send invites. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border/40 p-6" data-testid="invite-family-whatsapp">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <MessageCircle size={20} className="text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Invite Family via WhatsApp</h3>
          <p className="text-sm text-muted-foreground">
            Send invite links to family members
          </p>
        </div>
      </div>

      {/* Phone number inputs */}
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

      {/* Add more button */}
      {phoneNumbers.length < 5 && (
        <Button
          variant="outline"
          size="sm"
          onClick={addPhoneField}
          className="rounded-full mb-4"
          data-testid="add-phone-btn"
        >
          <Plus size={16} className="mr-1" />
          Add Another Number
        </Button>
      )}

      {/* Send button */}
      <Button
        onClick={sendInvites}
        disabled={sending}
        className="w-full rounded-full bg-green-600 hover:bg-green-700"
        data-testid="send-invites-btn"
      >
        {sending ? (
          <>
            <Loader2 size={18} className="mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send size={18} className="mr-2" />
            Send WhatsApp Invites
          </>
        )}
      </Button>

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

      {/* Manual invite code */}
      <div className="mt-6 pt-4 border-t border-border/40">
        <p className="text-sm text-muted-foreground mb-2">
          Or share the invite code manually:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-4 py-2 bg-muted rounded-xl font-mono text-lg tracking-wider text-center">
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
    </div>
  );
};

export default InviteFamilyWhatsApp;

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Check, X, Loader2, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Pending Family Invites Component
 * Shows pending invitations for the logged-in user
 * Allows accepting or declining invites
 */
const PendingFamilyInvites = ({ onInviteAccepted }) => {
  const { token, user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchPendingInvites();
  }, [token]);

  const fetchPendingInvites = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/family/my-invites`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInvites(data.invites || []);
      }
    } catch (error) {
      console.error('Error fetching invites:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async (inviteId) => {
    setProcessingId(inviteId);

    try {
      const response = await fetch(`${API_URL}/api/family/accept-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invite_id: inviteId })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`You've joined ${data.family_name}!`);
        setInvites(invites.filter(i => i.id !== inviteId));
        if (onInviteAccepted) {
          onInviteAccepted(data);
        }
      } else {
        toast.error(data.detail || 'Failed to accept invite');
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast.error('Failed to accept invite');
    } finally {
      setProcessingId(null);
    }
  };

  const declineInvite = async (inviteId) => {
    setProcessingId(inviteId);

    try {
      const response = await fetch(`${API_URL}/api/family/decline-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invite_id: inviteId })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Invite declined');
        setInvites(invites.filter(i => i.id !== inviteId));
      } else {
        toast.error(data.detail || 'Failed to decline invite');
      }
    } catch (error) {
      console.error('Error declining invite:', error);
      toast.error('Failed to decline invite');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (invites.length === 0) {
    return null; // Don't show if no pending invites
  }

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-6 mb-6" data-testid="pending-invites">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Users size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Family Invitations</h3>
          <p className="text-sm text-muted-foreground">
            You've been invited to join a family!
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {invites.map((invite) => (
          <div 
            key={invite.id} 
            className="bg-background rounded-xl p-4 border border-border/40"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold">{invite.family_name}</h4>
                <p className="text-sm text-muted-foreground">
                  Invited by {invite.invited_by_name}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={12} />
                {new Date(invite.created_at).toLocaleDateString()}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => acceptInvite(invite.id)}
                disabled={processingId === invite.id}
                className="flex-1 rounded-full"
                data-testid={`accept-invite-${invite.id}`}
              >
                {processingId === invite.id ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Check size={16} className="mr-2" />
                )}
                Accept
              </Button>
              <Button
                onClick={() => declineInvite(invite.id)}
                disabled={processingId === invite.id}
                variant="outline"
                className="rounded-full"
                data-testid={`decline-invite-${invite.id}`}
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingFamilyInvites;

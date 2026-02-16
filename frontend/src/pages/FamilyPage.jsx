import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  UserPlus, 
  Vote, 
  Loader2, 
  ArrowLeft,
  Crown,
  Check,
  MessageCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import InviteFamilyWhatsApp from '@/components/InviteFamilyWhatsApp';
import WhatsAppSettings from '@/components/WhatsAppSettings';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const FamilyPage = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState(null);
  const [hasFamily, setHasFamily] = useState(false);
  const [votingSessions, setVotingSessions] = useState([]);
  const [isFamilyPlan, setIsFamilyPlan] = useState(false);
  
  // Create family form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Join family form
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    fetchFamilyData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, token]);

  const fetchFamilyData = async () => {
    try {
      // First check subscription to see if user has family plan
      const subRes = await fetch(`${API_URL}/api/subscription/current`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const subData = await subRes.json();
      
      if (subData.success && subData.subscription) {
        const planId = subData.subscription.plan_id || '';
        const hasFamilyPlan = planId.toLowerCase().includes('family');
        setIsFamilyPlan(hasFamilyPlan);
        
        if (!hasFamilyPlan) {
          setLoading(false);
          return;
        }
      }

      // Get family info
      const familyRes = await fetch(`${API_URL}/api/family/my-family`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const familyData = await familyRes.json();
      
      if (familyData.success) {
        setHasFamily(familyData.has_family);
        setFamily(familyData.family);
      }

      // Get active voting sessions
      if (familyData.has_family) {
        const votingRes = await fetch(`${API_URL}/api/family/voting/active`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const votingData = await votingRes.json();
        if (votingData.success) {
          setVotingSessions(votingData.sessions);
        }
      }
    } catch (error) {
      console.error('Error fetching family data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFamily = async (e) => {
    e.preventDefault();
    if (!familyName.trim()) return;
    
    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/family/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          family_name: familyName,
          max_members: 5
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowCreateForm(false);
        fetchFamilyData();
      } else {
        alert(data.detail || 'Failed to create family');
      }
    } catch (error) {
      console.error('Create family error:', error);
      alert('Failed to create family');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinFamily = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    setJoining(true);
    try {
      const response = await fetch(`${API_URL}/api/family/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invite_code: inviteCode.toUpperCase()
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowJoinForm(false);
        fetchFamilyData();
      } else {
        alert(data.detail || 'Failed to join family');
      }
    } catch (error) {
      console.error('Join family error:', error);
      alert('Failed to join family');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Not on Family Plan - show upgrade prompt
  if (!isFamilyPlan) {
    return (
      <div className="min-h-screen pt-20 pb-24 px-4 sm:px-6 lg:px-8" data-testid="family-page-upgrade">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6 rounded-full"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
          
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users size={40} className="text-primary" />
            </div>
            <h1 className="text-3xl font-serif font-bold mb-4">Family Plan Required</h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Create a family account, vote on recipes together, and get WhatsApp notifications 
              with the Family Plan.
            </p>
            <Button
              onClick={() => navigate('/pricing')}
              className="rounded-full px-8"
              data-testid="upgrade-btn"
            >
              View Family Plan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-24 px-4 sm:px-6 lg:px-8" data-testid="family-page">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 rounded-full"
        >
          <ArrowLeft size={18} className="mr-2" />
          Back
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-2" data-testid="page-title">
            Family Cooking
          </h1>
          <p className="text-muted-foreground">
            Vote on recipes together and cook as a family
          </p>
        </div>

        {/* No family yet - show create/join options */}
        {!hasFamily && !showCreateForm && !showJoinForm && (
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-card rounded-2xl border border-border/40 p-6 text-left hover:border-primary/50 transition-colors"
              data-testid="create-family-btn"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Users size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Create Family</h3>
              <p className="text-sm text-muted-foreground">
                Start a new family group and invite members
              </p>
            </button>
            
            <button
              onClick={() => setShowJoinForm(true)}
              className="bg-card rounded-2xl border border-border/40 p-6 text-left hover:border-primary/50 transition-colors"
              data-testid="join-family-btn"
            >
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <UserPlus size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Join Family</h3>
              <p className="text-sm text-muted-foreground">
                Enter an invite code to join an existing family
              </p>
            </button>
          </div>
        )}

        {/* Create family form */}
        {showCreateForm && (
          <div className="bg-card rounded-2xl border border-border/40 p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Create Your Family</h3>
            <form onSubmit={handleCreateFamily} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="family-name">Family Name</Label>
                <Input
                  id="family-name"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g., The Smith Family"
                  className="rounded-xl"
                  data-testid="family-name-input"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !familyName.trim()}
                  className="rounded-full flex-1"
                  data-testid="create-family-submit"
                >
                  {creating ? <Loader2 size={18} className="mr-2 animate-spin" /> : null}
                  Create Family
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Join family form */}
        {showJoinForm && (
          <div className="bg-card rounded-2xl border border-border/40 p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Join a Family</h3>
            <form onSubmit={handleJoinFamily} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invite Code</Label>
                <Input
                  id="invite-code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  className="rounded-xl font-mono tracking-wider"
                  maxLength={8}
                  data-testid="invite-code-input"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowJoinForm(false)}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={joining || inviteCode.length < 8}
                  className="rounded-full flex-1"
                  data-testid="join-family-submit"
                >
                  {joining ? <Loader2 size={18} className="mr-2 animate-spin" /> : null}
                  Join Family
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Family exists - show details */}
        {hasFamily && family && (
          <>
            {/* Family info card */}
            <div className="bg-card rounded-2xl border border-border/40 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users size={24} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{family.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {family.members?.length || 1} of {family.max_members} members
                    </p>
                  </div>
                </div>
                {family.role === 'owner' && (
                  <span className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                    <Crown size={16} />
                    Owner
                  </span>
                )}
              </div>
              
              {/* Members list */}
              <div className="border-t border-border/40 pt-4">
                <h4 className="text-sm font-medium mb-3">Members</h4>
                <div className="space-y-2">
                  {family.members?.map((member, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="flex-1">{member.name}</span>
                      {member.role === 'owner' && (
                        <Crown size={14} className="text-amber-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Invite members via WhatsApp */}
            {family.role === 'owner' && (
              <div className="mb-6">
                <InviteFamilyWhatsApp 
                  inviteCode={family.invite_code} 
                  familyName={family.name} 
                />
              </div>
            )}

            {/* Active voting sessions */}
            {votingSessions.length > 0 && (
              <div className="bg-card rounded-2xl border border-border/40 p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Vote size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold">Active Votes</h3>
                </div>
                
                <div className="space-y-3">
                  {votingSessions.map((session) => (
                    <div 
                      key={session.id} 
                      className="p-4 rounded-xl bg-muted/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium capitalize">{session.meal_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {session.meal_date} • {session.vote_count} votes
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.user_voted ? (
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <Check size={16} />
                            Voted
                          </span>
                        ) : (
                          <Button 
                            size="sm" 
                            className="rounded-full"
                            onClick={() => navigate(`/family/vote/${session.id}`)}
                          >
                            Vote Now
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WhatsApp settings */}
            <WhatsAppSettings onPhoneAdd={() => navigate('/profile')} />
          </>
        )}
      </div>
    </div>
  );
};

export default FamilyPage;

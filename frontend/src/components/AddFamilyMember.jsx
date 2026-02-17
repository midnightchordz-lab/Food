import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Loader2, Users, X, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Add Family Member Component
 * Owner adds members by name + phone number
 * SMS invite is sent automatically
 */
const AddFamilyMember = ({ familyId, currentMemberCount, maxMembers, onMemberAdded }) => {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);

  const canAddMore = currentMemberCount < maxMembers;

  const handlePhoneChange = (value) => {
    // Only allow digits and +
    const cleaned = value.replace(/[^\d+]/g, '');
    setPhone(cleaned);
  };

  const addMember = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Please enter member name');
      return;
    }
    
    if (!phone.trim() || phone.length < 10) {
      toast.error('Please enter a valid phone number with country code');
      return;
    }

    setAdding(true);

    try {
      const response = await fetch(`${API_URL}/api/family/add-member`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member_name: name.trim(),
          phone_number: phone.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Invite sent to ${name}!`);
        setName('');
        setPhone('');
        if (onMemberAdded) {
          onMemberAdded(data.invitation);
        }
      } else {
        toast.error(data.detail || 'Failed to add member');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  if (!canAddMore) {
    return (
      <div className="bg-card rounded-2xl border border-border/40 p-6" data-testid="add-member-maxed">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Users size={20} className="text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Family Full</h3>
            <p className="text-sm text-muted-foreground">
              Maximum {maxMembers} members reached
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/40 p-6" data-testid="add-family-member">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserPlus size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Add Family Member</h3>
          <p className="text-sm text-muted-foreground">
            {currentMemberCount} of {maxMembers} members • Add up to {maxMembers - currentMemberCount} more
          </p>
        </div>
      </div>

      <form onSubmit={addMember} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="member-name">Name</Label>
          <Input
            id="member-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Mom, Dad, Sarah"
            className="rounded-xl"
            data-testid="member-name-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="member-phone">Phone Number</Label>
          <Input
            id="member-phone"
            type="tel"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="+1 234 567 8900"
            className="rounded-xl"
            data-testid="member-phone-input"
          />
          <p className="text-xs text-muted-foreground">
            Include country code (e.g., +1 for US, +91 for India)
          </p>
        </div>

        <Button
          type="submit"
          disabled={adding || !name.trim() || phone.length < 10}
          className="w-full rounded-full"
          data-testid="add-member-btn"
        >
          {adding ? (
            <>
              <Loader2 size={18} className="mr-2 animate-spin" />
              Sending Invite...
            </>
          ) : (
            <>
              <UserPlus size={18} className="mr-2" />
              Add & Send Invite
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

export default AddFamilyMember;

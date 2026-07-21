import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Trash2, UserPlus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface TeamMember {
  email: string;
  role: 'admin' | 'tech';
  displayName?: string;
  addedAt?: any;
}

export const TeamMembersSettings: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchMembers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        email: doc.id,
        role: doc.data().role,
        displayName: doc.data().displayName,
        addedAt: doc.data().addedAt
      })) as TeamMember[];
      setMembers(data);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleUpdateDisplayNameLocal = (email: string, displayName: string) => {
    setMembers(members.map(m => m.email === email ? { ...m, displayName } : m));
  };

  const handleSaveDisplayName = async (email: string, displayName: string) => {
    try {
      await setDoc(doc(db, 'users', email), {
        displayName
      }, { merge: true });
      toast.success('Display name updated');
    } catch (error) {
      console.error('Error updating display name:', error);
      toast.error('Failed to update display name');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    
    if (!email) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);
      await setDoc(doc(db, 'users', email), {
        role: 'tech',
        addedAt: new Date()
      }, { merge: true });
      toast.success(`Access granted for ${email}`);
      setNewEmail('');
      fetchMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member. Make sure you are an admin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = (email: string) => {
    toast(`Remove access for ${email}?`, {
      action: {
        label: 'Confirm',
        onClick: async () => {
          try {
            setIsLoading(true);
            await deleteDoc(doc(db, 'users', email));
            toast.success(`Access removed for ${email}`);
            fetchMembers();
          } catch (error) {
            console.error('Error removing member:', error);
            toast.error('Failed to remove member');
          } finally {
            setIsLoading(false);
          }
        }
      },
      cancel: { label: 'Cancel', onClick: () => {} }
    });
  };

  const isAdmin = auth.currentUser?.email === 'repairs.phonemedic.au@gmail.com';

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Team Members</h3>
        <div className="p-6 bg-secondary/30 rounded-2xl border border-border/30 flex items-start gap-4">
          <ShieldAlert className="w-8 h-8 text-amber-500" />
          <div>
            <h4 className="font-bold">Admin Privileges Required</h4>
            <p className="text-sm text-muted-foreground mt-1">You must be the primary admin (repairs.phonemedic.au@gmail.com) to manage team members.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Team Members</h3>
      <div className="p-6 bg-secondary/30 rounded-2xl border border-border/30 space-y-6">
        <div>
          <h4 className="font-bold text-sm">Add Team Member</h4>
          <p className="text-xs text-muted-foreground mb-3">Grant a technician access to log into RepairSync via Google Sign-In using their email.</p>
          <form onSubmit={handleAddMember} className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
               <Input 
                 type="email" 
                 placeholder="tech@example.com"
                 className="bg-white/40 border-border/30"
                 value={newEmail}
                 onChange={(e) => setNewEmail(e.target.value)}
                 disabled={isLoading}
               />
            </div>
            <Button type="submit" disabled={isLoading} className="bg-slate-800 hover:bg-slate-900 text-white shrink-0">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </form>
        </div>

        <div className="space-y-3 pt-4 border-t border-border/30">
          <h4 className="font-bold text-sm">Authorized Techs</h4>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No team members added yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.email} className="flex items-center justify-between p-3 bg-white/40 border border-border/30 rounded-xl group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                       {(member.displayName ? member.displayName.charAt(0) : member.email.charAt(0)).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input
                        className="h-8 -ml-2.5 px-2.5 bg-transparent border-transparent hover:bg-white/40 focus:bg-white hover:border-border/50 focus:border-primary/30 shadow-none font-bold text-sm transition-all"
                        placeholder="Set Display Name..."
                        value={member.displayName || ''}
                        onChange={(e) => handleUpdateDisplayNameLocal(member.email, e.target.value)}
                        onBlur={() => handleSaveDisplayName(member.email, member.displayName || '')}
                        disabled={isLoading}
                      />
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{member.role}</p>
                        <span className="w-1 h-1 rounded-full bg-border/50" />
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                  </div>
                  {member.email !== 'repairs.phonemedic.au@gmail.com' && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveMember(member.email)}
                      disabled={isLoading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

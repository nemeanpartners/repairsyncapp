import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, query, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Trash2, UserPlus, ShieldAlert, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { companyCollection, companyDoc } from "../lib/companyFirestore";
import { useAuth } from "../providers/AuthProvider";
import axios from 'axios';

interface TeamMember {
  id: string;
  email: string;
  uid?: string;
  role: 'admin' | 'tech';
  authMethod?: 'google' | 'apple' | 'email_password';
  permissions?: string[];
  hasAccess?: boolean;
  displayName?: string;
  addedAt?: any;
}

export const TeamMembersSettings: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [authMethod, setAuthMethod] = useState<'google' | 'apple' | 'email_password'>('google');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { profile, user } = useAuth();

  const fetchMembers = async () => {
    try {
      const q = query(companyCollection('users'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || doc.id,
        uid: doc.data().uid,
        role: doc.data().role,
        authMethod: doc.data().authMethod || "google",
        permissions: doc.data().permissions || [],
        hasAccess: doc.data().hasAccess !== false,
        displayName: doc.data().displayName,
        addedAt: doc.data().addedAt
      })) as TeamMember[];
      const deduped = Array.from(
        data
          .sort((a, b) => Number(Boolean(b.uid)) - Number(Boolean(a.uid)))
          .reduce((map, member) => {
            if (!map.has(member.email)) map.set(member.email, member);
            return map;
          }, new Map<string, TeamMember>())
          .values(),
      );
      setMembers(deduped);
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

  const handleUpdateDisplayNameLocal = (id: string, displayName: string) => {
    setMembers(members.map(m => m.id === id ? { ...m, displayName } : m));
  };

  const handleSaveDisplayName = async (id: string, displayName: string) => {
    try {
      await setDoc(companyDoc('users', id), {
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
    if (authMethod === "email_password" && temporaryPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters');
      return;
    }

    try {
      setIsLoading(true);
      if (authMethod === "email_password") {
        const response = await axios.post('/api/team/invite', {
          email,
          displayName: newDisplayName.trim(),
          authMethod,
          password: temporaryPassword,
          companyId: profile?.companyId,
          companyName: profile?.companyName,
        });
        toast.success(
          response.data?.alreadyExists
            ? `${email} already has a login. Company access was granted.`
            : `Login created for ${email}. Give them the temporary password you entered.`,
        );
      } else {
        await setDoc(companyDoc('users', email), {
          email,
          displayName: newDisplayName.trim() || null,
          role: 'tech',
          authMethod,
          permissions: ["tickets", "customers", "messages", "tasks", "invoices", "inventory"],
          hasAccess: true,
          companyId: profile?.companyId || null,
          companyName: profile?.companyName || null,
          invitedBy: user?.uid || null,
          invitedByEmail: user?.email || null,
          addedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        toast.success(`Access granted for ${email}. They can sign in with ${authMethod === "apple" ? "Apple" : "Google"}.`);
      }
      setNewEmail('');
      setNewDisplayName('');
      setTemporaryPassword('');
      fetchMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member. Make sure you are an admin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = (member: TeamMember) => {
    toast(`Remove access for ${member.email}?`, {
      action: {
        label: 'Confirm',
        onClick: async () => {
          try {
            setIsLoading(true);
            await deleteDoc(companyDoc('users', member.id));
            if (member.uid && member.uid !== member.id) {
              await deleteDoc(companyDoc('users', member.uid)).catch(() => {});
              await setDoc(doc(db, 'users', member.uid), {
                hasAccess: false,
                removedByAdmin: true,
                removedAt: serverTimestamp(),
              }, { merge: true }).catch(() => {});
            }
            toast.success(`Access removed for ${member.email}`);
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

  const isAdmin = profile?.role === "admin" || profile?.permissions?.includes("admin");

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Team Members</h3>
        <div className="p-6 bg-secondary/30 rounded-2xl border border-border/30 flex items-start gap-4">
          <ShieldAlert className="w-8 h-8 text-amber-500" />
          <div>
            <h4 className="font-bold">Admin Privileges Required</h4>
            <p className="text-sm text-muted-foreground mt-1">Only a company admin can manage team members and access permissions.</p>
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
          <p className="text-xs text-muted-foreground mb-3">Grant day-to-day access to your company data. Team members can work tickets, customers, messages, invoices, tasks, and inventory, but cannot change settings or delete their own account.</p>
          <form onSubmit={handleAddMember} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="relative">
               <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Email</label>
               <Input 
                 type="email" 
                 placeholder="team@example.com"
                 className="bg-white/40 border-border/30"
                 value={newEmail}
                 onChange={(e) => setNewEmail(e.target.value)}
                 disabled={isLoading}
               />
            </div>
            <div className="relative">
               <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Display name</label>
               <Input
                 type="text"
                 placeholder="Technician name"
                 className="bg-white/40 border-border/30"
                 value={newDisplayName}
                 onChange={(e) => setNewDisplayName(e.target.value)}
                 disabled={isLoading}
               />
            </div>
            <div className="relative">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Sign-in method</label>
              <select
                value={authMethod}
                onChange={(event) => setAuthMethod(event.target.value as typeof authMethod)}
                disabled={isLoading}
                className="h-10 w-full rounded-lg border border-border/30 bg-white/40 px-3 text-sm font-semibold text-zinc-800"
              >
                <option value="google">Google</option>
                <option value="apple">Apple</option>
                <option value="email_password">Email + password</option>
              </select>
            </div>
            {authMethod === "email_password" ? (
              <div className="relative md:col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Temporary password</label>
                <Input
                  type="text"
                  placeholder="Give this password to the user"
                  className="bg-white/40 border-border/30"
                  value={temporaryPassword}
                  onChange={(e) => setTemporaryPassword(e.target.value)}
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-zinc-500">The password is sent to Firebase Auth and is not stored in RepairSync.</p>
              </div>
            ) : null}
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
                        onChange={(e) => handleUpdateDisplayNameLocal(member.id, e.target.value)}
                        onBlur={() => handleSaveDisplayName(member.id, member.displayName || '')}
                        disabled={isLoading}
                      />
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{member.role}</p>
                        <span className="w-1 h-1 rounded-full bg-border/50" />
                        {member.authMethod === "email_password" ? <KeyRound className="h-3 w-3 text-zinc-400" /> : null}
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{member.authMethod || "google"}</p>
                        <span className="w-1 h-1 rounded-full bg-border/50" />
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                  </div>
                  {member.email !== auth.currentUser?.email?.toLowerCase() && member.role !== "admin" && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveMember(member)}
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

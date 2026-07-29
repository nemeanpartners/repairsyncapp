import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, query, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Trash2, UserPlus, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { companyCollection, companyDoc } from "../lib/companyFirestore";
import { useAuth } from "../providers/AuthProvider";
import axios from 'axios';

const SETTINGS_PERMISSION_OPTIONS = [
  { key: "settings:general", label: "Company" },
  { key: "settings:team", label: "Team" },
  { key: "settings:catalog", label: "Catalog" },
  { key: "settings:notifications", label: "Notifications" },
  { key: "settings:automations", label: "Automations" },
  { key: "settings:chat_templates", label: "Templates" },
  { key: "settings:devices", label: "Devices" },
  { key: "settings:appearance", label: "Appearance" },
  { key: "settings:integrations", label: "Integrations" },
  { key: "settings:ai", label: "AI" },
  { key: "settings:database", label: "Data" },
  { key: "settings:security", label: "Security" },
];

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
  const isAdmin = profile?.role === "admin" || profile?.permissions?.includes("admin");
  const canManageTeam = isAdmin || Boolean(profile?.permissions?.includes("settings:team"));

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
    if (!canManageTeam) return;
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

  const handleTogglePermission = async (member: TeamMember, permission: string) => {
    if (!isAdmin) {
      toast.error("Only a company admin can change settings permissions.");
      return;
    }
    const currentPermissions = new Set(member.permissions || []);
    if (currentPermissions.has(permission)) {
      currentPermissions.delete(permission);
    } else {
      currentPermissions.add(permission);
    }
    const permissions = Array.from(currentPermissions);

    try {
      setMembers((current) =>
        current.map((candidate) =>
          candidate.email === member.email ? { ...candidate, permissions } : candidate,
        ),
      );
      await setDoc(companyDoc('users', member.id), {
        permissions,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (member.uid) {
        await Promise.all([
          setDoc(companyDoc('users', member.uid), {
            permissions,
            updatedAt: serverTimestamp(),
          }, { merge: true }),
          setDoc(doc(db, 'users', member.uid), {
            permissions,
            updatedAt: serverTimestamp(),
          }, { merge: true }),
        ]);
      }
      toast.success("Permissions updated");
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
      fetchMembers();
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTeam) {
      toast.error("You do not have permission to add team members.");
      return;
    }
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
        await setDoc(doc(db, 'team_invites', email), {
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
    if (!isAdmin) {
      toast.error("Only a company admin can remove users.");
      return;
    }
    toast(`Remove access for ${member.email}?`, {
      action: {
        label: 'Confirm',
        onClick: async () => {
          try {
            setIsLoading(true);
            await deleteDoc(companyDoc('users', member.id));
            await deleteDoc(doc(db, 'team_invites', member.email)).catch(() => {});
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">Team Members</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {canManageTeam
            ? "Invite staff and manage access for this company."
            : "View your company team. Editing is controlled by your company admin."}
        </p>
      </div>
      <div className="p-6 bg-secondary/30 rounded-2xl border border-border/30 space-y-6">
        {canManageTeam ? (
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
        ) : null}

        <div className={`space-y-3 ${canManageTeam ? "pt-4 border-t border-border/30" : ""}`}>
          <h4 className="font-bold text-sm">Company Users</h4>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No team members added yet.</p>
          ) : (
            <div className="grid gap-3">
              {members.map((member) => {
                const isCurrentUser = member.email === auth.currentUser?.email?.toLowerCase();
                const settingsAccess = SETTINGS_PERMISSION_OPTIONS.filter((option) =>
                  member.permissions?.includes(option.key),
                );
                return (
                <div key={member.email} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                         {(member.displayName ? member.displayName.charAt(0) : member.email.charAt(0)).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {canManageTeam ? (
                          <Input
                            className="h-9 -ml-2.5 px-2.5 bg-transparent border-transparent hover:bg-zinc-50 focus:bg-white hover:border-border/50 focus:border-primary/30 shadow-none font-bold text-sm transition-all"
                            placeholder="Set Display Name..."
                            value={member.displayName || ''}
                            onChange={(e) => handleUpdateDisplayNameLocal(member.id, e.target.value)}
                            onBlur={() => handleSaveDisplayName(member.id, member.displayName || '')}
                            disabled={isLoading}
                          />
                        ) : (
                          <h4 className="text-sm font-bold text-zinc-900">{member.displayName || "Team member"}</h4>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${member.role === "admin" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                            {member.role}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                            {member.authMethod === "email_password" ? <KeyRound className="h-3 w-3" /> : null}
                            {member.authMethod || "google"}
                          </span>
                          {isCurrentUser ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 flex items-start gap-2 break-all text-xs font-medium text-zinc-600">
                          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                          {member.email}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(member.permissions || []).filter((permission) => !permission.startsWith("settings:")).slice(0, 8).map((permission) => (
                            <span key={permission} className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                              {permission}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {isAdmin && !isCurrentUser ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleRemoveMember(member)}
                        disabled={isLoading}
                        title={`Remove ${member.email}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : null}
                  </div>
                  {member.role !== "admin" && isAdmin ? (
                    <div className="rounded-xl border border-zinc-200/70 bg-white/50 p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Optional settings access
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SETTINGS_PERMISSION_OPTIONS.map((option) => {
                          const checked = Boolean(member.permissions?.includes(option.key));
                          return (
                            <button
                              key={option.key}
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleTogglePermission(member, option.key)}
                              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                                checked
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {member.role !== "admin" && !isAdmin ? (
                    <div className="rounded-xl border border-zinc-200/70 bg-zinc-50 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Settings access
                      </div>
                      {settingsAccess.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {settingsAccess.map((option) => (
                            <span key={option.key} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                              {option.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">No settings edit permissions granted.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

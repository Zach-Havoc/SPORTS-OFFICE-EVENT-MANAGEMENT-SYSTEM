import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { updateAccountProfile, updateAccountPassword } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  User, Lock, CheckCircle2, Eye, EyeOff, ShieldCheck, AtSign,
  AlertTriangle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  coach: 'Coach',
  athlete: 'Athlete',
  judge: 'Committee',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  coach: 'bg-blue-100 text-blue-800',
  athlete: 'bg-green-100 text-green-800',
  judge: 'bg-amber-100 text-amber-800',
};

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    password.length >= 12,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500', 'bg-emerald-500'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${score <= 2 ? 'text-red-500' : score <= 3 ? 'text-yellow-600' : 'text-green-600'}`}>
        {labels[score]}
      </p>
    </div>
  );
}

export default function AccountSettings() {
  const { user, setUserName, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  if (!user) { navigate('/login'); return null; }

  // ── Profile save ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Name cannot be empty'); return; }
    if (trimmed === user.name) { toast.info('No changes to save'); return; }

    setSavingProfile(true);
    setProfileSaved(false);
    try {
      await updateAccountProfile({ name: trimmed });
      // Optimistically update the UI immediately
      setUserName(trimmed);
      // Then re-fetch from server to confirm the write persisted
      await refreshUser();
      setProfileSaved(true);
      toast.success('Name updated successfully');
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update name');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Password save ─────────────────────────────────────────────────────────
  const handleSavePassword = async () => {
    setPasswordError('');

    if (!currentPassword) { setPasswordError('Please enter your current password'); return; }
    if (!newPassword) { setPasswordError('Please enter a new password'); return; }
    if (newPassword.length < 8) { setPasswordError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match'); return; }
    if (newPassword === currentPassword) { setPasswordError('New password must be different from your current one'); return; }

    setSavingPassword(true);
    try {
      await updateAccountPassword({ currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const roleColor = ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your profile and security preferences</p>
      </div>

      {/* ── Identity card ────────────────────────────────────────────── */}
      <Card className="mb-6 border border-gray-200">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0"
              style={{ background: 'var(--primary, #dc2626)' }}
            >
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900 text-lg leading-tight truncate">{user.name}</p>
                <Badge className={`text-xs font-semibold ${roleColor}`}>{roleLabel}</Badge>
              </div>
              <p className="text-gray-500 text-sm flex items-center gap-1 mt-0.5">
                <AtSign className="h-3.5 w-3.5" />
                {user.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Display Name ─────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Display Name</CardTitle>
              <CardDescription className="text-xs mt-0">This name appears across the system</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={e => { setName(e.target.value); setProfileSaved(false); }}
              placeholder="Enter your full name"
              className="mt-1.5"
              onKeyDown={e => e.key === 'Enter' && handleSaveProfile()}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Email address cannot be changed here.
            </p>
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile || !name.trim() || name.trim() === user.name}
              size="sm"
              className="min-w-24"
            >
              {savingProfile ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
              ) : profileSaved ? (
                <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-300" />Saved!</>
              ) : (
                'Save Name'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Change Password ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Lock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription className="text-xs mt-0">Use a strong password you don't use elsewhere</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Current password */}
          <div>
            <Label htmlFor="current-pw" className="text-sm font-medium">Current Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="current-pw"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setPasswordError(''); }}
                placeholder="Enter current password"
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <Label htmlFor="new-pw" className="text-sm font-medium">New Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="new-pw"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordError(''); }}
                placeholder="At least 8 characters"
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <StrengthBar password={newPassword} />
          </div>

          {/* Confirm new password */}
          <div>
            <Label htmlFor="confirm-pw" className="text-sm font-medium">Confirm New Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="confirm-pw"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                placeholder="Re-enter new password"
                className={`pr-10 ${confirmPassword && confirmPassword !== newPassword ? 'border-red-400 focus-visible:ring-red-400' : confirmPassword && confirmPassword === newPassword ? 'border-green-400' : ''}`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {confirmPassword && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                  {confirmPassword === newPassword
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : <AlertTriangle className="h-4 w-4 text-red-400" />}
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {passwordError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {passwordError}
            </div>
          )}

          {/* Requirements hint */}
          <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
            <span>Minimum 8 characters. Use a mix of uppercase, numbers, and symbols for a stronger password.</span>
          </div>

          <Button
            onClick={handleSavePassword}
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="w-full"
          >
            {savingPassword ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating Password…</>
            ) : (
              <><Lock className="h-4 w-4 mr-2" />Update Password</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

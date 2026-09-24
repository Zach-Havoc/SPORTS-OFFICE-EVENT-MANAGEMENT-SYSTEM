import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { signup, resetPassword } from '../services/api';

type AuthMode = 'login' | 'signup' | 'reset';

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'coach' | 'athlete' | 'judge'>('athlete');
  const [registrationCode, setRegistrationCode] = useState('');
  const [srCode, setSrCode] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();


  // Redirect when user logs in successfully
  useEffect(() => {
    if (user) {
      console.log('User logged in, redirecting based on role:', user.role);
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'coach') {
        navigate('/coach');
      } else if (user.role === 'athlete') {
        navigate('/athlete');
      } else if (user.role === 'judge') {
        navigate('/judge');
      } else {
        navigate('/');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        console.log('Attempting login for:', email);
        await login(email, password);
        console.log('Login completed successfully');
        toast.success('Signed in');
      } else if (mode === 'signup') {
        // Validate passwords match
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        // Validate password strength
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }

        if (role === 'athlete' && !srCode.trim()) {
          throw new Error('Enter your SR Code so we can verify you as an enrolled student.');
        }

        if (!privacyAccepted) {
          throw new Error('You must acknowledge the Data Privacy Notice to continue.');
        }

        console.log('Attempting signup for:', email);
        await signup(email, password, name, role, registrationCode, srCode.trim(), privacyAccepted);
        toast.success('Account created. You can sign in now.');

        // Switch to login mode after successful signup
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setSrCode('');
        setPrivacyAccepted(false);
      } else if (mode === 'reset') {
        console.log('Requesting password reset for:', email);
        await resetPassword(email);
        setResetSent(true);
        toast.success('Reset link sent. Check your email.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const errorMessage = err.message || "We couldn't complete that. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setRole('judge');
    setRegistrationCode('');
    setSrCode('');
    setPrivacyAccepted(false);
    setError('');
    setResetSent(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    resetForm();
  };

  const heading =
    mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create an account' : 'Reset your password';
  const subheading =
    mode === 'login'
      ? 'Scoring, standings and rosters for ARASOF intramurals.'
      : mode === 'signup'
        ? 'Accounts are for staff, coaches, judges and enrolled athletes.'
        : 'We will email you a link to set a new password.';

  return (
    <div className="flex min-h-[calc(100dvh-200px)] items-center justify-center px-4 py-8">
      {/* Asymmetric split rather than a centered card: the left column carries
          who this belongs to, the right column does the one job the page has.
          Collapses to a single column below md. */}
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-md md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        <aside className="hidden flex-col justify-between bg-sidebar p-8 text-sidebar-foreground md:flex">
          <img src="/sportaxis-mark.png" alt="" aria-hidden="true" className="h-11 w-11 object-contain" />
          <div>
            <h2 className="text-2xl font-bold leading-[1.15] tracking-[-0.022em] text-white">
              SportAxis
            </h2>
            <p className="mt-3 max-w-[28ch] text-sm leading-relaxed text-sidebar-foreground/65">
              The scoring and event record for the BatStateU-TNEU ARASOF Sports Office.
            </p>
          </div>
          <p className="text-xs text-sidebar-foreground/45">
            Results are official once the Sports Office confirms them.
          </p>
        </aside>

        <div className="p-6 sm:p-8">
          <img
            src="/sportaxis-mark.png"
            alt="SportAxis"
            className="mb-5 h-12 w-12 object-contain md:hidden"
          />
          <h1 className="text-2xl font-bold tracking-[-0.022em]">{heading}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subheading}</p>
          {mode === 'signup' && (
            <p className="mt-4 rounded-md border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              Public viewers can browse schedules, standings and results without an
              account. Sign up only if you need to manage or score events.
            </p>
          )}
          <div className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {resetSent && mode === 'reset' && (
              <Alert>
                <AlertDescription>
                  Password reset instructions have been sent to your email. Please check your inbox.
                </AlertDescription>
              </Alert>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Name Field (Signup only) */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Maria Clara Villanueva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Role Selection (Signup only) */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value: 'admin' | 'coach' | 'athlete' | 'judge') => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="athlete">Athlete - View schedule & performance</SelectItem>
                    <SelectItem value="coach">Coach - Manage athletes & teams</SelectItem>
                    <SelectItem value="judge">Committee - Score events</SelectItem>
                    <SelectItem value="admin">Admin - Full system access</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {role === 'athlete' && 'Athletes can view schedules, performance, and submit requirements'}
                  {role === 'coach' && 'Coaches can manage athletes, track attendance, and record performance'}
                  {role === 'judge' && 'Committees can view and score assigned events'}
                  {role === 'admin' && 'Admins can manage events, users, and view all data'}
                </p>
              </div>
            )}

            {/* SR Code — athletes are verified against the campus registry */}
            {mode === 'signup' && role === 'athlete' && (
              <div className="space-y-2">
                <Label htmlFor="srCode">SR Code *</Label>
                <Input
                  id="srCode"
                  type="text"
                  placeholder="e.g., 23-75760"
                  value={srCode}
                  onChange={(e) => setSrCode(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Your name and SR Code must match your college registrar's records.
                </p>
              </div>
            )}

            {/* Registration Code Field (Always required for signup) */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="registrationCode">Registration Code *</Label>
                <Input
                  id="registrationCode"
                  type="text"
                  placeholder="Enter your registration code"
                  value={registrationCode}
                  onChange={(e) => setRegistrationCode(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Contact an administrator to get a registration code for {role} access
                </p>
              </div>
            )}

            {/* Password Field */}
            {mode !== 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password Field (Signup only) */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Privacy Notice acknowledgment (Signup only) */}
            {mode === 'signup' && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="privacyAccepted"
                  checked={privacyAccepted}
                  onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="privacyAccepted" className="text-sm font-normal leading-snug text-muted-foreground">
                  I have read and understand the{' '}
                  <Link to="/privacy-notice" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
                    Data Privacy Notice
                  </Link>
                  , including that medical clearance is required for athletes.
                </Label>
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && 'Processing...'}
              {!loading && mode === 'login' && 'Login'}
              {!loading && mode === 'signup' && 'Create Account'}
              {!loading && mode === 'reset' && 'Send Reset Link'}
            </Button>

            {/* Mode Switchers */}
            <div className="space-y-2 pt-1 text-sm">
              {mode === 'login' && (
                <>
                  <div>
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Don't have an account? Create one
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </>
              )}

              {mode === 'signup' && (
                <div>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Already have an account? Login
                  </button>
                </div>
              )}

              {mode === 'reset' && (
                <div>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="mx-auto flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </button>
                </div>
              )}
            </div>

          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
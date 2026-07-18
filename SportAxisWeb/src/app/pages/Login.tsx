import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Trophy, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
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
        toast.success(`Welcome back! Logging in as ${email}`);
      } else if (mode === 'signup') {
        // Validate passwords match
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        // Validate password strength
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        console.log('Attempting signup for:', email);
        await signup(email, password, name, role, registrationCode);
        toast.success('Account created successfully! You can now log in.');
        
        // Switch to login mode after successful signup
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setName('');
      } else if (mode === 'reset') {
        console.log('Requesting password reset for:', email);
        await resetPassword(email);
        setResetSent(true);
        toast.success('Password reset instructions sent to your email!');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const errorMessage = err.message || 'An error occurred. Please try again.';
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
    setError('');
    setResetSent(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    resetForm();
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Trophy className="h-12 w-12 text-[#C8102E]" />
          </div>
          <CardTitle>
            {mode === 'login' && 'Welcome Back'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'reset' && 'Reset Password'}
          </CardTitle>
          <CardDescription>
            {mode === 'login' && 'Login to access the scoring system'}
            {mode === 'signup' && 'Register for admin or judge access'}
            {mode === 'reset' && 'Enter your email to reset your password'}
          </CardDescription>
          {mode === 'signup' && (
            <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-3 rounded-md">
              <strong>Note:</strong> Public viewers can access the system without creating an account.
              Accounts are only for admins and judges who need to manage or score events.
            </div>
          )}
        </CardHeader>
        <CardContent>
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
                  placeholder="John Doe"
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
                    <SelectItem value="judge">Judge - Score events</SelectItem>
                    <SelectItem value="admin">Admin - Full system access</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {role === 'athlete' && 'Athletes can view schedules, performance, and submit requirements'}
                  {role === 'coach' && 'Coaches can manage athletes, track attendance, and record performance'}
                  {role === 'judge' && 'Judges can view and score assigned events'}
                  {role === 'admin' && 'Admins can manage events, users, and view all data'}
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
                <p className="text-xs text-gray-500">
                  Contact an administrator to get a registration code for {role} access
                </p>
              </div>
            )}

            {/* Password Field */}
            {mode !== 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Confirm Password Field (Signup only) */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
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
            <div className="space-y-2 text-center text-sm">
              {mode === 'login' && (
                <>
                  <div>
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="text-[#C8102E] hover:underline"
                    >
                      Don't have an account? Create one
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-gray-600 hover:underline"
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
                    className="text-[#C8102E] hover:underline"
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
                    className="text-[#C8102E] hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </button>
                </div>
              )}
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
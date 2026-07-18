import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Calendar, TrendingUp, FileText, Trophy, Target,
  UserCheck, Loader2, AlertTriangle, LogOut, Users,
  ChevronRight, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { getMyCoach, enrollWithCode, unenrollFromCoach } from '../../services/api';

interface CoachInfo {
  id: string;
  name: string;
  email: string;
  sport: string;
}

interface EnrollmentState {
  enrolled: boolean;
  coach: CoachInfo | null;
  sport: string;
  enrolledAt: string;
}

// ── Enrollment Gate ────────────────────────────────────────────────────────
function EnrollmentGate({ onEnrolled }: { onEnrolled: () => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEnroll = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { toast.error('Please enter a valid enrollment code'); return; }
    setLoading(true);
    try {
      const res = await enrollWithCode(trimmed);
      toast.success(res.message || `Enrolled in ${res.coach?.sport}!`);
      onEnrolled();
    } catch (err: any) {
      toast.error(err?.message || 'Invalid enrollment code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join a Sports Team</h1>
          <p className="text-gray-500 leading-relaxed">
            Ask your coach for their <strong>enrollment code</strong> and enter it below to join their team.
          </p>
        </div>

        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6 pb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Enrollment Code
                </label>
                <Input
                  ref={inputRef}
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleEnroll()}
                  placeholder="e.g. AB1CD2"
                  className="text-center text-2xl font-black tracking-[0.3em] uppercase h-14 font-mono"
                  maxLength={8}
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-gray-400 text-center mt-2">
                  6-character code from your coach
                </p>
              </div>

              <Button
                className="w-full h-12 text-base"
                onClick={handleEnroll}
                disabled={loading || code.trim().length < 4}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Joining…</>
                ) : (
                  <><UserCheck className="h-4 w-4 mr-2" />Join Team</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-4">
          You can only be enrolled in one sports team at a time.
        </p>
      </div>
    </div>
  );
}

// ── Enrolled Dashboard ─────────────────────────────────────────────────────
function EnrolledDashboard({
  enrollment,
  userName,
  onUnenroll,
}: {
  enrollment: EnrollmentState;
  userName: string;
  onUnenroll: () => void;
}) {
  const [unenrolling, setUnenrolling] = useState(false);

  const handleUnenroll = async () => {
    if (!confirm('Are you sure you want to leave this team? You will need a new enrollment code to rejoin.')) return;
    setUnenrolling(true);
    try {
      await unenrollFromCoach();
      toast.success('Successfully unenrolled');
      onUnenroll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unenroll');
    } finally {
      setUnenrolling(false);
    }
  };

  const enrolledDate = enrollment.enrolledAt
    ? new Date(enrollment.enrolledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">

      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Athlete Portal</h1>
        <p className="text-gray-500 mt-1">Welcome back, {userName}!</p>
      </div>

      {/* Sport Team Card */}
      <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-xl font-bold text-gray-900">{enrollment.sport}</h2>
                  <Badge className="bg-green-100 text-green-800 text-xs">Enrolled</Badge>
                </div>
                <p className="text-gray-500 text-sm">
                  <span className="font-medium text-gray-700">{enrollment.coach?.name}</span>
                  {' · '}{enrollment.coach?.email}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Joined {enrolledDate}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleUnenroll}
              disabled={unenrolling}
            >
              {unenrolling
                ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Leaving…</>
                : <><LogOut className="h-3 w-3 mr-1.5" />Leave Team</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Upcoming Events', value: '—', sub: 'This week', icon: Calendar },
          { label: 'Attendance Rate', value: '—', sub: 'Last 30 days', icon: TrendingUp },
          { label: 'Performance', value: '—', sub: 'Average rating', icon: Trophy },
          { label: 'Requirements', value: '—', sub: 'Completed', icon: FileText },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-500">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Navigate to your key sections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { to: '/athlete/schedule', icon: Calendar, label: 'View Schedule', desc: 'Upcoming events & practices' },
              { to: '/athlete/performance', icon: TrendingUp, label: 'My Performance', desc: 'Stats and evaluations' },
              { to: '/athlete/requirements', icon: FileText, label: 'Requirements', desc: 'Submit documents' },
              { to: '/athlete/attendance', icon: Users, label: 'Attendance', desc: 'Track your attendance' },
              { to: '/athlete/announcements', icon: BookOpen, label: 'Announcements', desc: 'Updates from your coach' },
              { to: '/', icon: Trophy, label: 'Live Scores', desc: 'Ongoing competition results' },
            ].map(item => (
              <Link key={item.to} to={item.to}>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors shrink-0">
                    <item.icon className="h-4 w-4 text-gray-500 group-hover:text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400 truncate">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Coach Info */}
      {enrollment.coach && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Your Coach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
                {enrollment.coach.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{enrollment.coach.name}</p>
                <p className="text-sm text-gray-500">{enrollment.coach.email}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  {enrollment.coach.sport} Coach
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AthleteDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'athlete') { navigate('/login'); return; }
    checkEnrollment();
  }, [user, navigate]);

  const checkEnrollment = async () => {
    setLoading(true);
    try {
      const data = await getMyCoach();
      setEnrollment(data);
    } catch {
      setEnrollment({ enrolled: false, coach: null, sport: '', enrolledAt: '' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading your portal…</p>
        </div>
      </div>
    );
  }

  if (!enrollment?.enrolled) {
    return <EnrollmentGate onEnrolled={checkEnrollment} />;
  }

  return (
    <EnrolledDashboard
      enrollment={enrollment}
      userName={user.name}
      onUnenroll={checkEnrollment}
    />
  );
}

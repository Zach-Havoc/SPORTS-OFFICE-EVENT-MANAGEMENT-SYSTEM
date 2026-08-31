import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  UserPlus, Search, Users, Edit, Eye, Copy, Check,
  Trophy, BookOpen, AlertTriangle, UserMinus, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAthletes,
  useCoachProfile,
  useDepartments,
  useRemoveAthleteFromRoster,
  useUpdateCoachProfile,
} from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';

const SPORTS = [
  'Basketball','Volleyball','Badminton','Swimming','Track & Field',
  'Table Tennis','Football','Tennis','Sepak Takraw','Arnis',
  'Softball','Baseball','Chess','Gymnastics','Boxing','Weightlifting',
];

interface Athlete {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  yearLevel: string;
  course: string;
  sport?: string;
  coachId: string;
  status: 'active' | 'inactive' | 'injured';
  enrolledViaCode?: boolean;
  enrolledAt?: string;
  emergencyContact?: { name: string; relationship: string; phone: string };
  createdAt: string;
}

interface CoachProfile {
  id: string;
  name: string;
  email: string;
  sport: string;            // primary sport (back-compat)
  sports?: string[] | null; // full list of sports handled
  department?: string | null;
  genderCategory?: string | null;
  enrollmentCode: string;
}

export default function CoachAthletes() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'injured'>('all');
  const [codeCopied, setCodeCopied] = useState(false);

  // Sport setup dialog
  const [setupOpen, setSetupOpen] = useState(false);
  const [sportsDraft, setSportsDraft] = useState<string[]>([]);
  const [departmentDraft, setDepartmentDraft] = useState('');
  const [genderCategoryDraft, setGenderCategoryDraft] = useState('');

  // Remove confirm dialog
  const [removeTarget, setRemoveTarget] = useState<Athlete | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const athletesQuery = useAthletes();
  const profileQuery = useCoachProfile();
  const departmentsQuery = useDepartments();

  const athletes: Athlete[] = athletesQuery.data ?? [];
  const coachProfile: CoachProfile | null = profileQuery.data ?? null;
  const departments: { id?: string; name: string }[] = departmentsQuery.data ?? [];
  const loading = athletesQuery.isLoading || profileQuery.isLoading;
  const fetching =
    (athletesQuery.isFetching || profileQuery.isFetching) && !loading;
  const backgroundError = athletesQuery.isRefetchError || profileQuery.isRefetchError;
  const retryAll = () => {
    athletesQuery.refetch();
    profileQuery.refetch();
  };

  const updateProfile = useUpdateCoachProfile();
  const removeFromRoster = useRemoveAthleteFromRoster();
  const savingSport = updateProfile.isPending;

  // The coach's sports, tolerating older profiles that only have a single `sport`.
  const coachSports: string[] =
    coachProfile?.sports && coachProfile.sports.length > 0
      ? coachProfile.sports
      : coachProfile?.sport
        ? [coachProfile.sport]
        : [];
  const hasSetUpSport = coachSports.length > 0;

  const toggleSportDraft = (sport: string) =>
    setSportsDraft((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport],
    );

  const openSetup = () => {
    setSportsDraft(coachSports);
    setDepartmentDraft(coachProfile?.department || '');
    setGenderCategoryDraft(coachProfile?.genderCategory || '');
    setSetupOpen(true);
  };

  const handleSaveSport = async () => {
    if (!departmentDraft) { toast.error('Please select your department'); return; }
    if (sportsDraft.length === 0) { toast.error('Please select at least one sport'); return; }
    if (!genderCategoryDraft) { toast.error('Please select a gender category'); return; }
    try {
      await updateProfile.mutateAsync({
        sports: sportsDraft,
        department: departmentDraft,
        genderCategory: genderCategoryDraft,
      });
      setSetupOpen(false);
      toast.success(sportsDraft.length > 1 ? 'Sports updated' : 'Sport class updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    }
  };

  const copyCode = async () => {
    if (!coachProfile?.enrollmentCode) return;
    await navigator.clipboard.writeText(coachProfile.enrollmentCode);
    setCodeCopied(true);
    toast.success('Enrollment code copied!');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeFromRoster.mutateAsync(removeTarget.id);
      toast.success(`${removeTarget.firstName} ${removeTarget.lastName} removed from roster`);
      setRemoveTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove athlete');
    }
  };

  const filtered = athletes.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      a.firstName.toLowerCase().includes(q) ||
      a.lastName.toLowerCase().includes(q) ||
      (a.studentId || '').toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor = (s: string) =>
    s === 'active' ? 'bg-green-100 text-green-800' :
    s === 'injured' ? 'bg-red-100 text-red-800' :
    'bg-gray-100 text-gray-800';

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">

      {/* ── Sport Class Header ─────────────────────────────────────── */}
      <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {hasSetUpSport ? `${coachSports.join(' & ')} Team` : 'My Sport Team'}
                  </h1>
                  {!hasSetUpSport && (
                    <Badge className="bg-amber-100 text-amber-800 text-xs">Setup required</Badge>
                  )}
                  {coachSports.length > 1 && (
                    <Badge className="bg-primary/10 text-primary text-xs">
                      {coachSports.length} sports
                    </Badge>
                  )}
                </div>
                <p className="text-gray-500 text-sm">Coach {user.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Enrollment Code */}
              {coachProfile?.enrollmentCode && hasSetUpSport && (
                <div className="flex items-center gap-2 bg-white border-2 border-dashed border-primary/40 rounded-xl px-4 py-2">
                  <div>
                    <p className="text-xs text-gray-500 font-medium leading-none mb-0.5">Enrollment Code</p>
                    <p className="text-2xl font-black tracking-widest text-primary font-mono">
                      {coachProfile.enrollmentCode}
                    </p>
                  </div>
                  <button
                    onClick={copyCode}
                    className="ml-2 p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                    title="Copy code"
                  >
                    {codeCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-primary" />}
                  </button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={openSetup}>
                <Settings className="h-4 w-4 mr-2" />
                {hasSetUpSport ? 'Change Sports' : 'Set Up Sports'}
              </Button>
            </div>
          </div>

          {/* Setup prompt */}
          {!hasSetUpSport && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Set the sport(s) you coach to activate the enrollment code. Athletes use this code to join your team.</span>
            </div>
          )}

          {hasSetUpSport && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <BookOpen className="h-4 w-4 inline mr-1.5 mb-0.5" />
              Share the code <strong className="font-mono">{coachProfile?.enrollmentCode}</strong> with your athletes. They log in and enter it on their dashboard to join your {coachSports.join(' / ')} team.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Page actions ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">Athlete Roster</h2>
            <RefreshStatus fetching={fetching} error={backgroundError} onRetry={retryAll} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">Athletes enrolled in your class</p>
        </div>
        <div className="flex gap-2">
          <Link to="/coach/athletes/new">
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />Add Manually
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: athletes.length, color: 'text-gray-900' },
          { label: 'Active', value: athletes.filter(a => a.status === 'active').length, color: 'text-green-600' },
          { label: 'Injured', value: athletes.filter(a => a.status === 'injured').length, color: 'text-red-600' },
          { label: 'Inactive', value: athletes.filter(a => a.status === 'inactive').length, color: 'text-gray-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-gray-500">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, student ID, or email…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {(['all','active','injured','inactive'] as const).map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(s)}
                  className="capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Athlete List ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Athletes ({filtered.length})</CardTitle>
          <CardDescription>
            {searchQuery || statusFilter !== 'all' ? 'Filtered results' : 'All athletes in your class'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading roster…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600 font-medium mb-1">
                {searchQuery || statusFilter !== 'all' ? 'No athletes match your filters' : 'Your roster is empty'}
              </p>
              <p className="text-sm text-gray-400 mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search'
                  : hasSetUpSport
                  ? `Share code "${coachProfile?.enrollmentCode}" so athletes can self-enroll, or add them manually.`
                  : 'Set up your sport(s) first, then share the enrollment code.'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <div className="flex justify-center gap-2">
                  {!hasSetUpSport && (
                    <Button onClick={openSetup}>Set Up Sports</Button>
                  )}
                  <Link to="/coach/athletes/new">
                    <Button variant="outline"><UserPlus className="h-4 w-4 mr-2" />Add Manually</Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Athlete</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 hidden md:table-cell">Student ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 hidden md:table-cell">Department</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 hidden lg:table-cell">Year</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 hidden sm:table-cell">Joined via</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(athlete => (
                    <tr key={athlete.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{athlete.firstName} {athlete.lastName}</div>
                        <div className="text-xs text-gray-500">{athlete.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono hidden md:table-cell text-gray-600">
                        {athlete.studentId || <span className="text-gray-300 italic">not set</span>}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-gray-600">{athlete.department || '—'}</td>
                      <td className="py-3 px-4 hidden lg:table-cell text-gray-600">{athlete.yearLevel || '—'}</td>
                      <td className="py-3 px-4">
                        <Badge className={statusColor(athlete.status)}>{athlete.status}</Badge>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        {athlete.enrolledViaCode ? (
                          <Badge className="bg-blue-100 text-blue-800">Self-enrolled</Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-800">Manual</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <Link to={`/coach/athletes/${athlete.id}`}>
                            <Button variant="ghost" size="sm" title="View profile">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link to={`/coach/athletes/${athlete.id}/edit`}>
                            <Button variant="ghost" size="sm" title="Edit profile">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost" size="sm"
                            className="text-red-500 hover:text-red-700"
                            title="Remove from roster"
                            onClick={() => setRemoveTarget(athlete)}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sport Setup Dialog ─────────────────────────────────────── */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sport Class Setup</DialogTitle>
            <DialogDescription>
              Choose your department and the sport(s) you coach for it. Only athletes
              from your department can join with your enrollment code.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Label className="mb-2 block">Department <span className="text-red-500">*</span></Label>
            <Select value={departmentDraft} onValueChange={setDepartmentDraft}>
              <SelectTrigger>
                <SelectValue placeholder="Select your department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id || d.name} value={d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="py-2">
            <Label className="mb-2 block">
              Sports <span className="text-red-500">*</span>
              {sportsDraft.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-gray-400">
                  ({sportsDraft.length} selected)
                </span>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {SPORTS.map((s) => {
                const selected = sportsDraft.includes(s);
                return (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => toggleSportDraft(s)}
                  >
                    {selected && <Check className="h-3.5 w-3.5 mr-1.5 shrink-0" />}
                    <span className="truncate">{s}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="py-2">
            <Label className="mb-2 block">Gender Category <span className="text-red-500">*</span></Label>
            <Select value={genderCategoryDraft} onValueChange={setGenderCategoryDraft}>
              <SelectTrigger>
                <SelectValue placeholder="Select gender category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Men">Men's</SelectItem>
                <SelectItem value="Women">Women's</SelectItem>
                <SelectItem value="Men & Women">Men & Women's</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSport} disabled={savingSport || !departmentDraft || sportsDraft.length === 0 || !genderCategoryDraft}>
              {savingSport ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove Confirm Dialog ──────────────────────────────────── */}
      <Dialog open={!!removeTarget} onOpenChange={open => { if (!open) setRemoveTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove from Roster</DialogTitle>
            <DialogDescription>
              Remove <strong>{removeTarget?.firstName} {removeTarget?.lastName}</strong> from your class?
              {removeTarget?.enrolledViaCode
                ? ' Since they self-enrolled, they will need to re-enter your code to rejoin.'
                : ' The athlete record will be permanently deleted.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

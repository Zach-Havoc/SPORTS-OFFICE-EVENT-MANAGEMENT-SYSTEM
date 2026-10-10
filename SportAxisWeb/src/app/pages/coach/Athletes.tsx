import { StatStrip } from '../../components/page/StatStrip';
import { useCallback, useEffect, useMemo, useState, memo } from 'react';
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
  useCategories,
  useCoachProfile,
  useDepartments,
  useRemoveAthleteFromRoster,
  useUpdateCoachProfile,
} from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';
import { TableRowsSkeleton } from '../../components/ListSkeleton';

/** Common sports, offered alongside whatever the office set up in Settings → Sports. */
const COMMON_SPORTS = [
  'Basketball','Volleyball','Badminton','Swimming','Track & Field',
  'Table Tennis','Football','Tennis','Sepak Takraw','Arnis',
  'Softball','Baseball','Chess','Gymnastics','Boxing','Weightlifting',
];

interface Athlete {
  id: string;
  userId?: string | null;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  yearLevel: string;
  course: string;
  sport?: string;
  /** From the athlete's account: Male / Female — which division they play in. */
  gender?: string | null;
  jerseyNumber?: string | null;
  coachId: string;
  status: 'active' | 'inactive' | 'injured';
  enrolledViaCode?: boolean;
  enrolledAt?: string;
  emergencyContact?: { name: string; relationship: string; phone: string };
  createdAt: string;
}

/** "Men's" / "Women's", from the athlete's sex; null when it isn't on file. */
const divisionOf = (a: Athlete): 'Men' | 'Women' | null =>
  a.gender === 'Male' ? 'Men' : a.gender === 'Female' ? 'Women' : null;

const statusColor = (s: string) =>
  s === 'active' ? 'bg-green-100 text-green-800' :
  s === 'injured' ? 'bg-red-100 text-red-800' :
  'bg-gray-100 text-gray-800';

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
  const [sportFilter, setSportFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState<'all' | 'Men' | 'Women'>('all');
  const [codeCopied, setCodeCopied] = useState(false);

  // Sport setup dialog
  const [setupOpen, setSetupOpen] = useState(false);
  const [sportsDraft, setSportsDraft] = useState<string[]>([]);
  const [departmentDraft, setDepartmentDraft] = useState('');
  const [genderCategoryDraft, setGenderCategoryDraft] = useState('');
  // Why the server refused the setup (e.g. the college already has a coach
  // for that sport). Shown in the dialog: toasts are silent in the build.
  const [setupError, setSetupError] = useState('');

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
  const categoriesQuery = useCategories();
  // The office's sports first (Settings → Sports, divisions left out), then
  // the common ones, plus anything this coach already has.
  const sportChoices = useMemo(() => {
    const office = (categoriesQuery.data ?? [])
      .filter((c: { parentId?: string | null }) => !c.parentId)
      .map((c: { name: string }) => c.name);
    const mine = coachProfile?.sports ?? (coachProfile?.sport ? [coachProfile.sport] : []);
    return [...new Set([...office, ...COMMON_SPORTS, ...mine])];
  }, [categoriesQuery.data, coachProfile]);
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
    setSetupError('');
    setSportsDraft(coachSports);
    setDepartmentDraft(coachProfile?.department || '');
    setGenderCategoryDraft(coachProfile?.genderCategory || '');
    setSetupOpen(true);
  };

  const handleSaveSport = async () => {
    if (!departmentDraft) { toast.error('Please select your department'); return; }
    if (sportsDraft.length === 0) { toast.error('Please select at least one sport'); return; }
    if (!genderCategoryDraft) { toast.error('Please select a sex category'); return; }
    setSetupError('');
    try {
      await updateProfile.mutateAsync({
        sports: sportsDraft,
        department: departmentDraft,
        genderCategory: genderCategoryDraft,
      });
      setSetupOpen(false);
      toast.success(sportsDraft.length > 1 ? 'Sports updated' : 'Sport class updated');
    } catch (err: any) {
      setSetupError(err?.message || 'Failed to save');
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

  // The sports on this roster, with head counts — the filter only shows when there's a choice.
  const rosterSports = useMemo(() => {
    const counts = new Map<string, number>();
    athletes.forEach((a) => a.sport && counts.set(a.sport, (counts.get(a.sport) ?? 0) + 1));
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [athletes]);
  const bothDivisions = athletes.some((a) => divisionOf(a) === 'Men') && athletes.some((a) => divisionOf(a) === 'Women');
  const filtering = !!searchQuery || statusFilter !== 'all' || sportFilter !== 'all' || divisionFilter !== 'all';

  const filtered = athletes.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      a.firstName.toLowerCase().includes(q) ||
      a.lastName.toLowerCase().includes(q) ||
      (a.studentId || '').toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.sport || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchSport = sportFilter === 'all' || a.sport === sportFilter;
    const matchDivision = divisionFilter === 'all' || divisionOf(a) === divisionFilter;
    return matchSearch && matchStatus && matchSport && matchDivision;
  });

  const handleRemoveClick = useCallback((athlete: Athlete) => setRemoveTarget(athlete), []);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">

      {/* ── Sport Class Header ─────────────────────────────────────── */}
      <Card className="mb-8 border-primary/25 bg-accent/40">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="t-page-title">
                    {hasSetUpSport ? `${coachSports.join(' & ')} Team` : 'My Sport Team'}
                  </h1>
                  {!hasSetUpSport && (
                    <Badge variant="warning" className="text-xs">Setup required</Badge>
                  )}
                  {coachSports.length > 1 && (
                    <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                      {coachSports.length} sports
                    </Badge>
                  )}
                </div>
                <p className="t-page-lede">Coach {user.name}</p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              {/* Enrollment Code */}
              {coachProfile?.enrollmentCode && hasSetUpSport && (
                <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-card px-4 py-2 sm:w-auto sm:justify-start">
                  <div>
                    <p className="t-label mb-0.5 leading-none">Enrollment Code</p>
                    <p className="numeral text-2xl tracking-[0.18em] text-primary">
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
              <Button variant="secondary" size="sm" onClick={openSetup}>
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
            <div className="mt-4 rounded-md border border-primary/15 bg-card/70 p-3 text-sm text-foreground">
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
      <StatStrip
        stats={[
          { label: 'Total', value: athletes.length },
          { label: 'Active', value: athletes.filter(a => a.status === 'active').length },
          { label: 'Injured', value: athletes.filter(a => a.status === 'injured').length },
          { label: 'Inactive', value: athletes.filter(a => a.status === 'inactive').length },
        ]}
      />

      {/* ── Filters ───────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, student ID, email, or sport…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {rosterSports.length > 1 && (
              <Select value={sportFilter} onValueChange={setSportFilter}>
                <SelectTrigger className="md:w-52" aria-label="Filter by sport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sports ({athletes.length})</SelectItem>
                  {rosterSports.map(([sport, n]) => (
                    <SelectItem key={sport} value={sport}>{sport} ({n})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {bothDivisions && (
              <Select value={divisionFilter} onValueChange={(v) => setDivisionFilter(v as 'all' | 'Men' | 'Women')}>
                <SelectTrigger className="md:w-40" aria-label="Filter by division">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Men's &amp; Women's</SelectItem>
                  <SelectItem value="Men">Men's</SelectItem>
                  <SelectItem value="Women">Women's</SelectItem>
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              {(['all','active','injured','inactive'] as const).map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? 'primary' : 'secondary'}
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
            {filtering ? 'Filtered results' : 'All athletes in your class'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableRowsSkeleton rows={6} columns={6} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600 font-medium mb-1">
                {filtering ? 'No athletes match your filters' : 'Your roster is empty'}
              </p>
              <p className="mb-4 text-sm text-muted-foreground">
                {filtering
                  ? 'Try adjusting your search'
                  : hasSetUpSport
                  ? `Share code "${coachProfile?.enrollmentCode}" so athletes can self-enroll, or add them manually.`
                  : 'Set up your sport(s) first, then share the enrollment code.'}
              </p>
              {!filtering && (
                <div className="flex justify-center gap-2">
                  {!hasSetUpSport && (
                    <Button onClick={openSetup}>Set Up Sports</Button>
                  )}
                  <Link to="/coach/athletes/new">
                    <Button variant="secondary"><UserPlus className="h-4 w-4 mr-2" />Add Manually</Button>
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
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Sport</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 hidden md:table-cell">Student ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 hidden md:table-cell">College</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 hidden lg:table-cell">Year</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 hidden sm:table-cell">Joined via</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(athlete => (
                    <AthleteRow key={athlete.id} athlete={athlete} onRemove={handleRemoveClick} />
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
            <Label className="mb-2 block">College <span className="text-red-500">*</span></Label>
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
              {sportChoices.map((s) => {
                const selected = sportsDraft.includes(s);
                return (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={selected ? 'primary' : 'secondary'}
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
            <Label className="mb-2 block">Sex Category <span className="text-red-500">*</span></Label>
            <Select value={genderCategoryDraft} onValueChange={setGenderCategoryDraft}>
              <SelectTrigger>
                <SelectValue placeholder="Select sex category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Men">Men's</SelectItem>
                <SelectItem value="Women">Women's</SelectItem>
                <SelectItem value="Men & Women">Men & Women's</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {setupError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {setupError}
            </p>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setSetupOpen(false)}>Cancel</Button>
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
            <Button variant="secondary" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// A full roster can run into dozens of rows; memoized so filtering/sorting
// elsewhere on the page (or opening a dialog) doesn't re-render every row.
const AthleteRow = memo(function AthleteRow({
  athlete,
  onRemove,
}: {
  athlete: Athlete;
  onRemove: (athlete: Athlete) => void;
}) {
  return (
    <tr className="border-b hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="font-medium text-gray-900">{athlete.firstName} {athlete.lastName}</div>
        <div className="text-xs text-gray-500">{athlete.email}</div>
      </td>
      <td className="py-3 px-4">
        {athlete.sport ? (
          <div className="space-y-0.5">
            <Badge variant="brand">{athlete.sport}</Badge>
            <div className="text-xs text-gray-500 whitespace-nowrap">
              {[divisionOf(athlete) && `${divisionOf(athlete)}'s`, athlete.jerseyNumber && `#${athlete.jerseyNumber}`].filter(Boolean).join(' · ')}
            </div>
          </div>
        ) : (
          <span className="text-gray-300 italic">not set</span>
        )}
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
          <Badge variant="info">Self-enrolled</Badge>
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
            onClick={() => onRemove(athlete)}
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
});

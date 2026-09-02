import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  useUsers,
  useDepartments,
  useCategories,
  useUpdateUser,
  useSetUserActive,
  useResetUserPassword,
  useDeleteUser,
} from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Badge } from '../../components/ui/badge';
import {
  Users as UsersIcon,
  Search,
  X,
  Pencil,
  KeyRound,
  Power,
  Trash2,
  Copy,
  ShieldAlert,
  Gavel,
  GraduationCap,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../../components/Loading';
import {
  filterUsers,
  summarizeUsers,
  roleLabel,
  hasDependents,
  EMPTY_FILTERS,
  type ManagedUser,
  type UserFilters,
  type UserRole,
} from '../../utils/users';

const NONE = '__none__';
const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-800',
  coach: 'bg-purple-100 text-purple-800',
  judge: 'bg-blue-100 text-blue-800',
  athlete: 'bg-emerald-100 text-emerald-800',
};

interface EditDraft {
  name: string;
  email: string;
  role: UserRole;
  department: string;
  sport: string;
  genderCategory: string;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') navigate('/login');
  }, [user, navigate]);

  const usersQuery = useUsers();
  const departmentsQuery = useDepartments();
  const categoriesQuery = useCategories();

  const updateMut = useUpdateUser();
  const activeMut = useSetUserActive();
  const resetMut = useResetUserPassword();
  const deleteMut = useDeleteUser();

  const [filters, setFilters] = useState<UserFilters>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [toggling, setToggling] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);

  const allUsers: ManagedUser[] = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const visible = useMemo(() => filterUsers(allUsers, filters), [allUsers, filters]);
  const stats = useMemo(() => summarizeUsers(allUsers), [allUsers]);

  const departments: any[] = departmentsQuery.data ?? [];
  const sports: string[] = useMemo(
    () => (categoriesQuery.data ?? []).map((c: any) => c.name).filter(Boolean),
    [categoriesQuery.data],
  );

  const hasFilters =
    filters.search.trim() !== '' || filters.role !== 'all' || filters.status !== 'all';

  const openEdit = (u: ManagedUser) => {
    setEditing(u);
    setDraft({
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department || NONE,
      sport: u.sport || NONE,
      genderCategory: u.genderCategory || NONE,
    });
  };

  const submitEdit = async () => {
    if (!editing || !draft) return;
    try {
      await updateMut.mutateAsync({
        id: editing.id,
        data: {
          name: draft.name.trim(),
          email: draft.email.trim(),
          role: draft.role,
          department: draft.department === NONE ? null : draft.department,
          sport: draft.sport === NONE ? null : draft.sport,
          genderCategory: draft.genderCategory === NONE ? null : draft.genderCategory,
        },
      });
      toast.success('Account updated');
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    }
  };

  const submitReset = async () => {
    if (!resetting) return;
    try {
      const res = await resetMut.mutateAsync({
        id: resetting.id,
        password: resetPw.trim() || undefined,
      });
      setTempPw(res.tempPassword);
      toast.success('Password reset');
    } catch (e: any) {
      toast.error(e.message || 'Reset failed');
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    const next = !toggling.active;
    try {
      await activeMut.mutateAsync({ id: toggling.id, active: next });
      toast.success(next ? 'Account enabled' : 'Account disabled');
      setToggling(null);
    } catch (e: any) {
      toast.error(e.message || 'Change failed');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      toast.success('Account deleted');
      setDeleting(null);
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    }
  };

  if (usersQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading accounts..." />
      </div>
    );
  }

  const isSelf = (u: ManagedUser) => u.id === user?.id;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <RefreshStatus
            fetching={usersQuery.isFetching && !usersQuery.isLoading}
            error={usersQuery.isRefetchError}
            onRetry={() => usersQuery.refetch()}
          />
        </div>
        <p className="text-gray-500 mt-1">
          Every account across all roles. Accounts are created from{' '}
          <Link to="/admin/registration-codes" className="text-red-600 hover:underline">
            Registration Codes
          </Link>
          ; here you edit, reset, disable, or remove them.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, tone: 'text-gray-900' },
          { label: 'Admins', value: stats.admins, tone: 'text-red-600' },
          { label: 'Coaches', value: stats.coaches, tone: 'text-purple-600' },
          { label: 'Committees', value: stats.committees, tone: 'text-blue-600' },
          { label: 'Athletes', value: stats.athletes, tone: 'text-emerald-600' },
          { label: 'Disabled', value: stats.inactive, tone: 'text-gray-500' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4 text-center">
              <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or email"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="h-10 pl-9"
              aria-label="Search accounts"
            />
          </div>
          <div className="flex gap-3">
            <Select
              value={filters.role}
              onValueChange={(v) => setFilters((f) => ({ ...f, role: v as UserFilters['role'] }))}
            >
              <SelectTrigger className="h-10 w-full sm:w-40" aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="judge">Committee</SelectItem>
                <SelectItem value="athlete">Athlete</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters((f) => ({ ...f, status: v as UserFilters['status'] }))}
            >
              <SelectTrigger className="h-10 w-full sm:w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Showing <span className="font-medium text-gray-700">{visible.length}</span> of{' '}
            {allUsers.length}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <UsersIcon className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">No accounts match your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((u) => (
            <Card key={u.id} className={u.active ? '' : 'bg-gray-50 border-gray-200'}>
              <CardContent className="py-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 truncate">{u.name}</span>
                      <Badge className={ROLE_BADGE[u.role]}>{roleLabel(u.role)}</Badge>
                      {!u.active && (
                        <Badge variant="outline" className="border-gray-300 text-gray-500">
                          Disabled
                        </Badge>
                      )}
                      {isSelf(u) && (
                        <Badge variant="outline" className="border-red-200 text-red-600">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 truncate">{u.email}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {u.department && (
                        <span className="inline-flex items-center gap-1">
                          <GraduationCap className="h-3.5 w-3.5" />
                          {u.department}
                        </span>
                      )}
                      {(u.sports?.length ? u.sports.join(', ') : u.sport) && (
                        <span className="inline-flex items-center gap-1">
                          <Trophy className="h-3.5 w-3.5" />
                          {u.sports?.length ? u.sports.join(', ') : u.sport}
                        </span>
                      )}
                      {u.role === 'coach' && (
                        <span>{u.links.athleteCount} athlete{u.links.athleteCount === 1 ? '' : 's'}</span>
                      )}
                      {u.role === 'judge' && (
                        <span className="inline-flex items-center gap-1">
                          <Gavel className="h-3.5 w-3.5" />
                          {u.links.assignedEventCount} event{u.links.assignedEventCount === 1 ? '' : 's'} ·{' '}
                          {u.links.scoreCount} score{u.links.scoreCount === 1 ? '' : 's'}
                        </span>
                      )}
                      {u.links.registrationCode && (
                        <span className="font-mono text-gray-400">{u.links.registrationCode}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResetting(u);
                        setResetPw('');
                        setTempPw(null);
                      }}
                    >
                      <KeyRound className="h-4 w-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Reset</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSelf(u)}
                      onClick={() => setToggling(u)}
                      title={isSelf(u) ? 'You cannot disable your own account' : undefined}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      disabled={isSelf(u) || hasDependents(u)}
                      onClick={() => setDeleting(u)}
                      title={
                        isSelf(u)
                          ? 'You cannot delete your own account'
                          : hasDependents(u)
                            ? 'Reassign this account’s records first'
                            : undefined
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="u-name">Name</Label>
                <Input
                  id="u-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-email">Email</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={draft.role}
                  onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}
                  disabled={editing ? isSelf(editing) : false}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="judge">Committee</SelectItem>
                    <SelectItem value="athlete">Athlete</SelectItem>
                  </SelectContent>
                </Select>
                {editing && isSelf(editing) && (
                  <p className="text-xs text-gray-500">You cannot change your own role.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>College</Label>
                <Select
                  value={draft.department}
                  onValueChange={(v) => setDraft({ ...draft, department: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Sport</Label>
                  <Select value={draft.sport} onValueChange={(v) => setDraft({ ...draft, sport: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {sports.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={draft.genderCategory}
                    onValueChange={(v) => setDraft({ ...draft, genderCategory: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      <SelectItem value="Men">Men</SelectItem>
                      <SelectItem value="Women">Women</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={updateMut.isPending}>
              {updateMut.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog
        open={!!resetting}
        onOpenChange={(o) => {
          if (!o) {
            setResetting(null);
            setTempPw(null);
            setResetPw('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>{resetting?.email}</DialogDescription>
          </DialogHeader>

          {tempPw ? (
            <div className="py-2 space-y-3">
              <p className="text-sm text-gray-600">
                Hand this temporary password to the user. It is shown once. They should change it
                after signing in.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-gray-100 px-3 py-2 font-mono text-sm">
                  {tempPw}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPw);
                    toast.success('Copied');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-2 space-y-2">
              <Label htmlFor="reset-pw">New password (optional)</Label>
              <Input
                id="reset-pw"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="Leave blank to auto-generate"
              />
              <p className="text-xs text-gray-500">
                Minimum 8 characters. This also signs the user out everywhere.
              </p>
            </div>
          )}

          <DialogFooter>
            {tempPw ? (
              <Button
                onClick={() => {
                  setResetting(null);
                  setTempPw(null);
                  setResetPw('');
                }}
              >
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setResetting(null)}>
                  Cancel
                </Button>
                <Button onClick={submitReset} disabled={resetMut.isPending}>
                  {resetMut.isPending ? 'Resetting...' : 'Reset password'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enable / disable */}
      <AlertDialog open={!!toggling} onOpenChange={(o) => !o && setToggling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggling?.active ? 'Disable this account?' : 'Enable this account?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggling?.active
                ? `${toggling?.name} will be blocked at login and signed out everywhere. Their history is kept.`
                : `${toggling?.name} will be able to sign in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle}>
              {toggling?.active ? 'Disable' : 'Enable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Delete this account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name} ({deleting?.email}) will be permanently removed. This cannot be
              undone. Prefer disabling if you may need the record later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

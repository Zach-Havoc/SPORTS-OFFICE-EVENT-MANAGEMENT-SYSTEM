import { EmptyState } from '../../components/page/EmptyState';
import { TableFrame, DataTable, Th, Tr, Td, RowActions } from '../../components/page/DataTable';
import { PageHeader } from '../../components/page/PageHeader';
import { StatStrip } from '../../components/page/StatStrip';
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

interface EditDraft {
  name: string;
  email: string;
  role: UserRole;
  department: string;
  sports: string[];
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
  // Only real sports here — racquet "line" categories (parentSport set) are an
  // internal bracket concept, never something you assign a coach or judge to.
  const sports: string[] = useMemo(
    () =>
      (categoriesQuery.data ?? [])
        .filter((c: any) => !c.parentSport)
        .map((c: any) => c.name)
        .filter(Boolean),
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
      sports: u.sports?.length ? u.sports : u.sport ? [u.sport] : [],
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
          sports: draft.sports,
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
      <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading accounts..." />
      </div>
    );
  }

  const isSelf = (u: ManagedUser) => u.id === user?.id;

  return (
    <div className="page-container px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="User Management"
        description={
          <>
            Every account across all roles. Accounts are created from{' '}
            <Link to="/admin/registration-codes" className="text-primary underline-offset-4 hover:underline">
              Registration Codes
            </Link>
            ; here you edit, reset, disable, or remove them.
          </>
        }
        actions={
          <RefreshStatus
            fetching={usersQuery.isFetching && !usersQuery.isLoading}
            error={usersQuery.isRefetchError}
            onRetry={() => usersQuery.refetch()}
          />
        }
      />

      <StatStrip
        stats={[
          { label: 'Total', value: stats.total },
          { label: 'Admins', value: stats.admins },
          { label: 'Coaches', value: stats.coaches },
          { label: 'Committees', value: stats.committees },
          { label: 'Athletes', value: stats.athletes },
          { label: 'Disabled', value: stats.inactive },
        ]}
      />

      {/* Filters */}
      <div className="mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
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
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className="t-caption">
            Showing <span className="font-medium text-text">{visible.length}</span> of{' '}
            {allUsers.length}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <TableFrame>
          <EmptyState
            icon={UsersIcon}
            title={
              hasFilters
                ? 'No accounts match these filters'
                : 'No accounts yet'
            }
            description={
              hasFilters
                ? 'Try a broader role or status, or clear the filters to see everyone.'
                : 'Accounts appear here once someone signs up with a registration code.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link to="/admin/registration-codes">Manage registration codes</Link>
                </Button>
              )
            }
          />
        </TableFrame>
      ) : (
        <TableFrame>
          <DataTable>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th className="hidden lg:table-cell">College &amp; sport</Th>
                <Th className="hidden md:table-cell">Activity</Th>
                <Th align="right" className="w-px whitespace-nowrap">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const sport = u.sports?.length ? u.sports.join(', ') : u.sport;
                return (
                  <Tr key={u.id} className={u.active ? undefined : 'opacity-70'}>
                    <Td>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-text">{u.name}</span>
                        <Badge variant="neutral">{roleLabel(u.role)}</Badge>
                        {isSelf(u) && <Badge variant="brand">You</Badge>}
                        {!u.active && <Badge variant="outline">Disabled</Badge>}
                      </div>
                      <div className="t-caption mt-0.5 truncate">{u.email}</div>
                      {/* Below lg the detail columns collapse into the name cell
                          rather than being dropped, so nothing becomes unreachable. */}
                      <div className="t-caption mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 lg:hidden">
                        {u.department && <span>{u.department}</span>}
                        {sport && <span>{sport}</span>}

                      </div>
                    </Td>

                    <Td className="hidden lg:table-cell">
                      <div className="text-[0.8125rem] text-text-secondary">
                        {u.department || <span className="sr-only">No college set</span>}
                      </div>
                      {sport && <div className="t-caption mt-0.5">{sport}</div>}
                    </Td>

                    <Td className="hidden md:table-cell text-[0.8125rem] text-text-secondary">
                      {u.role === 'coach' ? (
                        <>
                          {u.links.athleteCount} athlete{u.links.athleteCount === 1 ? '' : 's'}
                        </>
                      ) : u.role === 'judge' ? (
                        <>
                          {u.links.assignedEventCount} event
                          {u.links.assignedEventCount === 1 ? '' : 's'} ·{' '}
                          {u.links.scoreCount} score{u.links.scoreCount === 1 ? '' : 's'}
                        </>
                      ) : u.links.registrationCode ? (
                        <span className="t-caption">{u.links.registrationCode}</span>
                      ) : null}
                    </Td>

                    <Td align="right" className="whitespace-nowrap">
                      <RowActions>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => openEdit(u)}
                          aria-label={`Edit ${u.name}`}
                          title="Edit"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Reset password for ${u.name}`}
                          title="Reset password"
                          onClick={() => {
                            setResetting(u);
                            setResetPw('');
                            setTempPw(null);
                          }}
                        >
                          <KeyRound className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={isSelf(u)}
                          onClick={() => setToggling(u)}
                          aria-label={u.active ? `Disable ${u.name}` : `Enable ${u.name}`}
                          title={isSelf(u) ? 'You cannot disable your own account' : u.active ? 'Disable' : 'Enable'}
                        >
                          <Power className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger-subtle hover:text-danger-text"
                          disabled={isSelf(u) || hasDependents(u)}
                          onClick={() => setDeleting(u)}
                          aria-label={`Delete ${u.name}`}
                          title={
                            isSelf(u)
                              ? 'You cannot delete your own account'
                              : hasDependents(u)
                                ? 'Reassign this account\u2019s records first'
                                : 'Delete'
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </RowActions>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        </TableFrame>
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
                  <p className="t-caption">You cannot change your own role.</p>
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
              <div className="space-y-2">
                <Label>Sport{draft.sports.length > 1 ? 's' : ''} <span className="font-normal text-gray-400">— pick one or more</span></Label>
                {draft.sports.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draft.sports.map((s) => (
                      <Badge key={s} variant="neutral" className="gap-1 pr-1">
                        {s}
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, sports: draft.sports.filter((x) => x !== s) })}
                          className="rounded-full p-0.5 hover:bg-gray-300/60"
                          aria-label={`Remove ${s}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Select
                  value=""
                  onValueChange={(v) => {
                    if (v && !draft.sports.includes(v)) setDraft({ ...draft, sports: [...draft.sports, v] });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={draft.sports.length ? 'Add another sport…' : 'Select sport'} />
                  </SelectTrigger>
                  <SelectContent>
                    {sports.filter((s) => !draft.sports.includes(s)).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                    {sports.every((s) => draft.sports.includes(s)) && (
                      <div className="px-2 py-1.5 text-xs text-gray-400">All sports added</div>
                    )}
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
                    <SelectItem value="Mixed">Men &amp; Women</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditing(null)}>
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
                  variant="secondary"
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
              <p className="t-caption">
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
                <Button variant="secondary" onClick={() => setResetting(null)}>
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
              <ShieldAlert className="h-5 w-5 text-destructive" />
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

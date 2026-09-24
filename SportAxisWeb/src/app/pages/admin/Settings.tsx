import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getDepartments, getCategories, createDepartment, updateDepartment, deleteDepartment, uploadDepartmentLogo, deleteDepartmentLogo, createCategory, updateCategory, deleteCategory } from '../../services/api';
import { useCampusStudents, useImportCampusStudents } from '../../hooks/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Plus, Pencil, Trash2, Users, Tag, GraduationCap, Upload, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../../components/Loading';

interface Department {
  id: string;
  name: string;
  abbreviation: string;
  logoUrl?: string | null;
}

type SportFormat = 'versus' | 'ranked';

interface Category {
  id: string;
  name: string;
  description: string;
  format?: SportFormat;
}

export default function AdminSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Departments state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptFormData, setDeptFormData] = useState({ name: '', abbreviation: '' });
  
  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catFormData, setCatFormData] = useState<{ name: string; description: string; format: SportFormat }>({ name: '', description: '', format: 'versus' });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      const [depts, cats] = await Promise.all([
        getDepartments(),
        getCategories()
      ]);
      setDepartments(depts);
      setCategories(cats);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  // Department handlers
  const handleOpenDeptDialog = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptFormData({ name: dept.name, abbreviation: dept.abbreviation });
    } else {
      setEditingDept(null);
      setDeptFormData({ name: '', abbreviation: '' });
    }
    setDeptDialogOpen(true);
  };

  const handleSaveDepartment = async () => {
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, deptFormData);
        toast.success('College updated successfully');
      } else {
        await createDepartment(deptFormData);
        toast.success('College created successfully');
      }
      setDeptDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving department:', error);
      toast.error('Failed to save department');
    }
  };

  const [logoBusy, setLogoBusy] = useState(false);
  const handleLogoUpload = async (file: File) => {
    if (!editingDept) return;
    setLogoBusy(true);
    try {
      const updated = await uploadDepartmentLogo(editingDept.id, file);
      setEditingDept((d) => (d ? { ...d, logoUrl: updated.logoUrl } : d));
      toast.success('Logo updated');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Could not upload the logo');
    } finally {
      setLogoBusy(false);
    }
  };
  const handleLogoRemove = async () => {
    if (!editingDept) return;
    setLogoBusy(true);
    try {
      await deleteDepartmentLogo(editingDept.id);
      setEditingDept((d) => (d ? { ...d, logoUrl: null } : d));
      toast.success('Logo removed');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Could not remove the logo');
    } finally {
      setLogoBusy(false);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    
    try {
      await deleteDepartment(id);
      toast.success('College deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error('Failed to delete department');
    }
  };

  // Category handlers
  const handleOpenCatDialog = (cat?: Category) => {
    if (cat) {
      setEditingCat(cat);
      setCatFormData({ name: cat.name, description: cat.description, format: cat.format ?? 'versus' });
    } else {
      setEditingCat(null);
      setCatFormData({ name: '', description: '', format: 'versus' });
    }
    setCatDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, catFormData);
        toast.success('Sport updated');
      } else {
        await createCategory(catFormData);
        toast.success('Sport added');
      }
      setCatDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving sport:', error);
      toast.error('Failed to save sport');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this sport?')) return;

    try {
      await deleteCategory(id);
      toast.success('Sport deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting sport:', error);
      toast.error('Failed to delete sport');
    }
  };


  if (loading) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="t-page-title">System Settings</h1>
          <p className="text-gray-600 mt-2">Manage colleges and sports</p>
        </div>
      </div>

      <Tabs defaultValue="departments" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="departments">
            <Users className="h-4 w-4 mr-2" />
            Colleges
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-2" />
            Sports
          </TabsTrigger>
          <TabsTrigger value="students">
            <GraduationCap className="h-4 w-4 mr-2" />
            Students
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4">
          <CampusStudentsTab />
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Colleges</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Manage participating departments
                </p>
              </div>
              <Button onClick={() => handleOpenDeptDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add College
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <Card key={dept.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-1 items-center gap-3 min-w-0">
                          {dept.logoUrl ? (
                            <img src={dept.logoUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full object-cover border border-gray-200" />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
                              <Users className="h-4 w-4 text-blue-600" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{dept.name}</h3>
                            <p className="text-sm text-gray-600">{dept.abbreviation}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeptDialog(dept)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDepartment(dept.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {departments.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No colleges yet. Click "Add College" to create one.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Sports</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  The sports that events can be held in
                </p>
              </div>
              <Button onClick={() => handleOpenCatDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Sport
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <Card key={cat.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Tag className="h-4 w-4 text-green-600" />
                            <h3 className="font-semibold">{cat.name}</h3>
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              (cat.format ?? 'versus') === 'ranked'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {(cat.format ?? 'versus') === 'ranked' ? 'Ranked' : 'Versus'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{cat.description}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenCatDialog(cat)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(cat.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {categories.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No sports yet. Click "Add Sport" to create one.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Department Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept ? 'Edit College' : 'Add College'}
            </DialogTitle>
            <DialogDescription>
              {editingDept 
                ? 'Update the department name and abbreviation.' 
                : 'Create a new department for event participation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dept-name">College Name</Label>
              <Input
                id="dept-name"
                value={deptFormData.name}
                onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                placeholder="e.g., Computer Science"
              />
            </div>
            <div>
              <Label htmlFor="dept-abbr">Abbreviation</Label>
              <Input
                id="dept-abbr"
                value={deptFormData.abbreviation}
                onChange={(e) => setDeptFormData({ ...deptFormData, abbreviation: e.target.value })}
                placeholder="e.g., CS"
              />
            </div>

            <div>
              <Label>Logo</Label>
              <p className="text-xs text-gray-500 mb-2">Shown on the standings board. Square PNG/JPG works best.</p>
              {editingDept ? (
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 rounded-full border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                    {editingDept.logoUrl ? (
                      <img src={editingDept.logoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-gray-400">none</span>
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    {logoBusy ? 'Uploading…' : editingDept.logoUrl ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      disabled={logoBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {editingDept.logoUrl && (
                    <Button variant="ghost" size="sm" className="text-red-600" disabled={logoBusy} onClick={handleLogoRemove}>
                      Remove
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Create the college first, then reopen it to add a logo.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDepartment}>
              {editingDept ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCat ? 'Edit Sport' : 'Add Sport'}
            </DialogTitle>
            <DialogDescription>
              {editingCat
                ? 'Update the sport name and description.'
                : 'Add a sport that events can be held in.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cat-name">Sport Name</Label>
              <Input
                id="cat-name"
                value={catFormData.name}
                onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })}
                placeholder="e.g., Basketball"
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={catFormData.description}
                onChange={(e) => setCatFormData({ ...catFormData, description: e.target.value })}
                placeholder="e.g., Athletic competitions"
              />
            </div>
            <div>
              <Label>Format</Label>
              <Select
                value={catFormData.format}
                onValueChange={(v: SportFormat) => setCatFormData({ ...catFormData, format: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="versus">Versus — two colleges per game</SelectItem>
                  <SelectItem value="ranked">Ranked — many colleges, placed</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Versus events must have exactly two colleges; run a pool through Bracketing. Ranked events
                (track, swimming, cultural) can have many.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory}>
              {editingCat ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * The registrar's enrolled-student roster. An athlete can only create an
 * account if their SR Code + name match a row here.
 */
function CampusStudentsTab() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const listQuery = useCampusStudents(debounced || undefined);
  const importMut = useImportCampusStudents();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await importMut.mutateAsync(file);
      toast.success(`Imported: ${r.added} added, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped` : ''}. ${r.total} students on file.`);
    } catch (e: any) {
      toast.error(e?.message || 'Import failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const students = listQuery.data?.students ?? [];
  const total = listQuery.data?.total ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Campus Students</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            The registrar's list of enrolled students. Athletes can only sign up if their
            SR Code and name match a row here.
          </p>
        </div>
        <div className="shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={importMut.isPending}>
            {importMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{total.toLocaleString()}</span> student{total === 1 ? '' : 's'} on file
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search SR Code or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          CSV needs at least <span className="font-medium">SR Code</span> and{' '}
          <span className="font-medium">Last Name</span> columns. Optional: First Name, Middle Name,
          Gender, College, Program, Year Level, Email. Re-importing updates rows by SR Code. Export
          from Excel as CSV.
        </p>

        {total === 0 && !listQuery.isLoading ? (
          <div className="text-center py-10 text-gray-500 border rounded-lg">
            No students imported yet. Click <span className="font-medium">Import CSV</span> to upload the registrar's list.
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-600">
                  <th className="py-2 px-3 font-semibold">SR Code</th>
                  <th className="py-2 px-3 font-semibold">Name</th>
                  <th className="py-2 px-3 font-semibold hidden sm:table-cell">Gender</th>
                  <th className="py-2 px-3 font-semibold hidden md:table-cell">College</th>
                  <th className="py-2 px-3 font-semibold hidden lg:table-cell">Year</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.srCode} className="border-b last:border-0">
                    <td className="py-2 px-3 font-mono text-gray-700">{s.srCode}</td>
                    <td className="py-2 px-3">{[s.lastName, s.firstName].filter(Boolean).join(', ')}{s.middleName ? ` ${s.middleName}` : ''}</td>
                    <td className="py-2 px-3 hidden sm:table-cell text-gray-600">{s.gender || '—'}</td>
                    <td className="py-2 px-3 hidden md:table-cell text-gray-600">{s.college || '—'}</td>
                    <td className="py-2 px-3 hidden lg:table-cell text-gray-600">{s.yearLevel || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 && debounced && (
              <div className="text-center py-6 text-gray-500">No match for “{debounced}”.</div>
            )}
            {students.length >= 100 && (
              <div className="text-center py-2 text-xs text-gray-400 border-t">Showing the first 100 — narrow with search.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
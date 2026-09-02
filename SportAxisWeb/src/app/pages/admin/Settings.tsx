import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getDepartments, getCategories, createDepartment, updateDepartment, deleteDepartment, createCategory, updateCategory, deleteCategory } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Plus, Pencil, Trash2, Users, Tag } from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../../components/Loading';

interface Department {
  id: string;
  name: string;
  abbreviation: string;
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
  const [resetting, setResetting] = useState(false);

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
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-gray-600 mt-2">Manage colleges and sports</p>
        </div>
      </div>

      {/* System Health & Reset Section - Hidden but functionality retained */}
      {/*
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-amber-900">System Health & Data Management</CardTitle>
          </div>
          <CardDescription className="text-amber-800">
            Reset demo data if you encounter "Event not found" errors or want fresh demo data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-gray-900 mb-2">⚠️ Reset Demo Data</h4>
              <p className="text-sm text-gray-600 mb-4">
                This will delete ALL existing data (events, scores, rankings, departments, categories) and create fresh demo data with new events. Use this if you're seeing "Event not found" errors.
              </p>
              <Button
                onClick={handleResetDemoData}
                disabled={resetting}
                variant="destructive"
                className="w-full sm:w-auto"
              >
                {resetting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset Demo Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      */}

      <Tabs defaultValue="departments" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="departments">
            <Users className="h-4 w-4 mr-2" />
            Colleges
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-2" />
            Sports
          </TabsTrigger>
        </TabsList>

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
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Users className="h-4 w-4 text-blue-600" />
                            <h3 className="font-semibold">{dept.name}</h3>
                          </div>
                          <p className="text-sm text-gray-600">{dept.abbreviation}</p>
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
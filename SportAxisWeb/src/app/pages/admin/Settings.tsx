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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Plus, Pencil, Trash2, Users, Tag } from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../../components/Loading';

interface Department {
  id: string;
  name: string;
  abbreviation: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
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
  const [catFormData, setCatFormData] = useState({ name: '', description: '' });
  
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
        toast.success('Department updated successfully');
      } else {
        await createDepartment(deptFormData);
        toast.success('Department created successfully');
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
      toast.success('Department deleted successfully');
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
      setCatFormData({ name: cat.name, description: cat.description });
    } else {
      setEditingCat(null);
      setCatFormData({ name: '', description: '' });
    }
    setCatDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, catFormData);
        toast.success('Category updated successfully');
      } else {
        await createCategory(catFormData);
        toast.success('Category created successfully');
      }
      setCatDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await deleteCategory(id);
      toast.success('Category deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
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
          <p className="text-gray-600 mt-2">Manage departments and event categories</p>
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
            Departments
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
        </TabsList>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Departments</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Manage participating departments
                </p>
              </div>
              <Button onClick={() => handleOpenDeptDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Department
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
                  No departments yet. Click "Add Department" to create one.
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
                <CardTitle>Event Categories</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Manage event categories and types
                </p>
              </div>
              <Button onClick={() => handleOpenCatDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
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
                  No categories yet. Click "Add Category" to create one.
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
              {editingDept ? 'Edit Department' : 'Add Department'}
            </DialogTitle>
            <DialogDescription>
              {editingDept 
                ? 'Update the department name and abbreviation.' 
                : 'Create a new department for event participation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dept-name">Department Name</Label>
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
              {editingCat ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCat 
                ? 'Update the category name and description.' 
                : 'Create a new category for events.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cat-name">Category Name</Label>
              <Input
                id="cat-name"
                value={catFormData.name}
                onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })}
                placeholder="e.g., Sports"
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
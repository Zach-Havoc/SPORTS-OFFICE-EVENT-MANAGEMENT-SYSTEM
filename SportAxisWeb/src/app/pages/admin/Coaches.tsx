import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getCoaches, updateCoachDepartment, getDepartments } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Trophy, Edit, User } from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../../components/Loading';

interface Coach {
  id: string;
  name: string;
  email: string;
  sport: string;
  department: string | null;
  departmentAbbreviation: string | null;
  gender: string | null;
  enrollmentCode: string;
}

export default function AdminCoaches() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [departmentDraft, setDepartmentDraft] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const loadData = async () => {
    try {
      console.log('Loading coaches...');
      const coachesData = await getCoaches();
      console.log('Coaches data:', coachesData);
      setCoaches(coachesData || []);
      console.log('Loading departments...');
      const deptData = await getDepartments();
      console.log('Departments data:', deptData);
      setDepartments(deptData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const NONE_VALUE = '__none__';

  const handleOpenDialog = (coach: Coach) => {
    console.log('Opening dialog for coach:', coach);
    setEditingCoach(coach);
    setDepartmentDraft(coach.department || NONE_VALUE);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingCoach) return;

    try {
      const data = (departmentDraft === '' || departmentDraft === '__none__')
        ? { department: null }
        : { department: departmentDraft };
      console.log('Updating coach department:', editingCoach.id, data);
      await updateCoachDepartment(editingCoach.id, data);
      toast.success('Coach department updated successfully');
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error updating coach:', error);
      toast.error(error.message || 'Failed to update coach');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading coaches..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Coach Management</h1>
        <p className="text-gray-500 mt-1">Manage coaches and their assigned departments</p>
      </div>

      {/* Coaches List */}
      <div className="space-y-4">
        {coaches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No coaches found.
            </CardContent>
          </Card>
        ) : (
          coaches.map(coach => (
            <Card key={coach.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-purple-100 text-purple-800">Coach</Badge>
                      {coach.sport && (
                        <Badge variant="outline">{coach.sport}</Badge>
                      )}
                      {coach.departmentAbbreviation && coach.gender && (
                        <Badge className="bg-blue-100 text-blue-800">
                          {coach.departmentAbbreviation} {coach.gender} Coach
                        </Badge>
                      )}
                      {coach.department && !coach.departmentAbbreviation && (
                        <Badge className="bg-blue-100 text-blue-800">{coach.department}</Badge>
                      )}
                    </div>
                    <CardTitle>{coach.name}</CardTitle>
                    <CardDescription className="mt-2">
                      <div className="text-sm text-gray-600">{coach.email}</div>
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDialog(coach)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Assign Department
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Trophy className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {coach.sport || 'No sport assigned'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {coach.department ? coach.department : 'No department assigned'}
                    </span>
                  </div>
                  {coach.enrollmentCode && (
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500">
                        Enrollment Code: <span className="font-mono font-bold">{coach.enrollmentCode}</span>
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Department Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Department</DialogTitle>
            <DialogDescription>
              Assign a department to {editingCoach?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={departmentDraft} onValueChange={setDepartmentDraft}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No department</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingCoach?.sport && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                <strong>Team:</strong> {editingCoach.sport}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

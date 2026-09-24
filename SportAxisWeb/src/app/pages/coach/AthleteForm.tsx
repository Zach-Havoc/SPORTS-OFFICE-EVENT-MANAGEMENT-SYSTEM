import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAthlete, useCreateAthlete, useUpdateAthlete, useDepartments } from '../../hooks/api';

interface AthleteFormData {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  yearLevel: string;
  course: string;
  status: 'active' | 'inactive' | 'injured';
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
}

export default function AthleteForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<AthleteFormData>({
    studentId: '',
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    yearLevel: '1st Year',
    course: '',
    status: 'active',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const athleteQuery = useAthlete(isEditMode ? id : undefined);
  const createMut = useCreateAthlete();
  const updateMut = useUpdateAthlete();
  const saving = createMut.isPending || updateMut.isPending;

  // The one source of truth for colleges — the same list admins manage in
  // Settings and pick from when scheduling events. Stored by name so an
  // athlete's college matches an event's `departments` exactly.
  const departmentsQuery = useDepartments();
  const departments: { id: string; name: string }[] = departmentsQuery.data ?? [];

  // A coach can enter an athlete's details only when first adding them. After
  // that, identity and personal details belong to the athlete (their account /
  // the campus record) — the coach can view them and set the roster status.
  const readOnlyPersonal = isEditMode;
  const linkedAccount = isEditMode && !!(athleteQuery.data as any)?.userId;

  // Prefill the form once the athlete record loads (edit mode).
  useEffect(() => {
    const athlete: any = athleteQuery.data;
    if (!athlete) return;
    setFormData({
      studentId: athlete.studentId ?? '',
      firstName: athlete.firstName ?? '',
      lastName: athlete.lastName ?? '',
      email: athlete.email ?? '',
      department: athlete.department ?? '',
      yearLevel: athlete.yearLevel ?? '1st Year',
      course: athlete.course ?? '',
      status: athlete.status ?? 'active',
      emergencyContactName: athlete.emergencyContact?.name ?? '',
      emergencyContactRelationship: athlete.emergencyContact?.relationship ?? '',
      emergencyContactPhone: athlete.emergencyContact?.phone ?? '',
    });
  }, [athleteQuery.data]);

  useEffect(() => {
    if (athleteQuery.isLoadingError) {
      toast.error('Failed to load athlete data');
      navigate('/coach/athletes');
    }
  }, [athleteQuery.isLoadingError, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // In edit mode a coach can only change the roster status — everything else
    // is the athlete's to manage.
    if (isEditMode && id) {
      try {
        await updateMut.mutateAsync({ id, data: { status: formData.status } });
        toast.success('Status updated');
        navigate('/coach/athletes');
      } catch (err: any) {
        console.error('Error saving athlete:', err);
        setError(err.message || 'Failed to save. Please try again.');
        toast.error(err.message || 'Failed to save');
      }
      return;
    }

    // Validation (add flow only).
    if (!formData.studentId.trim()) {
      setError('Student ID is required');
      return;
    }
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Valid email is required');
      return;
    }
    if (!formData.department.trim()) {
      setError('College is required');
      return;
    }
    if (!formData.course.trim()) {
      setError('Course is required');
      return;
    }

    try {
      const athleteData = {
        studentId: formData.studentId.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        department: formData.department.trim(),
        yearLevel: formData.yearLevel,
        course: formData.course.trim(),
        status: formData.status,
        emergencyContact: {
          name: formData.emergencyContactName.trim(),
          relationship: formData.emergencyContactRelationship.trim(),
          phone: formData.emergencyContactPhone.trim(),
        },
      };

      await createMut.mutateAsync(athleteData);
      toast.success('Athlete added successfully');

      navigate('/coach/athletes');
    } catch (err: any) {
      console.error('Error saving athlete:', err);
      setError(err.message || 'Failed to save athlete. Please try again.');
      toast.error(err.message || 'Failed to save athlete');
    }
  };

  const handleChange = (field: keyof AthleteFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <Link to="/coach/athletes">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Athletes
          </Button>
        </Link>
        <h1 className="t-page-title">
          {isEditMode ? 'Athlete Details' : 'Add New Athlete'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditMode ? 'View athlete information and set their roster status' : 'Add a new athlete to your roster'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Basic details about the athlete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {readOnlyPersonal && (
              <Alert>
                <AlertDescription>
                  Personal details are managed by the athlete on their own account
                  {linkedAccount ? '' : ' once they register'}. As their coach you can view
                  them and set the roster status.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="studentId">SR Code / Student ID *</Label>
                <Input
                  id="studentId"
                  placeholder="e.g., 23-75760"
                  value={formData.studentId}
                  onChange={(e) => handleChange('studentId', e.target.value)}
                  disabled={readOnlyPersonal}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value: any) => handleChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="injured">Injured</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  disabled={readOnlyPersonal}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  disabled={readOnlyPersonal}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@university.edu"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  disabled={readOnlyPersonal}
                  required
                />
              </div>

            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Academic Information</CardTitle>
            <CardDescription>College, year level, and course details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">College *</Label>
                <Select value={formData.department || undefined} onValueChange={(value) => handleChange('department', value)} disabled={readOnlyPersonal}>
                  <SelectTrigger>
                    <SelectValue placeholder={departmentsQuery.isLoading ? 'Loading colleges…' : 'Select college'} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                    ))}
                    {/* Keep a legacy value visible in edit mode if it's no longer in the list */}
                    {formData.department && !departments.some((d) => d.name === formData.department) && (
                      <SelectItem value={formData.department}>{formData.department} (unlisted)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {!departmentsQuery.isLoading && departments.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No colleges set up yet. An admin adds them in Settings, under Colleges.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearLevel">Year Level *</Label>
                <Select value={formData.yearLevel} onValueChange={(value) => handleChange('yearLevel', value)} disabled={readOnlyPersonal}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st Year">1st Year</SelectItem>
                    <SelectItem value="2nd Year">2nd Year</SelectItem>
                    <SelectItem value="3rd Year">3rd Year</SelectItem>
                    <SelectItem value="4th Year">4th Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="course">Course/Program *</Label>
                <Input
                  id="course"
                  placeholder="e.g., BS Computer Science"
                  value={formData.course}
                  onChange={(e) => handleChange('course', e.target.value)}
                  disabled={readOnlyPersonal}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
            <CardDescription>Contact person in case of emergency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyContactName">Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  placeholder="e.g., Jane Doe"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                  disabled={readOnlyPersonal}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyContactRelationship">Relationship</Label>
                <Input
                  id="emergencyContactRelationship"
                  placeholder="e.g., Mother"
                  value={formData.emergencyContactRelationship}
                  onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)}
                  disabled={readOnlyPersonal}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="emergencyContactPhone">Phone Number</Label>
                <Input
                  id="emergencyContactPhone"
                  type="tel"
                  placeholder="e.g., +63 912 345 6789"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                  disabled={readOnlyPersonal}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link to="/coach/athletes">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : isEditMode ? 'Save Status' : 'Add Athlete'}
          </Button>
        </div>
      </form>
    </div>
  );
}

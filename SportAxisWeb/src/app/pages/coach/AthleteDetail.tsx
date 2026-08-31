import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Edit, Mail, Phone, User, Calendar, BookOpen, Building, AlertCircle, TrendingUp, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAthlete } from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';

interface Athlete {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  yearLevel: string;
  course: string;
  coachId: string;
  teamIds: string[];
  status: 'active' | 'inactive' | 'injured';
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  createdAt: string;
}

export default function AthleteDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (!user || user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const athleteQuery = useAthlete(id);
  const athlete: Athlete | null = (athleteQuery.data as Athlete | undefined) ?? null;
  const loading = athleteQuery.isLoading;

  useEffect(() => {
    if (athleteQuery.isLoadingError) {
      toast.error('Failed to load athlete details');
      navigate('/coach/athletes');
    }
  }, [athleteQuery.isLoadingError, navigate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'injured': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Loading athlete details...</p>
        </div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Athlete not found</p>
          <Link to="/coach/athletes">
            <Button className="mt-4">Back to Athletes</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/coach/athletes">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Athletes
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                {athlete.firstName} {athlete.lastName}
              </h1>
              <RefreshStatus
                fetching={athleteQuery.isFetching && !loading}
                error={athleteQuery.isRefetchError}
                onRetry={() => athleteQuery.refetch()}
              />
            </div>
            <p className="text-gray-600 mt-2">Student ID: {athlete.studentId}</p>
          </div>
          <div className="flex gap-2">
            <Badge className={getStatusColor(athlete.status)}>
              {athlete.status}
            </Badge>
            <Link to={`/coach/athletes/${athlete.id}/edit`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Personal Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Basic details about the athlete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Full Name</p>
                  <p className="text-base">{athlete.firstName} {athlete.lastName}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base">{athlete.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Department</p>
                  <p className="text-base">{athlete.department}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Year Level</p>
                  <p className="text-base">{athlete.yearLevel}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 md:col-span-2">
                <BookOpen className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Course</p>
                  <p className="text-base">{athlete.course}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
            <CardDescription>In case of emergency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {athlete.emergencyContact.name ? (
              <>
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="text-base">{athlete.emergencyContact.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Relationship</p>
                    <p className="text-base">{athlete.emergencyContact.relationship}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
                    <p className="text-base">{athlete.emergencyContact.phone}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">No emergency contact information</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0%</div>
            <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">-</div>
            <p className="text-sm text-gray-500 mt-1">Average rating</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0/0</div>
            <p className="text-sm text-gray-500 mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Performance
            </CardTitle>
            <CardDescription>Latest performance records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No performance records yet</p>
              <p className="text-sm mt-2">Performance data will appear after events</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Requirements Status
            </CardTitle>
            <CardDescription>Document submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No requirements submitted</p>
              <p className="text-sm mt-2">Required documents will appear here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

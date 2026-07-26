import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Users, Calendar, TrendingUp, FileCheck, UserPlus, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { getTryoutApplications, getAthletes } from '../../services/api';

interface TryoutApplication {
  id: string;
  announcementId: string;
  sport: string;
  coachId: string;
  firstName: string;
  lastName: string;
  email: string;
  studentId: string;
  department: string;
  phone: string;
  yearLevel: string;
  status: string;
  appliedAt: string;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tryoutApplications, setTryoutApplications] = useState<TryoutApplication[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'coach') {
      navigate('/login');
      return;
    }
    loadDashboardData();
  }, [user, navigate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [tryoutData, athleteData] = await Promise.all([
        getTryoutApplications(),
        getAthletes(),
      ]);
      setTryoutApplications(tryoutData);
      setAthletes(athleteData || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Coach Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back, {user.name}!</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Athletes</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{athletes.length}</div>
            <p className="text-xs text-gray-500 mt-1">{athletes.filter(a => a.status === 'active').length} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Games</CardTitle>
            <Calendar className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500 mt-1">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tryout Applications</CardTitle>
            <UserPlus className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tryoutApplications.length}</div>
            <p className="text-xs text-gray-500 mt-1">Pending review</p>
          </CardContent>
        </Card>
      </div>

      {/* Tryout Applications */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Recent Tryout Applications</CardTitle>
          <CardDescription>Students who applied for tryouts</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading applications...
            </div>
          ) : tryoutApplications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No tryout applications yet</p>
              <p className="text-sm mt-2">Applications will appear here when students apply through announcements</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tryoutApplications.slice(0, 5).map((application) => (
                <div key={application.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">
                          {application.firstName} {application.lastName}
                        </h4>
                        {application.sport && (
                          <Badge variant="secondary">{application.sport}</Badge>
                        )}
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          Pending
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {application.studentId} • {application.yearLevel}
                        </div>
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4" />
                          {application.department}
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {application.email}
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {application.phone}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Applied {formatDate(application.appliedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {tryoutApplications.length > 5 && (
                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Showing 5 of {tryoutApplications.length} applications
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates from your athletes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p>No recent activity</p>
            <p className="text-sm mt-2">Activity will appear here once you start managing athletes</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

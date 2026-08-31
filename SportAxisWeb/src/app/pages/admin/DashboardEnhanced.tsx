import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useEvents, useDepartments, useLeaderboard, useJudges } from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';
import SummaryCard from '../../components/admin/SummaryCard';
import EventTable from '../../components/admin/EventTable';
import OCRPanel from '../../components/admin/OCRPanel';
import ActivityLog from '../../components/admin/ActivityLog';
import QuickActions from '../../components/admin/QuickActions';
import BarChartComponent from '../../components/admin/charts/BarChartComponent';
import DonutChartComponent from '../../components/admin/charts/DonutChartComponent';
import LineChartComponent from '../../components/admin/charts/LineChartComponent';
import { 
  Calendar, 
  Trophy, 
  Users, 
  TrendingUp, 
  CheckCircle2,
  Clock,
  Award
} from 'lucide-react';
import Loading from '../../components/Loading';

export default function DashboardEnhanced() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
    }
  }, [user, navigate]);

  // Background-refreshed on mount, tab-focus and reconnect (no polling loop).
  const eventsQuery = useEvents();
  const departmentsQuery = useDepartments();
  const leaderboardQuery = useLeaderboard();
  const judgesQuery = useJudges();
  const allQueries = [eventsQuery, departmentsQuery, leaderboardQuery, judgesQuery];

  const events: any[] = eventsQuery.data ?? [];
  const leaderboard: any[] = leaderboardQuery.data ?? [];
  const departmentsData: any[] = departmentsQuery.data ?? [];
  const judgesData: any[] = judgesQuery.data ?? [];

  const loading = allQueries.some(q => q.isLoading);
  const fetching = allQueries.some(q => q.isFetching) && !loading;
  const backgroundError = allQueries.some(q => q.isRefetchError);
  const retryAll = () => allQueries.forEach(q => q.refetch());

  const stats = useMemo(() => {
    const totalEvents = events.length || 0;
    const activeEvents = events.filter((e: any) => e.status === 'ongoing').length;
    const completedEvents = events.filter((e: any) => e.status === 'completed').length;
    const upcomingEvents = events.filter((e: any) => e.status === 'upcoming').length;
    const totalPoints = leaderboard.reduce(
      (acc: number, dept: any) => acc + (dept.totalPoints || dept.total || 0),
      0,
    );
    const totalJudges = judgesData.length || 0;
    const totalParticipants = departmentsData.reduce(
      (acc: number, dept: any) => acc + (dept.athleteCount || 0),
      0,
    );
    const scoresSubmitted = totalPoints; // proxy for score submissions
    return {
      totalEvents,
      activeEvents,
      totalJudges,
      totalParticipants,
      scoresSubmitted,
      completedEvents,
      upcomingEvents,
      totalPoints,
    };
  }, [events, leaderboard, judgesData, departmentsData]);

  // Transform events for EventTable
  const transformedEvents = events.map((event: any) => ({
    id: event.id,
    name: event.name,
    category: event.category || 'Uncategorized',
    status: event.status || 'upcoming',
    progress: event.status === 'completed' ? 100 : event.status === 'ongoing' ? 50 : 0,
    judgesAssigned: event.judgeCount || 0,
    date: event.date || new Date().toISOString().split('T')[0]
  }));

  // Transform leaderboard for BarChart
  const scoresByParticipant = leaderboard.slice(0, 8).map((dept: any, index: number) => ({
    id: `dept-${index}`,
    name: dept.department || `Department ${index + 1}`,
    score: dept.totalPoints || 0
  }));

  // Calculate submission status from events
  const totalEventSlots = events.length * 10; // Assuming 10 scores per event
  const submittedScores = stats.scoresSubmitted;
  const submissionStatus = [
    { id: '1', name: 'Submitted', value: submittedScores },
    { id: '2', name: 'Pending', value: Math.max(0, totalEventSlots - submittedScores) }
  ];

  // Generate time-based submission data (placeholder - needs real API)
  const scoreSubmissionsOverTime = [
    { id: '1', date: 'Today', submissions: stats.scoresSubmitted }
  ];

  // Generate activity log from events (placeholder - needs real API)
  const activities = events.slice(0, 5).map((event: any, index: number) => ({
    id: `activity-${index}`,
    type: 'event' as const,
    message: `Event "${event.name}" is ${event.status}`,
    timestamp: event.createdAt || new Date().toISOString(),
    user: 'System'
  }));

  if (loading) {
    return <Loading fullScreen={false} message="Loading dashboard..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">SportAxisWeb Dashboard</h1>
          <RefreshStatus fetching={fetching} error={backgroundError} onRetry={retryAll} />
        </div>
        <p className="text-gray-500 mt-1">Sports Event Management System</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard
          icon={Calendar}
          label="Total Events"
          value={stats.totalEvents}
          subtext="All time events"
          iconColor="text-blue-500"
          onClick={() => navigate('/admin/events')}
        />
        <SummaryCard
          icon={Trophy}
          label="Active Events"
          value={stats.activeEvents}
          subtext="Currently ongoing"
          iconColor="text-green-500"
          accentColor="text-green-600"
        />
        <SummaryCard
          icon={Users}
          label="Total Judges"
          value={stats.totalJudges}
          subtext="Registered judges"
          iconColor="text-purple-500"
          accentColor="text-purple-600"
        />
        <SummaryCard
          icon={Users}
          label="Total Participants"
          value={stats.totalParticipants}
          subtext="Across all events"
          iconColor="text-indigo-500"
          accentColor="text-indigo-600"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Scores Submitted"
          value={stats.scoresSubmitted}
          subtext="Total submissions"
          iconColor="text-yellow-500"
          accentColor="text-yellow-600"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Completed Events"
          value={stats.completedEvents}
          subtext="Events finished"
          iconColor="text-gray-500"
          accentColor="text-gray-600"
        />
        <SummaryCard
          icon={Clock}
          label="Upcoming Events"
          value={stats.upcomingEvents}
          subtext="Scheduled events"
          iconColor="text-orange-500"
          accentColor="text-orange-600"
        />
        <SummaryCard
          icon={Award}
          label="Total Points"
          value={stats.totalPoints}
          subtext="Points awarded"
          iconColor="text-red-500"
          accentColor="text-red-600"
        />
      </div>

      {/* Event Monitoring */}
      <div className="mb-8">
        <EventTable events={transformedEvents} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <BarChartComponent
          data={scoresByParticipant}
          title="Scores by Department"
          description="Top 8 departments by points"
          dataKey="score"
          xAxisKey="name"
          color="#DC2626"
        />
        <DonutChartComponent
          data={submissionStatus}
          title="Submission Status"
          description="Score submissions overview"
          dataKey="value"
          nameKey="name"
          colors={['#DC2626', '#E5E7EB']}
        />
      </div>

      {/* Line Chart */}
      <div className="mb-8">
        <LineChartComponent
          data={scoreSubmissionsOverTime}
          title="Score Submissions"
          description="Current submission count"
          dataKey="submissions"
          xAxisKey="date"
          color="#DC2626"
        />
      </div>

      {/* OCR Panel and Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <OCRPanel
          ocrSubmissions={0}
          manualSubmissions={stats.scoresSubmitted}
          averageConfidence={0}
          lowConfidenceCount={0}
        />
        <ActivityLog activities={activities} />
      </div>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}

import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../hooks/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { RefreshStatus } from '../../components/RefreshStatus';
import { useDeptAbbreviator } from '../../utils/departments';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Calendar, Users, ArrowRight } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  status: string;
  departments: string[];
}

export default function JudgeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'judge') {
      navigate('/login');
    }
  }, [user, navigate]);

  const { data, isLoading, isFetching, isRefetchError, refetch } = useEvents();
  const abbr = useDeptAbbreviator();

  const events = useMemo<Event[]>(
    () =>
      (data ?? [])
        .map((e: any) => ({ ...e, departments: e.departments || [] }))
        .filter((e: Event) => e.status === 'ongoing'),
    [data],
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Committee Panel</h1>
          <RefreshStatus
            fetching={isFetching && !isLoading}
            error={isRefetchError}
            onRetry={() => refetch()}
          />
        </div>
        <p className="text-gray-500 mt-1">Welcome, {user?.name}. Select an event to start scoring.</p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No ongoing events available for scoring at the moment
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <Card key={event.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Badge className="bg-green-500 w-fit mb-2">Ongoing</Badge>
                <CardTitle className="text-xl">{abbr(event.name)}</CardTitle>
                <CardDescription>{event.category}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {new Date(event.schedule).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    {(event.departments || []).length} departments
                  </div>

                  <Link to={`/judge/event/${event.id}`} className="block mt-4">
                    <Button className="w-full">
                      Start Scoring
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { EmptyState } from "../../components/page/EmptyState";
import { PageHeader } from "../../components/page/PageHeader";
import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../hooks/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { RefreshStatus } from '../../components/RefreshStatus';
import { useDeptAbbreviator } from '../../utils/departments';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Calendar, Users, ArrowRight, Gavel } from 'lucide-react';

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
      <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
        <div className="py-12 text-center text-text-muted">Loading your events</div>
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Committee Panel"
        description={`Welcome, ${user?.name ?? ""}. Pick an event to start scoring.`}
        actions={
          <RefreshStatus
            fetching={isFetching && !isLoading}
            error={isRefetchError}
            onRetry={() => refetch()}
          />
        }
      />

      {events.length === 0 ? (
        <Card>
          <EmptyState
            icon={Gavel}
            title="No events to score right now"
            description="Events appear here once the Sports Office marks them ongoing and assigns you to the committee."
          />
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <Card key={event.id} variant="raised">
              <CardHeader>
                <Badge variant="success" className="mb-2 w-fit">Ongoing</Badge>
                <CardTitle>{abbr(event.name)}</CardTitle>
                <CardDescription>{event.category}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-text-secondary">
                    <Calendar className="h-4 w-4 mr-2" />
                    {new Date(event.schedule).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-sm text-text-secondary">
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

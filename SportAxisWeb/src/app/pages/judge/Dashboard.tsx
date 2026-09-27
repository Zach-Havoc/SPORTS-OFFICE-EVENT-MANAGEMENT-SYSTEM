import { EmptyState } from "../../components/page/EmptyState";
import { PageHeader } from "../../components/page/PageHeader";
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../hooks/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { RefreshStatus } from '../../components/RefreshStatus';
import { useDeptAbbreviator } from '../../utils/departments';
import { isAssignedCommittee } from '../../utils/committee';
import { Badge } from '../../components/ui/badge';
import { Calendar, Users, Gavel, Smartphone } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  status: string;
  departments: string[];
  judges?: Array<{ id: string; name: string }>;
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
        // The games the office assigned this committee member to that are
        // still to be played, live ones first.
        .filter((e: Event) => e.status !== 'completed' && isAssignedCommittee(e, user))
        .sort((a: Event, b: Event) => (a.status === 'ongoing' ? 0 : 1) - (b.status === 'ongoing' ? 0 : 1) || a.schedule.localeCompare(b.schedule)),
    [data, user],
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
        description={`Welcome, ${user?.name ?? ""}. These are the games you're assigned to. Scoring is done in the SportAxis mobile app.`}
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
            title="No games assigned right now"
            description="You only see games the Sports Office assigned you to that haven't been played yet."
          />
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <Card key={event.id} variant="raised">
              <CardHeader>
                {event.status === 'ongoing' ? (
                  <Badge variant="success" className="mb-2 w-fit">Ongoing</Badge>
                ) : (
                  <Badge variant="neutral" className="mb-2 w-fit">Upcoming</Badge>
                )}
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

                  <div className="mt-4 flex items-start gap-2 rounded-md bg-surface-sunken px-3 py-2 text-sm text-text-secondary">
                    <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
                    Score this game in the SportAxis app: tap Scan and scan its QR code.
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

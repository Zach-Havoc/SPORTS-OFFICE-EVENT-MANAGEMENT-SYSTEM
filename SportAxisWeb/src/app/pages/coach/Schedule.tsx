import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useCoachSchedule } from '../../hooks/api';
import { TeamScheduleView, teamLabelOf } from '../../components/schedule/TeamScheduleView';

/** The coach's own fixtures — see TeamScheduleView for the shared UI. */
export default function CoachSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const query = useCoachSchedule();

  if (!user) return null;

  return (
    <TeamScheduleView
      teamLabel={teamLabelOf(query.data?.team ?? null)}
      events={query.data?.events ?? []}
      reason={query.data?.reason ?? null}
      loading={query.isLoading}
      fetching={query.isFetching}
      error={query.isRefetchError}
      onRetry={() => query.refetch()}
    />
  );
}

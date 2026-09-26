import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useAthleteSchedule, useAthleteTraining } from '../../hooks/api';
import { TrainingList } from '../../components/schedule/TrainingList';
import { TeamScheduleView, teamLabelOf } from '../../components/schedule/TeamScheduleView';

/** The athlete's own fixtures — see TeamScheduleView for the shared UI. */
export default function AthleteSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'athlete') navigate('/login');
  }, [user, navigate]);

  const query = useAthleteSchedule();
  const training = useAthleteTraining();

  if (!user) return null;

  return (
    <TeamScheduleView
      teamLabel={teamLabelOf(query.data?.team ?? null)}
      events={query.data?.events ?? []}
      reason={query.data?.reason ?? null}
      loading={query.isLoading}
      fetching={query.isFetching}
      error={query.isRefetchError}
      onRetry={() => { query.refetch(); training.refetch(); }}
      extra={<TrainingList sessions={training.data ?? []} loading={training.isLoading} />}
    />
  );
}

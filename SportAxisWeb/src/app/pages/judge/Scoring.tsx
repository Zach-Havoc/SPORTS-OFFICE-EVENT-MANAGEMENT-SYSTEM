import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getEvent, submitScore } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  departments: string[];
}

export default function JudgeScoring() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('');
  const [score, setScore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'judge') {
      navigate('/login');
      return;
    }
    loadEvent();
  }, [user, navigate, eventId]);

  const loadEvent = async () => {
    try {
      if (!eventId) {
        toast.error('Invalid event link');
        navigate('/judge');
        return;
      }

      const data = await getEvent(eventId);
      if (!data || !data.id) {
        throw new Error('Invalid event data received');
      }
      setEvent(data);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        toast.error('This event no longer exists.');
        navigate('/judge');
        return;
      } else if (error.message.includes('session')) {
        toast.error('Your session has expired. Please log in again.');
        navigate('/login');
        return;
      }
      toast.error(`Failed to load event: ${error.message}`);
      navigate('/judge');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDept) {
      toast.error('Select a college first.');
      return;
    }

    const value = Number(score);
    if (score === '' || Number.isNaN(value) || value < 0 || value > 100) {
      toast.error('Enter a score from 0 to 100.');
      return;
    }

    try {
      setSubmitting(true);
      await submitScore({
        eventId: eventId,
        department: selectedDept,
        judgeId: user?.id,
        totalScore: value,
      });

      toast.success('Score submitted.');
      setScore('');
      setSelectedDept('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit score');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">Event not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button variant="ghost" onClick={() => navigate('/judge')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-green-500">Ongoing</Badge>
            <Badge variant="outline">{event.category}</Badge>
          </div>
          <CardTitle className="text-2xl">{event.name}</CardTitle>
          <CardDescription>
            Schedule: {new Date(event.schedule).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submit Score</CardTitle>
          <CardDescription>Select a college and enter its overall score.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* College selection */}
          <div className="space-y-2">
            <Label>Select College</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {event.departments.map(dept => (
                <Button
                  key={dept}
                  variant={selectedDept === dept ? 'default' : 'outline'}
                  onClick={() => setSelectedDept(dept)}
                  className="justify-start"
                >
                  {dept}
                </Button>
              ))}
            </div>
          </div>

          {selectedDept ? (
            <div className="space-y-4">
              <div className="border-t pt-4 space-y-2">
                <Label className="font-semibold">Overall Score for {selectedDept}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="0 - 100"
                  className="text-lg font-semibold max-w-xs"
                />
                <p className="text-sm text-gray-500">Enter a single value from 0 to 100.</p>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? 'Submitting...' : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Submit Score
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Select a college to start scoring
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-2">Scoring Guidelines</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Enter one overall score from 0 to 100 per college</li>
            <li>• Submit scores for each college separately</li>
            <li>• You can score colleges in any order</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

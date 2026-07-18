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
  criteria: Array<{ name: string; weight: number }>;
}

export default function JudgeScoring() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
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
        console.error('No eventId provided in URL');
        toast.error('Invalid event link');
        navigate('/judge');
        return;
      }
      
      console.log('Loading event with ID:', eventId);
      const data = await getEvent(eventId);
      console.log('Event loaded successfully:', data);
      
      if (!data || !data.id) {
        throw new Error('Invalid event data received');
      }
      
      setEvent(data);
      
      // Initialize scores
      const initialScores: Record<string, number> = {};
      data.criteria.forEach((c: any) => {
        initialScores[c.name] = 0;
      });
      setScores(initialScores);
    } catch (error: any) {
      console.error('Error loading event:', error);
      console.error('Event ID that failed:', eventId);
      
      // Provide specific error message
      if (error.message.includes('not found')) {
        toast.error('This event no longer exists. Redirecting to available events...');
        // Redirect immediately to judge dashboard
        navigate('/judge');
        return;
      } else if (error.message.includes('session')) {
        toast.error('Your session has expired. Please log in again.');
        navigate('/login');
        return;
      } else {
        toast.error(`Failed to load event: ${error.message}`);
        // Redirect immediately on any error
        navigate('/judge');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (criterionName: string, value: number) => {
    setScores(prev => ({
      ...prev,
      [criterionName]: value
    }));
  };

  const calculateTotal = () => {
    if (!event) return 0;
    let total = 0;
    event.criteria.forEach(criterion => {
      total += (scores[criterion.name] || 0) * (criterion.weight / 100);
    });
    return total.toFixed(2);
  };

  const handleSubmit = async () => {
    if (!selectedDept) {
      toast.error('Please select a department');
      return;
    }

    // Validate all scores are entered
    const allScoresEntered = event?.criteria.every(c => scores[c.name] > 0);
    if (!allScoresEntered) {
      toast.error('Please enter scores for all criteria');
      return;
    }

    try {
      setSubmitting(true);
      await submitScore({
        eventId: eventId,
        department: selectedDept,
        judgeId: user?.id,
        scores: scores,
        totalScore: parseFloat(calculateTotal())
      });

      toast.success('Scores submitted successfully!');
      
      // Reset for next department
      const initialScores: Record<string, number> = {};
      event?.criteria.forEach((c: any) => {
        initialScores[c.name] = 0;
      });
      setScores(initialScores);
      setSelectedDept('');
    } catch (error: any) {
      console.error('Error submitting scores:', error);
      toast.error(error.message || 'Failed to submit scores');
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
          <CardTitle>Submit Scores</CardTitle>
          <CardDescription>Select a department and enter scores for each criterion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Department Selection */}
          <div className="space-y-2">
            <Label>Select Department</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {event.departments.map(dept => (
                <Button
                  key={dept}
                  variant={selectedDept === dept ? "default" : "outline"}
                  onClick={() => setSelectedDept(dept)}
                  className="justify-start"
                >
                  {dept}
                </Button>
              ))}
            </div>
          </div>

          {/* Scoring Criteria */}
          {selectedDept && (
            <>
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">Scoring for {selectedDept}</h3>
                  {event.criteria.map((criterion, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4 p-4 bg-gray-50 rounded-lg">
                      <div className="md:col-span-1">
                        <Label className="font-semibold">{criterion.name}</Label>
                        <p className="text-sm text-gray-500">Weight: {criterion.weight}%</p>
                      </div>
                      <div className="md:col-span-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={scores[criterion.name] || ''}
                          onChange={(e) => handleScoreChange(criterion.name, Number(e.target.value))}
                          placeholder="0-100"
                          className="text-lg font-semibold"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <p className="text-sm text-gray-600">
                          Weighted: {((scores[criterion.name] || 0) * (criterion.weight / 100)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Score Display */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                    <span className="text-lg font-semibold">Total Score</span>
                    <span className="text-2xl font-bold text-blue-600">{calculateTotal()}</span>
                  </div>
                </div>

                {/* Submit Button */}
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
            </>
          )}

          {!selectedDept && (
            <div className="text-center py-8 text-gray-500">
              Please select a department to start scoring
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-2">Scoring Guidelines</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Scores should be between 0 and 100 for each criterion</li>
            <li>• Each criterion has a weight that contributes to the final score</li>
            <li>• Submit scores for each department separately</li>
            <li>• You can score departments in any order</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
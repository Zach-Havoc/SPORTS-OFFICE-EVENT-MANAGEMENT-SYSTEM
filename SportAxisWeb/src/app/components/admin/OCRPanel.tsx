import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Camera, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface OCRPanelProps {
  ocrSubmissions: number;
  manualSubmissions: number;
  averageConfidence: number;
  lowConfidenceCount: number;
}

export default function OCRPanel({
  ocrSubmissions,
  manualSubmissions,
  averageConfidence,
  lowConfidenceCount
}: OCRPanelProps) {
  const totalSubmissions = ocrSubmissions + manualSubmissions;
  const ocrPercentage = totalSubmissions > 0 ? Math.round((ocrSubmissions / totalSubmissions) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          OCR Monitoring
        </CardTitle>
        <CardDescription>Score submission tracking and confidence levels</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">OCR Submissions</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{ocrSubmissions}</p>
            <p className="text-xs text-blue-600 mt-1">{ocrPercentage}% of total</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Manual Submissions</span>
            </div>
            <p className="text-2xl font-bold text-gray-600">{manualSubmissions}</p>
            <p className="text-xs text-gray-600 mt-1">{100 - ocrPercentage}% of total</p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Avg Confidence</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{averageConfidence}%</p>
            <p className="text-xs text-green-600 mt-1">Overall accuracy</p>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Low Confidence</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{lowConfidenceCount}</p>
            <p className="text-xs text-orange-600 mt-1">Needs review</p>
          </div>
        </div>

        {lowConfidenceCount > 0 && (
          <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-900">
                {lowConfidenceCount} submissions require manual review
              </span>
            </div>
            <Button size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-100">
              Review Now
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1">
            <Clock className="h-4 w-4 mr-2" />
            View All Submissions
          </Button>
          <Button variant="outline" className="flex-1">
            <Camera className="h-4 w-4 mr-2" />
            Review Images
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

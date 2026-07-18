import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Link } from 'react-router';
import { 
  Calendar, 
  UserPlus, 
  Award, 
  FileText, 
  MapPin, 
  Trophy,
  Settings,
  QrCode
} from 'lucide-react';

interface QuickAction {
  label: string;
  icon: any;
  path: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

interface QuickActionsProps {
  actions?: QuickAction[];
}

const defaultActions: QuickAction[] = [
  { label: 'Create Event', icon: Calendar, path: '/admin/events', variant: 'outline' },
  { label: 'Assign Judges', icon: UserPlus, path: '/admin/events', variant: 'outline' },
  { label: 'Generate QR Code', icon: QrCode, path: '/admin/registration-codes', variant: 'outline' },
  { label: 'View Reports', icon: FileText, path: '/admin/reports', variant: 'outline' },
  { label: 'Manage Venues', icon: MapPin, path: '/admin/venues', variant: 'outline' },
  { label: 'Generate Brackets', icon: Trophy, path: '/admin/bracketing', variant: 'outline' },
  { label: 'System Settings', icon: Settings, path: '/admin/settings', variant: 'outline' },
  { label: 'View Leaderboard', icon: Award, path: '/leaderboard', variant: 'outline' },
];

export default function QuickActions({ actions = defaultActions }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common administrative tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.path} to={action.path}>
                <Button 
                  variant={action.variant || 'outline'} 
                  className="w-full justify-start"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {action.label}
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

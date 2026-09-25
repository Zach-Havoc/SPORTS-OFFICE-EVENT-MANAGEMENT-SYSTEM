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
  QrCode,
  UserCog,
  MonitorPlay,
  Image as ImageIcon
} from 'lucide-react';

interface QuickAction {
  label: string;
  icon: any;
  path: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  newTab?: boolean;
}

interface QuickActionsProps {
  actions?: QuickAction[];
}

const defaultActions: QuickAction[] = [
  { label: 'Create Event', icon: Calendar, path: '/admin/events', variant: 'secondary' },
  { label: 'Assign Committees', icon: UserPlus, path: '/admin/events', variant: 'secondary' },
  { label: 'Generate QR Code', icon: QrCode, path: '/admin/registration-codes', variant: 'secondary' },
  { label: 'Manage Users', icon: UserCog, path: '/admin/users', variant: 'secondary' },
  { label: 'View Reports', icon: FileText, path: '/admin/reports', variant: 'secondary' },
  { label: 'Manage Venues', icon: MapPin, path: '/admin/venues', variant: 'secondary' },
  { label: 'Generate Brackets', icon: Trophy, path: '/admin/bracketing', variant: 'secondary' },
  { label: 'Site Content', icon: ImageIcon, path: '/admin/carousel', variant: 'secondary' },
  { label: 'System Settings', icon: Settings, path: '/admin/settings', variant: 'secondary' },
  { label: 'View Leaderboard', icon: Award, path: '/leaderboard', variant: 'secondary' },
  { label: 'Standings Board (TV)', icon: MonitorPlay, path: '/standings', variant: 'secondary', newTab: true },
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
              <Link
                key={action.label}
                to={action.path}
                {...(action.newTab ? { target: '_blank', rel: 'noreferrer' } : {})}
              >
                <Button
                  variant={action.variant || 'secondary'}
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

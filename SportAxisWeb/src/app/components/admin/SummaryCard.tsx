import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface SummaryCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  subtext?: string;
  accentColor?: string;
  iconColor?: string;
  onClick?: () => void;
}

export default function SummaryCard({
  icon: Icon,
  label,
  value,
  subtext,
  accentColor = 'text-blue-600',
  iconColor = 'text-gray-500',
  onClick
}: SummaryCardProps) {
  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface BarChartComponentProps {
  data: any[];
  title: string;
  description?: string;
  dataKey: string;
  xAxisKey: string;
  color?: string;
  layout?: 'vertical' | 'horizontal';
}

export default function BarChartComponent({
  data,
  title,
  description,
  dataKey,
  xAxisKey,
  color = '#DC2626',
  layout = 'horizontal'
}: BarChartComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout={layout === 'vertical' ? 'vertical' : undefined}>
            <CartesianGrid strokeDasharray="3 3" />
            {layout === 'horizontal' ? (
              <>
                <XAxis dataKey={xAxisKey} />
                <YAxis />
              </>
            ) : (
              <>
                <XAxis type="number" />
                <YAxis dataKey={xAxisKey} type="category" width={150} />
              </>
            )}
            <Tooltip />
            <Legend />
            <Bar dataKey={dataKey} fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

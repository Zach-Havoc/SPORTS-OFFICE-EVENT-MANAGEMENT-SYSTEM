import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

interface DonutChartComponentProps {
  data: any[];
  title: string;
  description?: string;
  dataKey: string;
  nameKey: string;
  colors?: string[];
}

const DEFAULT_COLORS = ['#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FEE2E2', '#7F1D1D', '#991B1B', '#B91C1C'];

export default function DonutChartComponent({
  data,
  title,
  description,
  dataKey,
  nameKey,
  colors = DEFAULT_COLORS
}: DonutChartComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry[nameKey]}: ${entry[dataKey]}`}
              outerRadius={100}
              innerRadius={60}
              dataKey={dataKey}
              nameKey={nameKey}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

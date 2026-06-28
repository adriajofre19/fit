import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartPoint {
  date: string;
  label: string;
  value: number;
}

interface LineChartProps {
  data: ChartPoint[];
  unit?: string;
  color?: string;
}

export function LineChart({ data, unit = '', color = '#171717' }: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Sin datos todavía
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RechartsLine data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={{ stroke: '#e4e4e7' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 11 }}
          width={40}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e4e4e7',
            borderRadius: '6px',
            color: '#09090b',
            fontSize: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
          formatter={(value: number) => [`${value}${unit}`, '']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </RechartsLine>
    </ResponsiveContainer>
  );
}

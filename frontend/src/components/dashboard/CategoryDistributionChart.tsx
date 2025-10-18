import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CategoryDistribution } from '../../types/analytics';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { formatPercentage, safeChartLabel } from '../../utils/formatters';

interface CategoryDistributionChartProps {
  data: CategoryDistribution[];
  isLoading?: boolean;
}

export function CategoryDistributionChart({ data, isLoading }: CategoryDistributionChartProps) {
  if (isLoading) {
    return (
      <div className="card">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 capitalize">{data.category}</p>
          <p className="text-sm text-gray-600">
            {data.count} tickets ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = (data: any) => {
    const labelText = safeChartLabel(data);
    if (!labelText) return null;
    
    const { cx, cy, midAngle, innerRadius, outerRadius } = data;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="medium"
      >
        {labelText}
      </text>
    );
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Ticket Categories</h3>
        <div className="text-sm text-gray-500">
          Total: {data.reduce((sum, item) => sum + item.count, 0)} tickets
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center">
        <div className="w-full lg:w-2/3">
          <ErrorBoundary fallback={
            <div className="h-64 flex items-center justify-center text-gray-500">
              <p>Unable to load chart</p>
            </div>
          }>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={CustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </ErrorBoundary>
        </div>

        <div className="w-full lg:w-1/3 lg:pl-4">
          <div className="space-y-2">
            {data.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-gray-700 capitalize">{item.category}</span>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{item.count}</div>
                  <div className="text-gray-500">{formatPercentage(item.percentage)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
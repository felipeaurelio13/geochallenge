const colorClasses = {
  primary: 'text-primary',
  green: 'text-green-400',
  red: 'text-red-400',
  yellow: 'text-yellow-400',
  white: 'text-white',
} as const;

interface StatCardProps {
  value: string | number;
  label: string;
  color?: keyof typeof colorClasses;
  className?: string;
}

export function StatCard({ value, label, color = 'primary', className = '' }: StatCardProps) {
  return (
    <div className={`text-center p-4 bg-gray-900 rounded-lg ${className}`}>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

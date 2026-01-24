'use client';

interface ComplianceProgressProps {
  percentage: number;
  color?: 'green' | 'yellow' | 'red' | 'blue';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const colorClasses = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
};

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function ComplianceProgress({
  percentage,
  color = 'blue',
  showLabel = false,
  size = 'md',
}: ComplianceProgressProps) {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  // Determine color based on percentage if not explicitly set
  const effectiveColor = color === 'blue'
    ? (clampedPercentage >= 80 ? 'green' : clampedPercentage >= 50 ? 'yellow' : 'red')
    : color;

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Compliance
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {clampedPercentage}%
          </span>
        </div>
      )}
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${sizeClasses[size]}`}>
        <div
          className={`${colorClasses[effectiveColor]} ${sizeClasses[size]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clampedPercentage}%` }}
          role="progressbar"
          aria-valuenow={clampedPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

'use client';

interface Framework {
  id: string;
  name: string;
  version?: string;
  isActive: boolean;
}

interface FrameworkSelectorProps {
  frameworks: Framework[];
  selected: string[];
  onChange: (selected: string[]) => void;
  loading?: boolean;
}

export function FrameworkSelector({
  frameworks,
  selected,
  onChange,
  loading = false,
}: FrameworkSelectorProps) {
  const handleToggle = (frameworkId: string) => {
    if (selected.includes(frameworkId)) {
      onChange(selected.filter(id => id !== frameworkId));
    } else {
      onChange([...selected, frameworkId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (frameworks.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No compliance frameworks available. Configure frameworks in the admin console.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {frameworks.filter(f => f.isActive).map((framework) => (
        <label
          key={framework.id}
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all
            ${selected.includes(framework.id)
              ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700'
              : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700/50'
            }
          `}
        >
          <input
            type="checkbox"
            checked={selected.includes(framework.id)}
            onChange={() => handleToggle(framework.id)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {framework.name}
            {framework.version && (
              <span className="ml-1 text-xs text-gray-400">
                {framework.version}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

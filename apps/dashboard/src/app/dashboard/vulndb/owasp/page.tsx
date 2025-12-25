'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OwaspCategory {
  id: string;
  category: string;
  name: string;
  description: string;
  year: number;
  cwes: string[];
  findingCount?: number;
}

const categoryColors: Record<string, string> = {
  'A01': 'bg-red-500',
  'A02': 'bg-orange-500',
  'A03': 'bg-yellow-500',
  'A04': 'bg-lime-500',
  'A05': 'bg-green-500',
  'A06': 'bg-teal-500',
  'A07': 'bg-cyan-500',
  'A08': 'bg-blue-500',
  'A09': 'bg-indigo-500',
  'A10': 'bg-purple-500',
};

export default function OwaspTop10Page() {
  const [categories, setCategories] = useState<OwaspCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2021);

  useEffect(() => {
    fetchOwasp();
  }, [selectedYear]);

  const fetchOwasp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vulndb/owasp?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch OWASP:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalFindings = categories.reduce((sum, c) => sum + (c.findingCount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">OWASP Top 10</h1>
          <p className="text-gray-500">
            View your security findings mapped to OWASP Top 10 categories
          </p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
        >
          <option value={2021}>OWASP Top 10 - 2021</option>
          <option value={2017}>OWASP Top 10 - 2017</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-4xl font-bold">{totalFindings}</div>
              <div className="text-sm text-gray-500">Total Findings</div>
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardContent className="p-6">
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <div className={`w-3 h-3 rounded-full ${categoryColors[cat.category] || 'bg-gray-500'}`} />
                  <span className="text-sm font-medium">{cat.category}</span>
                  <Badge variant={cat.findingCount ? 'destructive' : 'secondary'}>
                    {cat.findingCount || 0}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-48 bg-gray-100 dark:bg-gray-800" />
            </Card>
          ))
        ) : (
          categories.map((category) => (
            <Card key={category.id} className="overflow-hidden">
              <div className={`h-2 ${categoryColors[category.category] || 'bg-gray-500'}`} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-bold">
                      {category.category}
                    </Badge>
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                  </div>
                  {(category.findingCount ?? 0) > 0 && (
                    <Badge variant="destructive">
                      {category.findingCount} findings
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {category.description}
                </p>
                {category.cwes && category.cwes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2">Related CWEs</h4>
                    <div className="flex flex-wrap gap-1">
                      {category.cwes.slice(0, 8).map((cwe, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {cwe}
                        </Badge>
                      ))}
                      {category.cwes.length > 8 && (
                        <Badge variant="outline" className="text-xs">
                          +{category.cwes.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

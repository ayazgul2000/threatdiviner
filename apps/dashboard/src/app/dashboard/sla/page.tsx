'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface SlaSummary {
  total: number;
  compliant: number;
  atRisk: number;
  breached: number;
  compliancePercentage: number;
}

interface SlaSummaryBySeverity {
  severity: string;
  total: number;
  compliant: number;
  atRisk: number;
  breached: number;
  slaHours: number;
}

interface AtRiskFinding {
  id: string;
  title: string;
  severity: string;
  repository: string;
  hoursRemaining: number;
  dueDate: string;
}

interface MttrData {
  overall: number;
  bySeverity: Array<{ severity: string; mttr: number }>;
}

export default function SlaDashboardPage() {
  const [summary, setSummary] = useState<SlaSummary | null>(null);
  const [bySeverity, setBySeverity] = useState<SlaSummaryBySeverity[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskFinding[]>([]);
  const [breached, setBreached] = useState<AtRiskFinding[]>([]);
  const [mttr, setMttr] = useState<MttrData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, bySeverityRes, atRiskRes, breachedRes, mttrRes] = await Promise.all([
        fetch('/api/vulndb/sla/summary'),
        fetch('/api/vulndb/sla/summary/by-severity'),
        fetch('/api/vulndb/sla/at-risk'),
        fetch('/api/vulndb/sla/breached'),
        fetch('/api/vulndb/sla/mttr'),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (bySeverityRes.ok) setBySeverity(await bySeverityRes.json());
      if (atRiskRes.ok) setAtRisk(await atRiskRes.json());
      if (breachedRes.ok) setBreached(await breachedRes.json());
      if (mttrRes.ok) setMttr(await mttrRes.json());
    } catch (error) {
      console.error('Failed to fetch SLA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatHours = (hours: number) => {
    if (hours < 24) return `${hours.toFixed(0)}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(0)}h`;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SLA Dashboard</h1>
        <p className="text-gray-500">
          Track SLA compliance and remediation time metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600">
                {loading ? '-' : `${summary?.compliancePercentage ?? 0}%`}
              </div>
              <div className="text-sm text-gray-500">Overall Compliance</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-4xl font-bold">
                {loading ? '-' : summary?.compliant ?? 0}
              </div>
              <div className="text-sm text-gray-500">Compliant</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-300">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-600">
                {loading ? '-' : summary?.atRisk ?? 0}
              </div>
              <div className="text-sm text-gray-500">At Risk</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-300">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-red-600">
                {loading ? '-' : summary?.breached ?? 0}
              </div>
              <div className="text-sm text-gray-500">Breached</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>SLA by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bySeverity.map((item) => (
                <div key={item.severity} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(item.severity)}>
                        {item.severity}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        (SLA: {item.slaHours}h)
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {item.total > 0 ? Math.round((item.compliant / item.total) * 100) : 100}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${item.total > 0 ? (item.compliant / item.total) * 100 : 100}%` }}
                    />
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${item.total > 0 ? (item.atRisk / item.total) * 100 : 0}%` }}
                    />
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${item.total > 0 ? (item.breached / item.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{item.compliant} compliant</span>
                    <span>{item.atRisk} at risk</span>
                    <span>{item.breached} breached</span>
                  </div>
                </div>
              ))}
              {bySeverity.length === 0 && !loading && (
                <p className="text-center text-gray-500 py-8">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mean Time to Remediate (MTTR)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <div className="text-5xl font-bold">
                {loading ? '-' : formatHours(mttr?.overall ?? 0)}
              </div>
              <div className="text-sm text-gray-500">Average MTTR (last 90 days)</div>
            </div>
            <div className="space-y-3">
              {mttr?.bySeverity?.map((item) => (
                <div key={item.severity} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Badge className={getSeverityColor(item.severity)}>
                    {item.severity}
                  </Badge>
                  <span className="font-medium">{formatHours(item.mttr)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-yellow-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              At Risk Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Finding</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Time Left</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRisk.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No at-risk findings
                    </TableCell>
                  </TableRow>
                ) : (
                  atRisk.slice(0, 5).map((finding) => (
                    <TableRow key={finding.id}>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={finding.title}>
                          {finding.title}
                        </div>
                        <div className="text-xs text-gray-500">{finding.repository}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(finding.severity)}>
                          {finding.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-yellow-600 font-medium">
                        {formatHours(finding.hoursRemaining)}
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/findings/${finding.id}`}>
                          <button className="text-blue-500 hover:underline text-sm">View</button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              SLA Breached Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Finding</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breached.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No breached findings
                    </TableCell>
                  </TableRow>
                ) : (
                  breached.slice(0, 5).map((finding) => (
                    <TableRow key={finding.id}>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={finding.title}>
                          {finding.title}
                        </div>
                        <div className="text-xs text-gray-500">{finding.repository}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(finding.severity)}>
                          {finding.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {formatHours(Math.abs(finding.hoursRemaining))}
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/findings/${finding.id}`}>
                          <button className="text-blue-500 hover:underline text-sm">View</button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

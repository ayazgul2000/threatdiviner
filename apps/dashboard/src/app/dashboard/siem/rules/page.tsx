'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  eventTypes: string[];
  sources: string[];
  severities: string[];
  titlePattern?: string;
  threshold: number;
  timeWindowMinutes: number;
  notifySlack: boolean;
  notifyEmail: boolean;
  createJiraIssue: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
}

const EVENT_TYPES = [
  'finding.created',
  'finding.status_changed',
  'scan.started',
  'scan.completed',
  'scan.failed',
  'cspm.finding_detected',
  'auth.failed_login',
  'auth.password_changed',
  'api.key_created',
  'api.key_revoked',
  'system.error',
];

const SOURCES = ['scan', 'cspm', 'auth', 'api', 'webhook', 'system'];
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

export default function AlertRulesPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    eventTypes: [] as string[],
    sources: [] as string[],
    severities: [] as string[],
    titlePattern: '',
    threshold: 1,
    timeWindowMinutes: 5,
    notifySlack: false,
    notifyEmail: false,
    createJiraIssue: false,
  });

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await fetch(`${API_URL}/siem/rules`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setRules(data || []);
        } else {
          setRules([]);
        }
      } catch (err) {
        console.error('Failed to fetch alert rules:', err);
        setRules([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, []);

  const handleOpenModal = (rule?: AlertRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description || '',
        enabled: rule.enabled,
        eventTypes: rule.eventTypes || [],
        sources: rule.sources || [],
        severities: rule.severities || [],
        titlePattern: rule.titlePattern || '',
        threshold: rule.threshold,
        timeWindowMinutes: rule.timeWindowMinutes,
        notifySlack: rule.notifySlack,
        notifyEmail: rule.notifyEmail,
        createJiraIssue: rule.createJiraIssue,
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        enabled: true,
        eventTypes: [],
        sources: [],
        severities: [],
        titlePattern: '',
        threshold: 1,
        timeWindowMinutes: 5,
        notifySlack: false,
        notifyEmail: false,
        createJiraIssue: false,
      });
    }
    setShowModal(true);
  };

  const handleSaveRule = async () => {
    setSaving(true);
    try {
      const url = editingRule
        ? `${API_URL}/siem/rules/${editingRule.id}`
        : `${API_URL}/siem/rules`;
      const method = editingRule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const savedRule = await res.json();
        if (editingRule) {
          setRules(rules.map(r => r.id === savedRule.id ? savedRule : r));
        } else {
          setRules([...rules, savedRule]);
        }
        setShowModal(false);
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to save rule');
      }
    } catch (err) {
      setError('Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`${API_URL}/siem/rules/${ruleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await fetch(`${API_URL}/siem/rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleMultiSelect = (field: 'eventTypes' | 'sources' | 'severities', value: string) => {
    const current = formData[field];
    if (current.includes(value)) {
      setFormData({ ...formData, [field]: current.filter(v => v !== value) });
    } else {
      setFormData({ ...formData, [field]: [...current, value] });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading alert rules...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/siem"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alert Rules</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Configure rules to trigger alerts based on security events
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Rule
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card variant="bordered">
          <CardContent className="py-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400">No alert rules configured</p>
            <p className="text-sm text-gray-400">Create your first rule to start monitoring events</p>
            <Button onClick={() => handleOpenModal()} className="mt-4">
              Create Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id} variant="bordered">
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {/* Enable Toggle */}
                    <button
                      onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {rule.name}
                      </h3>
                      {rule.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {rule.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          Threshold: {rule.threshold} events in {rule.timeWindowMinutes}m
                        </span>
                        {rule.lastTriggeredAt && (
                          <span className="text-gray-500 dark:text-gray-400">
                            Last triggered: {new Date(rule.lastTriggeredAt).toLocaleString()}
                          </span>
                        )}
                        <span className="text-gray-500 dark:text-gray-400">
                          Triggered {rule.triggerCount} times
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rule.severities?.map((s) => (
                          <Badge key={s} variant="outline" size="sm">{s}</Badge>
                        ))}
                        {rule.sources?.map((s) => (
                          <Badge key={s} variant="info" size="sm">{s}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {rule.notifySlack && (
                          <Badge variant="success" size="sm">Slack</Badge>
                        )}
                        {rule.notifyEmail && (
                          <Badge variant="success" size="sm">Email</Badge>
                        )}
                        {rule.createJiraIssue && (
                          <Badge variant="success" size="sm">Jira</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenModal(rule)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="lg">
        <ModalHeader onClose={() => setShowModal(false)}>
          {editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rule Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                placeholder="e.g., Critical Finding Alert"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                rows={2}
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Threshold (events)
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time Window (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.timeWindowMinutes}
                  onChange={(e) => setFormData({ ...formData, timeWindowMinutes: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Severities
              </label>
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleMultiSelect('severities', s)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      formData.severities.includes(s)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sources
              </label>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleMultiSelect('sources', s)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      formData.sources.includes(s)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notifications
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.notifySlack}
                    onChange={(e) => setFormData({ ...formData, notifySlack: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Slack</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.notifyEmail}
                    onChange={(e) => setFormData({ ...formData, notifyEmail: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.createJiraIssue}
                    onChange={(e) => setFormData({ ...formData, createJiraIssue: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Create Jira Issue</span>
                </label>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveRule} disabled={saving || !formData.name}>
            {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

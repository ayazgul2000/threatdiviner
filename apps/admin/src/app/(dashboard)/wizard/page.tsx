'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  wizardApi,
  WizardQuestion,
  WizardOption,
  WizardCondition,
  WizardTrigger,
  WizardStats,
  WizardTestFlowResult,
  CreateWizardQuestionData,
  CreateWizardOptionData,
} from '@/lib/api';

// Question Types
const QUESTION_TYPES = ['single-select', 'multi-select', 'text', 'toggle'];
const CONDITION_OPERATORS = ['equals', 'not_equals', 'in', 'not_in', 'contains'];

// Status Badge Component
function StatusBadge({ status }: { status: string }): JSX.Element {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-900 text-yellow-300',
    review: 'bg-blue-900 text-blue-300',
    live: 'bg-green-900 text-green-300',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${colors[status] || 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  );
}

// Type Badge Component
function TypeBadge({ type }: { type: string }): JSX.Element {
  const colors: Record<string, string> = {
    'single-select': 'bg-purple-900 text-purple-300',
    'multi-select': 'bg-indigo-900 text-indigo-300',
    text: 'bg-cyan-900 text-cyan-300',
    toggle: 'bg-orange-900 text-orange-300',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${colors[type] || 'bg-gray-700 text-gray-300'}`}>
      {type}
    </span>
  );
}

export default function WizardPage(): JSX.Element {
  // State
  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [stats, setStats] = useState<WizardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [testFlowModalOpen, setTestFlowModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Selected items
  const [selectedQuestion, setSelectedQuestion] = useState<WizardQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<WizardOption | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<WizardQuestion | null>(null);

  // Form state
  const [questionForm, setQuestionForm] = useState<CreateWizardQuestionData>({
    questionId: '',
    text: '',
    helpText: '',
    type: 'single-select',
    orderIndex: 0,
    isEntryPoint: false,
    isTerminal: false,
    conditions: [],
  });

  const [optionForm, setOptionForm] = useState<CreateWizardOptionData>({
    value: '',
    label: '',
    description: '',
    iconUrl: '',
    nextQuestionId: '',
    triggers: {},
  });

  // Test flow state
  const [testAnswers, setTestAnswers] = useState<Array<{ questionId: string; selectedValue: string }>>([]);
  const [testResult, setTestResult] = useState<WizardTestFlowResult | null>(null);

  // Fetch questions
  const fetchQuestions = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const [questionsRes, statsRes] = await Promise.all([
        wizardApi.listQuestions({
          search: search || undefined,
          type: typeFilter || undefined,
          status: statusFilter || undefined,
        }),
        wizardApi.getStats(),
      ]);
      setQuestions(questionsRes.questions);
      setStats(statsRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Open question modal for create
  const openCreateQuestion = (): void => {
    setSelectedQuestion(null);
    setQuestionForm({
      questionId: '',
      text: '',
      helpText: '',
      type: 'single-select',
      orderIndex: questions.length,
      isEntryPoint: false,
      isTerminal: false,
      conditions: [],
    });
    setQuestionModalOpen(true);
  };

  // Open question modal for edit
  const openEditQuestion = async (question: WizardQuestion): Promise<void> => {
    try {
      const full = await wizardApi.getQuestion(question.id);
      setSelectedQuestion(full);
      setQuestionForm({
        questionId: full.questionId,
        text: full.text,
        helpText: full.helpText || '',
        type: full.type,
        orderIndex: full.orderIndex,
        isEntryPoint: full.isEntryPoint,
        isTerminal: full.isTerminal,
        conditions: full.conditions || [],
      });
      setQuestionModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question');
    }
  };

  // Save question
  const saveQuestion = async (): Promise<void> => {
    try {
      if (selectedQuestion) {
        await wizardApi.updateQuestion(selectedQuestion.id, questionForm);
      } else {
        await wizardApi.createQuestion(questionForm);
      }
      setQuestionModalOpen(false);
      fetchQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question');
    }
  };

  // Delete question
  const confirmDeleteQuestion = (question: WizardQuestion): void => {
    setQuestionToDelete(question);
    setDeleteConfirmOpen(true);
  };

  const deleteQuestion = async (): Promise<void> => {
    if (!questionToDelete) return;
    try {
      await wizardApi.deleteQuestion(questionToDelete.id);
      setDeleteConfirmOpen(false);
      setQuestionToDelete(null);
      fetchQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question');
    }
  };

  // Status actions
  const submitForReview = async (id: string): Promise<void> => {
    try {
      await wizardApi.submitForReview(id);
      fetchQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit for review');
    }
  };

  const approve = async (id: string): Promise<void> => {
    try {
      await wizardApi.approve(id);
      fetchQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  // Open option modal for create
  const openCreateOption = (question: WizardQuestion): void => {
    setSelectedQuestion(question);
    setSelectedOption(null);
    setOptionForm({
      value: '',
      label: '',
      description: '',
      iconUrl: '',
      nextQuestionId: '',
      triggers: {},
    });
    setOptionModalOpen(true);
  };

  // Open option modal for edit
  const openEditOption = async (question: WizardQuestion, option: WizardOption): Promise<void> => {
    setSelectedQuestion(question);
    setSelectedOption(option);
    setOptionForm({
      value: option.value,
      label: option.label,
      description: option.description || '',
      iconUrl: option.iconUrl || '',
      nextQuestionId: option.nextQuestionId || '',
      triggers: option.triggers || {},
    });
    setOptionModalOpen(true);
  };

  // Save option
  const saveOption = async (): Promise<void> => {
    if (!selectedQuestion) return;
    try {
      if (selectedOption) {
        await wizardApi.updateOption(selectedOption.id, optionForm);
      } else {
        await wizardApi.createOption(selectedQuestion.id, optionForm);
      }
      setOptionModalOpen(false);
      // Refresh the question to get updated options
      const updated = await wizardApi.getQuestion(selectedQuestion.id);
      setQuestions((prev) =>
        prev.map((q) => (q.id === updated.id ? { ...q, options: updated.options } : q))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save option');
    }
  };

  // Delete option
  const deleteOption = async (optionId: string): Promise<void> => {
    if (!selectedQuestion) return;
    try {
      await wizardApi.deleteOption(optionId);
      // Refresh the question
      const updated = await wizardApi.getQuestion(selectedQuestion.id);
      setQuestions((prev) =>
        prev.map((q) => (q.id === updated.id ? { ...q, options: updated.options } : q))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete option');
    }
  };

  // Reorder questions
  const moveQuestion = async (index: number, direction: 'up' | 'down'): Promise<void> => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const newOrder = [...questions];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];

    try {
      await wizardApi.reorderQuestions(newOrder.map((q) => q.id));
      fetchQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder questions');
    }
  };

  // Test flow
  const openTestFlow = (): void => {
    setTestAnswers([]);
    setTestResult(null);
    setTestFlowModalOpen(true);
  };

  const addTestAnswer = (questionId: string, selectedValue: string): void => {
    setTestAnswers((prev) => {
      // Remove any existing answer for this question
      const filtered = prev.filter((a) => a.questionId !== questionId);
      return [...filtered, { questionId, selectedValue }];
    });
  };

  const runTestFlow = async (): Promise<void> => {
    if (testAnswers.length === 0) return;
    try {
      const result = await wizardApi.testFlow(testAnswers);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run test flow');
    }
  };

  // Condition management
  const addCondition = (): void => {
    setQuestionForm((prev) => ({
      ...prev,
      conditions: [...(prev.conditions || []), { property: '', operator: 'equals', value: '' }],
    }));
  };

  const updateCondition = (index: number, field: keyof WizardCondition, value: string): void => {
    setQuestionForm((prev) => ({
      ...prev,
      conditions: (prev.conditions || []).map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      ),
    }));
  };

  const removeCondition = (index: number): void => {
    setQuestionForm((prev) => ({
      ...prev,
      conditions: (prev.conditions || []).filter((_, i) => i !== index),
    }));
  };

  // Trigger management helpers
  const addTriggerProperty = (key: string, value: string): void => {
    setOptionForm((prev) => ({
      ...prev,
      triggers: {
        ...prev.triggers,
        setProperties: {
          ...(prev.triggers?.setProperties || {}),
          [key]: value,
        },
      },
    }));
  };

  const removeTriggerProperty = (key: string): void => {
    setOptionForm((prev) => {
      const newProps = { ...(prev.triggers?.setProperties || {}) };
      delete newProps[key];
      return {
        ...prev,
        triggers: {
          ...prev.triggers,
          setProperties: newProps,
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-white">Wizard Questions</h1>
          <p className="mt-1 text-sm text-gray-400">
            Configure questionnaire flow for guided threat model creation.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openTestFlow}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            Test Flow
          </button>
          <button
            onClick={openCreateQuestion}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Question
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{stats.totalQuestions}</div>
            <div className="text-sm text-gray-400">Total Questions</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{stats.byStatus.live || 0}</div>
            <div className="text-sm text-gray-400">Live</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.byStatus.review || 0}</div>
            <div className="text-sm text-gray-400">In Review</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.byStatus.pending || 0}</div>
            <div className="text-sm text-gray-400">Pending</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{stats.entryPoints}</div>
            <div className="text-sm text-gray-400">Entry Points</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-400">{stats.orphanedQuestions}</div>
            <div className="text-sm text-gray-400">Orphaned</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded">
          {error}
          <button onClick={() => setError(null)} className="float-right text-red-400 hover:text-red-300">
            &times;
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 bg-gray-900 p-4 rounded-lg">
        <input
          type="text"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
        >
          <option value="">All Types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="review">In Review</option>
          <option value="live">Live</option>
        </select>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : questions.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">No wizard questions configured</h3>
          <p className="mt-2 text-sm text-gray-400">
            Create your first question to start building the wizard flow.
          </p>
          <button
            onClick={openCreateQuestion}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Question
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={question.id} className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-500 font-mono text-sm">{question.questionId}</span>
                    <TypeBadge type={question.type} />
                    <StatusBadge status={question.status} />
                    {question.isEntryPoint && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-emerald-900 text-emerald-300">
                        Entry Point
                      </span>
                    )}
                    {question.isTerminal && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-red-900 text-red-300">
                        Terminal
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-white">{question.text}</h3>
                  {question.helpText && (
                    <p className="text-sm text-gray-400 mt-1">{question.helpText}</p>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    Order: {question.orderIndex} | Options: {question._count?.options || question.options?.length || 0}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveQuestion(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                    title="Move Up"
                  >
                    &uarr;
                  </button>
                  <button
                    onClick={() => moveQuestion(index, 'down')}
                    disabled={index === questions.length - 1}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                    title="Move Down"
                  >
                    &darr;
                  </button>
                  <button
                    onClick={() => openEditQuestion(question)}
                    className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => openCreateOption(question)}
                    className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600"
                  >
                    + Option
                  </button>
                  {question.status === 'pending' && (
                    <button
                      onClick={() => submitForReview(question.id)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Submit
                    </button>
                  )}
                  {question.status === 'review' && (
                    <button
                      onClick={() => approve(question.id)}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                  )}
                  <button
                    onClick={() => confirmDeleteQuestion(question)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Options */}
              {question.options && question.options.length > 0 && (
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <div className="text-sm font-medium text-gray-400 mb-2">Options:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {question.options.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center justify-between bg-gray-800 rounded p-2"
                      >
                        <div>
                          <span className="text-white font-medium">{option.label}</span>
                          <span className="text-gray-500 ml-2">({option.value})</span>
                          {option.nextQuestionId && (
                            <span className="text-blue-400 ml-2 text-sm">
                              → {option.nextQuestionId}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditOption(question, option)}
                            className="text-gray-400 hover:text-white text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteOption(option.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Question Modal */}
      {questionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">
              {selectedQuestion ? 'Edit Question' : 'Add Question'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Question ID *</label>
                  <input
                    type="text"
                    value={questionForm.questionId}
                    onChange={(e) => setQuestionForm({ ...questionForm, questionId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                    placeholder="q_app_type"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Order Index</label>
                  <input
                    type="number"
                    value={questionForm.orderIndex}
                    onChange={(e) => setQuestionForm({ ...questionForm, orderIndex: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Question Text *</label>
                <input
                  type="text"
                  value={questionForm.text}
                  onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                  placeholder="What type of application are you building?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Help Text</label>
                <textarea
                  value={questionForm.helpText}
                  onChange={(e) => setQuestionForm({ ...questionForm, helpText: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                  rows={2}
                  placeholder="Additional guidance for the user..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Type *</label>
                <select
                  value={questionForm.type}
                  onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={questionForm.isEntryPoint}
                    onChange={(e) => setQuestionForm({ ...questionForm, isEntryPoint: e.target.checked })}
                    className="rounded bg-gray-800 border-gray-700"
                  />
                  Entry Point
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={questionForm.isTerminal}
                    onChange={(e) => setQuestionForm({ ...questionForm, isTerminal: e.target.checked })}
                    className="rounded bg-gray-800 border-gray-700"
                  />
                  Terminal Question
                </label>
              </div>

              {/* Conditions */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-400">Conditions (show question only if)</label>
                  <button
                    onClick={addCondition}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    + Add Condition
                  </button>
                </div>
                {questionForm.conditions && questionForm.conditions.length > 0 && (
                  <div className="space-y-2">
                    {questionForm.conditions.map((condition, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={condition.property}
                          onChange={(e) => updateCondition(index, 'property', e.target.value)}
                          className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          placeholder="property"
                        />
                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                        >
                          {CONDITION_OPERATORS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, 'value', e.target.value)}
                          className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                          placeholder="value"
                        />
                        <button
                          onClick={() => removeCondition(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setQuestionModalOpen(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={saveQuestion}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Option Modal */}
      {optionModalOpen && selectedQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">
              {selectedOption ? 'Edit Option' : 'Add Option'} for {selectedQuestion.questionId}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Value *</label>
                  <input
                    type="text"
                    value={optionForm.value}
                    onChange={(e) => setOptionForm({ ...optionForm, value: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                    placeholder="web-app"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Label *</label>
                  <input
                    type="text"
                    value={optionForm.label}
                    onChange={(e) => setOptionForm({ ...optionForm, label: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                    placeholder="Web Application"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                <textarea
                  value={optionForm.description}
                  onChange={(e) => setOptionForm({ ...optionForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Icon URL</label>
                  <input
                    type="text"
                    value={optionForm.iconUrl}
                    onChange={(e) => setOptionForm({ ...optionForm, iconUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                    placeholder="/icons/web-app.svg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Next Question ID</label>
                  <select
                    value={optionForm.nextQuestionId}
                    onChange={(e) => setOptionForm({ ...optionForm, nextQuestionId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                  >
                    <option value="">None (Terminal)</option>
                    {questions
                      .filter((q) => q.questionId !== selectedQuestion.questionId)
                      .map((q) => (
                        <option key={q.id} value={q.questionId}>
                          {q.questionId} - {q.text.substring(0, 40)}...
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Triggers - Global Properties */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-400">Set Global Properties</label>
                  <button
                    onClick={() => addTriggerProperty('', '')}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    + Add Property
                  </button>
                </div>
                {optionForm.triggers?.setProperties &&
                  Object.entries(optionForm.triggers.setProperties).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(optionForm.triggers.setProperties).map(([key, value]) => (
                        <div key={key} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={key}
                            onChange={(e) => {
                              const oldKey = key;
                              const newKey = e.target.value;
                              setOptionForm((prev) => {
                                const props = { ...(prev.triggers?.setProperties || {}) };
                                delete props[oldKey];
                                props[newKey] = value;
                                return {
                                  ...prev,
                                  triggers: { ...prev.triggers, setProperties: props },
                                };
                              });
                            }}
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                            placeholder="key"
                          />
                          <span className="text-gray-500">=</span>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => addTriggerProperty(key, e.target.value)}
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                            placeholder="value"
                          />
                          <button
                            onClick={() => removeTriggerProperty(key)}
                            className="text-red-400 hover:text-red-300"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setOptionModalOpen(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={saveOption}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Flow Modal */}
      {testFlowModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">Test Wizard Flow</h2>
            <div className="grid grid-cols-2 gap-6">
              {/* Simulator */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Simulator</h3>
                <div className="space-y-4">
                  {questions
                    .filter((q) => q.status === 'live' || q.status === 'review')
                    .map((q) => (
                      <div key={q.id} className="bg-gray-800 rounded p-3">
                        <div className="text-white font-medium mb-2">{q.text}</div>
                        <div className="space-y-1">
                          {q.options?.map((opt) => (
                            <label key={opt.id} className="flex items-center gap-2 text-gray-300">
                              <input
                                type="radio"
                                name={`q_${q.questionId}`}
                                checked={testAnswers.some(
                                  (a) => a.questionId === q.questionId && a.selectedValue === opt.value
                                )}
                                onChange={() => addTestAnswer(q.questionId, opt.value)}
                                className="text-blue-600"
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
                <button
                  onClick={runTestFlow}
                  disabled={testAnswers.length === 0}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Run Test
                </button>
              </div>

              {/* Results */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Results</h3>
                {testResult ? (
                  <div className="space-y-4">
                    <div className="bg-gray-800 rounded p-3">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Path Taken</h4>
                      <div className="space-y-1">
                        {testResult.path.map((p, i) => (
                          <div key={i} className="text-white text-sm">
                            {i + 1}. {p.questionText} → <span className="text-blue-400">{p.selectedValue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded p-3">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Global Properties</h4>
                      <pre className="text-xs text-green-400">
                        {JSON.stringify(testResult.globalProperties, null, 2)}
                      </pre>
                    </div>
                    {testResult.boundaries.length > 0 && (
                      <div className="bg-gray-800 rounded p-3">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Boundaries Added</h4>
                        <ul className="text-sm text-white">
                          {testResult.boundaries.map((b, i) => (
                            <li key={i}>
                              {b.name} ({b.type})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {testResult.nodes.length > 0 && (
                      <div className="bg-gray-800 rounded p-3">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Nodes Added</h4>
                        <ul className="text-sm text-white">
                          {testResult.nodes.map((n, i) => (
                            <li key={i}>
                              {n.name} ({n.technology || 'generic'})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {testResult.links.length > 0 && (
                      <div className="bg-gray-800 rounded p-3">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Links Added</h4>
                        <ul className="text-sm text-white">
                          {testResult.links.map((l, i) => (
                            <li key={i}>
                              {l.sourceRef} → {l.targetRef}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-center py-8">
                    Select options and run test to see results
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setTestFlowModalOpen(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && questionToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Delete Question</h2>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete <strong>{questionToDelete.questionId}</strong>?
              This will also delete all its options.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={deleteQuestion}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

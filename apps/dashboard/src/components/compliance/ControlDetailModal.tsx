'use client';

import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge } from '@/components/ui';
import { GapData } from './GapCard';

interface ControlDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  control: GapData | null;
  onViewRemediation?: () => void;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const statusStyles: Record<string, { icon: string; color: string; label: string }> = {
  gap: { icon: '✗', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30', label: 'Gap' },
  partial: { icon: '◐', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30', label: 'Partial' },
  satisfied: { icon: '✓', color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30', label: 'Satisfied' },
};

export function ControlDetailModal({
  isOpen,
  onClose,
  control,
  onViewRemediation,
}: ControlDetailModalProps) {
  if (!control) return null;

  const status = statusStyles[control.gapStatus];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {control.controlId}
          </span>
          <Badge variant="outline">{control.frameworkName}</Badge>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          {/* Control Name */}
          <div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              {control.controlName}
            </h3>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${status.color}`}>
              <span>{status.icon}</span>
              <span className="font-medium">{status.label}</span>
            </div>
          </div>

          {/* Control Description - Placeholder since v4.1.0 doesn't include it yet */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Description
            </h4>
            <p className="text-gray-700 dark:text-gray-300">
              {/* This field will be populated when the API includes control.description */}
              Control description not available. This information will be provided in a future update.
            </p>
          </div>

          {/* Control Guidance - Placeholder */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Implementation Guidance
            </h4>
            <p className="text-gray-700 dark:text-gray-300">
              {/* This field will be populated when the API includes control.guidance */}
              Implementation guidance not available. This information will be provided in a future update.
            </p>
          </div>

          {/* Related Risks */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Related Risks ({control.relatedRisks.length})
            </h4>
            {control.relatedRisks.length > 0 ? (
              <div className="space-y-2">
                {control.relatedRisks.map((risk, index) => (
                  <div
                    key={`${risk.threatId}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {risk.canonicalRiskTitle}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Threat: {risk.threatTitle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${severityColors[risk.severity]}`}>
                        {risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1)}
                      </span>
                      {risk.mitigationStatus && (
                        <Badge variant="secondary" size="sm">
                          {risk.mitigationStatus.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                No risks directly associated with this control.
              </p>
            )}
          </div>

          {/* Relevance */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Mapping Relevance
            </h4>
            <Badge variant="outline">{control.relevance}</Badge>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {control.gapStatus !== 'satisfied' && onViewRemediation && (
          <Button onClick={onViewRemediation}>
            View Remediation
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

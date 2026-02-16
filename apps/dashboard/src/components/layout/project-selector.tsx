'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useProject } from '@/contexts/project-context';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, useToast } from '@/components/ui';

export function ProjectSelector() {
  const { projects, currentProject, setCurrentProject, createProject, loading } = useProject();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'below' | 'above'>('below');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toastCtx = useToast();

  // Calculate dropdown position when opening
  useEffect(() => {
    if (!showDropdown || !buttonRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const dropdownHeight = Math.min(256, projects.length * 40 + 48); // max-h-64 = 256px

    // Position above if not enough space below and more space above
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      setDropdownPosition('above');
    } else {
      setDropdownPosition('below');
    }
  }, [showDropdown, projects.length]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleSelect = useCallback((project: typeof currentProject) => {
    // Avoid unnecessary state updates if same project
    if (project?.id === currentProject?.id) {
      setShowDropdown(false);
      return;
    }
    setCurrentProject(project);
    setShowDropdown(false);
  }, [currentProject?.id, setCurrentProject]);

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setCreating(true);
    try {
      await createProject(newName.trim(), newDesc.trim() || undefined);
      toastCtx.success('Project created', 'Your new project is ready');
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    } catch (e: unknown) {
      toastCtx.error('Error', e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="px-3 py-2">
        <div className="h-10 bg-gray-700 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="px-3 py-2 relative">
        <button
          ref={buttonRef}
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:border-blue-500 hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="truncate text-sm font-medium text-gray-100">
              {currentProject?.name || 'Select Project'}
            </span>
          </div>
          <svg
            className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <div
            ref={dropdownRef}
            className={`absolute left-3 right-3 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto transition-opacity duration-150 ${
              dropdownPosition === 'above'
                ? 'bottom-full mb-1'
                : 'top-full mt-1'
            }`}
          >
            {projects.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400">
                No projects yet
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project)}
                  className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700 text-left transition-colors ${
                    currentProject?.id === project.id ? 'bg-gray-700/50' : ''
                  }`}
                >
                  <span className="truncate text-sm text-gray-100">{project.name}</span>
                  {currentProject?.id === project.id && (
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            )}
            <div className="border-t border-gray-700">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  setShowCreate(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-left text-sm text-blue-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Project
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)}>
        <ModalHeader onClose={() => setShowCreate(false)}>Create New Project</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                placeholder="My Application"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                placeholder="Brief description of what this project/application does"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!newName.trim()} loading={creating}>
            Create Project
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

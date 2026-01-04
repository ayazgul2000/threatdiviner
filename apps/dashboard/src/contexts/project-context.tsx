'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  _count?: {
    repositories: number;
    scans: number;
    findings: number;
    threatModels: number;
  };
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createProject: (name: string, description?: string) => Promise<Project>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

const STORAGE_KEY = 'threatdiviner_current_project';

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch projects');

      const data = await res.json();
      setProjects(data);

      // Restore saved project or select first
      const savedProjectId = localStorage.getItem(STORAGE_KEY);
      if (savedProjectId) {
        const savedProject = data.find((p: Project) => p.id === savedProjectId);
        if (savedProject) {
          setCurrentProjectState(savedProject);
        } else if (data.length > 0) {
          setCurrentProjectState(data[0]);
        }
      } else if (data.length > 0) {
        setCurrentProjectState(data[0]);
      }

      setError(null);
    } catch (e: unknown) {
      console.error('Failed to fetch projects:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const setCurrentProject = useCallback((project: Project | null) => {
    setCurrentProjectState(project);
    if (project) {
      localStorage.setItem(STORAGE_KEY, project.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const createProject = useCallback(async (name: string, description?: string): Promise<Project> => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, description }),
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create project');
    }

    const newProject = await res.json();
    setProjects((prev) => [newProject, ...prev]);
    setCurrentProject(newProject);
    return newProject;
  }, [setCurrentProject]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        setCurrentProject,
        loading,
        error,
        refetch: fetchProjects,
        createProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

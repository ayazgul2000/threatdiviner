'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  accept?: string;
  className?: string;
}

const SUPPORTED_EXTENSIONS = [
  '.yaml',
  '.yml',
  '.json',
  '.tf',
  '.drawio',
  '.xml',
];

export function FileUploader({
  onFileSelect,
  isLoading = false,
  accept = '.yaml,.yml,.json,.tf,.drawio,.xml',
  className,
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
      return false;
    }
    setError(null);
    return true;
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (isLoading) return;

      const file = e.dataTransfer.files[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect, isLoading]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [onFileSelect]
  );

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600',
          isLoading && 'opacity-50 pointer-events-none'
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isLoading}
        />

        <div className="space-y-4">
          {isLoading ? (
            <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {isLoading ? 'Parsing file...' : 'Drop a file here, or click to browse'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Supports OpenAPI (YAML/JSON), Terraform (.tf), Draw.io (.drawio/.xml)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </div>
      )}

      {/* Supported file types */}
      <div className="grid grid-cols-3 gap-2">
        <FileTypeBadge icon={<OpenApiIcon />} label="OpenAPI" extensions=".yaml, .yml, .json" />
        <FileTypeBadge icon={<TerraformIcon />} label="Terraform" extensions=".tf" />
        <FileTypeBadge icon={<DrawioIcon />} label="Draw.io" extensions=".drawio, .xml" />
      </div>
    </div>
  );
}

function FileTypeBadge({
  icon,
  label,
  extensions,
}: {
  icon: React.ReactNode;
  label: string;
  extensions: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="w-8 h-8 flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-xs font-medium text-gray-900 dark:text-white">{label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{extensions}</div>
      </div>
    </div>
  );
}

function OpenApiIcon() {
  return (
    <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm-.25 4.5h.5v7h-.5v-7zm-3.75 3h.5v4h-.5v-4zm7.5 0h.5v4h-.5v-4zm-3.75 6h.5v6h-.5v-6z" />
    </svg>
  );
}

function TerraformIcon() {
  return (
    <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1.44 0v7.575l6.56 3.79V3.79L1.44 0zm8 4.22v7.575l6.56 3.787V7.997L9.44 4.22zm0 9.01v7.575L16 24.59v-7.575l-6.56-3.785zM17.44 8v7.575l6.56-3.787V4.21L17.44 8z" />
    </svg>
  );
}

function DrawioIcon() {
  return (
    <svg className="w-5 h-5 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.69 7.154l-5.344-3.085a1.5 1.5 0 00-1.5 0L4.306 8.986a1.5 1.5 0 00-.75 1.3v6.17a1.5 1.5 0 00.75 1.3l5.344 3.086a1.5 1.5 0 001.5 0l8.54-4.917a1.5 1.5 0 00.75-1.3V8.454a1.5 1.5 0 00-.75-1.3zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" />
    </svg>
  );
}

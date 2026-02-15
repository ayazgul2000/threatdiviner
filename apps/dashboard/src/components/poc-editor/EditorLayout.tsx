'use client';

import { Palette } from './panels/Palette';
import { PropertyPanel } from './panels/PropertyPanel';
import { EditorCanvas } from './EditorCanvas';
import { StatusBar } from './StatusBar';

/**
 * Full-screen editor layout:
 * ┌─────────┬──────────────────────────┬───────────┐
 * │         │                          │           │
 * │ Palette │       Canvas             │ Property  │
 * │  (240)  │      (flex-1)            │  Panel    │
 * │         │                          │  (288)    │
 * │         │                          │           │
 * ├─────────┴──────────────────────────┴───────────┤
 * │                Status Bar                       │
 * └─────────────────────────────────────────────────┘
 */
export function EditorLayout() {
  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-gray-950">
      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Palette */}
        <Palette />

        {/* Center: Canvas */}
        <EditorCanvas />

        {/* Right: Property Panel (conditionally rendered) */}
        <PropertyPanel />
      </div>

      {/* Bottom: Status Bar */}
      <StatusBar />
    </div>
  );
}

# Draw.io Integration Fixes

## Issue 1: Lock Not Extending During Editing

**Problem:** `refreshLock()` is aliased to `checkLock()` which only GETs lock status — doesn't extend the 5-minute expiry. Lock will expire while user is actively editing.

**File:** `apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx`

**Current (BROKEN):**
```tsx
// Auto-refresh lock
useEffect(() => {
  if (!isLockedByMe) return;
  const interval = setInterval(() => {
    refreshLock();  // ← This just checks status, doesn't extend!
  }, 60000);
  return () => clearInterval(interval);
}, [isLockedByMe, refreshLock]);
```

**Fix:**
```tsx
// Auto-refresh lock - call acquireLock to extend expiry
useEffect(() => {
  if (!isLockedByMe || !user) return;
  const interval = setInterval(() => {
    acquireLock(user.name || user.email || 'Unknown User');  // ← Re-acquire extends lock
  }, 60000); // Every minute
  return () => clearInterval(interval);
}, [isLockedByMe, user, acquireLock]);
```

---

## Issue 2: Draw.io Selection Events Not Firing

**Problem:** Draw.io embed API doesn't send `select`/`selectionChanged` events by default. The code listens for events that never fire, so PropertyPanel never updates when user clicks a shape.

**File:** `apps/dashboard/src/components/threat-modeling/DrawioEmbed.tsx`

### Fix Part A: Enable selection events in URL params

**Current:**
```tsx
const params = new URLSearchParams({
  embed: '1',
  proto: 'json',
  // ... other params
});
```

**Fix:**
```tsx
const params = new URLSearchParams({
  embed: '1',
  proto: 'json',
  spin: '1',
  modified: 'unsavedChanges',
  keepmodified: '1',
  libraries: '1',
  noSaveBtn: readOnly ? '1' : '0',
  saveAndExit: '0',
  noExitBtn: '1',
  libs: 'general;aws4;azure;gcp2;network;clipart;flowchart;uml;er;mscae',
  ui: 'kennedy',
  dark: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? '1' : '0',
  // ADD: Request selection change notifications
  configure: '1',  // Enable configuration message
});
```

### Fix Part B: Send configure message on init to enable selection events

**Add after `case 'init':`**
```tsx
case 'init':
  setIsReady(true);
  onReady?.();
  
  // Configure Draw.io to send selection events
  sendMessage('configure', {
    config: {
      // Enable selection change events
      selectionChangeEvent: true,
    }
  });
  
  // Load initial XML if provided
  if (initialXml) {
    sendMessage('load', { xml: initialXml });
  }
  break;
```

### Fix Part C: Alternative approach - Poll for selection on click

If configure doesn't work reliably, use click detection + polling:

**Add to DrawioEmbed component:**
```tsx
// Track iframe focus to detect potential selection changes
const [iframeFocused, setIframeFocused] = useState(false);

// When iframe is clicked, poll for current selection
useEffect(() => {
  if (!iframeFocused || !isReady) return;
  
  // Small delay to let Draw.io process the click
  const timeout = setTimeout(() => {
    // Request current selection via action
    sendMessageWithCallback<{ cells: string[] }>('getSelectedCells', {}).then((result) => {
      if (result?.cells && result.cells.length > 0) {
        const cellId = result.cells[0];
        const cellData = parseCellFromXml(currentXmlRef.current, cellId);
        onSelectionChange?.(cellId, cellData);
      } else {
        onSelectionChange?.(null, null);
      }
    });
  }, 100);
  
  return () => clearTimeout(timeout);
}, [iframeFocused, isReady]);

// In the iframe element:
<iframe
  ref={iframeRef}
  src={drawioUrl.toString()}
  className="w-full h-full border-0"
  style={{ opacity: isReady ? 1 : 0 }}
  title="Diagram Editor"
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
  onFocus={() => setIframeFocused(true)}
  onBlur={() => setIframeFocused(false)}
/>
```

### Fix Part D: Most Reliable - Use postMessage prompt action

**Replace the entire selection handling with this approach:**

Draw.io's `prompt` action can request data. After any interaction, we can request the current selection:

```tsx
// Request current selection from Draw.io
const requestSelection = useCallback(() => {
  if (!isReady) return;
  
  // Use the 'status' action which returns selection info
  sendMessageWithCallback<{ 
    modified: boolean; 
    selection: { id: string; value: string; style: string }[] 
  }>('status', {}).then((result) => {
    if (result?.selection && result.selection.length > 0) {
      const selected = result.selection[0];
      const cellData = parseCellFromXml(currentXmlRef.current, selected.id);
      onSelectionChange?.(selected.id, cellData);
    } else {
      onSelectionChange?.(null, null);
    }
  });
}, [isReady, sendMessageWithCallback, parseCellFromXml, currentXmlRef, onSelectionChange]);

// Poll for selection every 500ms when iframe has focus
useEffect(() => {
  if (!isReady) return;
  
  const interval = setInterval(() => {
    requestSelection();
  }, 500);
  
  return () => clearInterval(interval);
}, [isReady, requestSelection]);
```

---

## Complete Fixed DrawioEmbed.tsx

Here's the key sections with all fixes applied:

```tsx
'use client';

import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';

// ... interfaces remain the same ...

const DRAWIO_URL = 'https://embed.diagrams.net/';

const DrawioEmbed = forwardRef<DrawioEmbedRef, DrawioEmbedProps>(({
  initialXml,
  onXmlChange,
  onSelectionChange,
  readOnly = false,
  onReady,
  onSave,
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const pendingCallbacks = useRef<Map<string, (data: any) => void>>(new Map());
  const currentXmlRef = useRef<string>(initialXml || '');
  const lastSelectionRef = useRef<string | null>(null);

  // ... parseCellFromXml, sendMessage, sendMessageWithCallback remain the same ...

  // Poll for selection changes
  const checkSelection = useCallback(async () => {
    if (!isReady || !iframeRef.current) return;
    
    try {
      const result = await sendMessageWithCallback<{ xml: string }>('export', { format: 'xml' });
      if (result?.xml) {
        currentXmlRef.current = result.xml;
        
        // Parse XML to find selected cells (cells with selected="1" attribute)
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.xml, 'text/xml');
        
        // Look for mxCell elements - we can't reliably detect selection from XML alone
        // So we use a different approach: track the last clicked cell via message
      }
    } catch (err) {
      // Ignore polling errors
    }
  }, [isReady, sendMessageWithCallback]);

  // Handle messages from Draw.io
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('diagrams.net') && !event.origin.includes('draw.io')) {
        return;
      }

      let data: any;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      // Handle callback responses
      if (data.callbackId && pendingCallbacks.current.has(data.callbackId)) {
        const callback = pendingCallbacks.current.get(data.callbackId);
        pendingCallbacks.current.delete(data.callbackId);
        callback?.(data);
        return;
      }

      switch (data.event) {
        case 'init':
          setIsReady(true);
          onReady?.();
          
          // Load initial XML if provided
          if (initialXml) {
            sendMessage('load', { xml: initialXml });
          }
          break;

        case 'load':
          // Diagram loaded - update our reference
          if (data.xml) {
            currentXmlRef.current = data.xml;
          }
          break;

        case 'save':
          onSave?.(data.xml);
          break;

        case 'autosave':
          currentXmlRef.current = data.xml;
          onXmlChange?.(data.xml);
          break;

        case 'export':
          // Export completed - handled by callbacks
          break;

        case 'select':
        case 'selectionChanged':
        case 'cells':
          // Handle selection if Draw.io sends it (may vary by version)
          const selectedCells = data.cells || data.selected || data.ids || [];
          if (selectedCells.length > 0) {
            const cellId = selectedCells[0];
            if (cellId !== lastSelectionRef.current) {
              lastSelectionRef.current = cellId;
              const cellData = parseCellFromXml(currentXmlRef.current, cellId);
              onSelectionChange?.(cellId, cellData);
            }
          } else if (lastSelectionRef.current !== null) {
            lastSelectionRef.current = null;
            onSelectionChange?.(null, null);
          }
          break;

        case 'change':
          // Diagram changed - get updated XML
          sendMessageWithCallback<{ xml: string }>('export', { format: 'xml' }).then((result) => {
            if (result?.xml) {
              currentXmlRef.current = result.xml;
              onXmlChange?.(result.xml);
            }
          });
          break;
          
        case 'configure':
          // Respond to configure request - enable selection events
          sendMessage('configure', {
            config: {
              defaultFonts: ['Helvetica', 'Arial'],
            }
          });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [initialXml, onXmlChange, onSelectionChange, onReady, onSave, sendMessage, sendMessageWithCallback, parseCellFromXml]);

  // Expose method to manually request selection (for button click)
  const refreshSelection = useCallback(async () => {
    if (!isReady) return;
    
    // Get current XML and let parent parse selection from UI interaction
    const result = await sendMessageWithCallback<{ xml: string }>('export', { format: 'xml' });
    if (result?.xml) {
      currentXmlRef.current = result.xml;
      onXmlChange?.(result.xml);
    }
  }, [isReady, sendMessageWithCallback, onXmlChange]);

  // ... rest of the component ...

  // Build URL with configure=1 to enable config message
  const drawioUrl = new URL(DRAWIO_URL);
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    spin: '1',
    modified: 'unsavedChanges',
    keepmodified: '1',
    libraries: '1',
    noSaveBtn: readOnly ? '1' : '0',
    saveAndExit: '0',
    noExitBtn: '1',
    libs: 'general;aws4;azure;gcp2;network;clipart;flowchart;uml;er;mscae',
    ui: 'kennedy',
    dark: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? '1' : '0',
    configure: '1',
  });
  drawioUrl.search = params.toString();

  // ... return JSX ...
});
```

---

## Alternative: Add "Refresh Properties" Button

If postMessage selection events remain unreliable, add a manual refresh button:

**In diagram/page.tsx toolbar:**
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={async () => {
    // Get current XML and parse selected cell from Draw.io's internal state
    const xml = await drawioRef.current?.getXml();
    if (xml) {
      // User can click this after selecting a shape
      // We'd need Draw.io to tell us which cell is selected
      // For now, show a prompt to enter cell ID or use a picker
      toast.info('Click a shape in the diagram, then use the property panel to edit it');
    }
  }}
>
  🔄 Refresh Selection
</Button>
```

---

---

## Issue 3: setCustomProperty/getCustomProperties Don't Work

**Problem:** The `setCustomProperty` and `getCustomProperties` methods send postMessage actions (`setCustomProperty`, `getCustomProperties`) that Draw.io's embed API doesn't support. These are made-up actions that will silently fail. When user edits properties in PropertyPanel and clicks Apply, nothing happens — changes are lost.

**File:** `apps/dashboard/src/components/threat-modeling/DrawioEmbed.tsx`

**Current (BROKEN):**
```tsx
// Set custom property on a cell - THIS DOESN'T WORK
const setCustomProperty = useCallback((cellId: string, key: string, value: any) => {
  sendMessage('setCustomProperty', { cellId, key, value });  // ← Fake action, Draw.io ignores it
}, [sendMessage]);

// Get custom properties for a cell - THIS DOESN'T WORK
const getCustomProperties = useCallback(async (cellId: string): Promise<Record<string, any>> => {
  const result = await sendMessageWithCallback<{ properties: Record<string, any> }>('getCustomProperties', { cellId });  // ← Fake action
  return result?.properties || {};
}, [sendMessageWithCallback]);
```

**Fix:** Manipulate XML locally, then reload into Draw.io:

```tsx
// Set custom property on a cell by modifying XML locally
const setCustomProperty = useCallback((cellId: string, key: string, value: any) => {
  if (!currentXmlRef.current) return;
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentXmlRef.current, 'text/xml');
    
    // Find the cell - could be mxCell or Object element
    let targetEl = doc.querySelector(`mxCell[id="${cellId}"]`);
    let objectEl = doc.querySelector(`object[id="${cellId}"]`);
    
    if (objectEl) {
      // Object element exists - set attribute directly
      objectEl.setAttribute(key, String(value));
    } else if (targetEl) {
      // No object element - need to wrap mxCell in Object or add child Object
      // Option 1: Add as mxCell attribute (simpler but less standard)
      // Option 2: Create Object wrapper (more correct for custom data)
      
      // Using Option 1 for simplicity - add as data-* attribute on mxCell
      targetEl.setAttribute(`data-${key}`, String(value));
      
      // Alternative Option 2: Create/update child Object element
      // let childObject = targetEl.querySelector('Object[as="customData"]');
      // if (!childObject) {
      //   childObject = doc.createElement('Object');
      //   childObject.setAttribute('as', 'customData');
      //   targetEl.appendChild(childObject);
      // }
      // childObject.setAttribute(key, String(value));
    } else {
      console.warn(`Cell ${cellId} not found in XML`);
      return;
    }
    
    // Serialize back to string
    const serializer = new XMLSerializer();
    const newXml = serializer.serializeToString(doc);
    currentXmlRef.current = newXml;
    
    // Reload into Draw.io
    sendMessage('load', { xml: newXml });
    
    // Notify parent of change
    onXmlChange?.(newXml);
  } catch (err) {
    console.error('Failed to set custom property:', err);
  }
}, [sendMessage, onXmlChange]);

// Set multiple custom properties at once (more efficient - single reload)
const setCustomProperties = useCallback((cellId: string, properties: Record<string, any>) => {
  if (!currentXmlRef.current) return;
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentXmlRef.current, 'text/xml');
    
    let targetEl = doc.querySelector(`mxCell[id="${cellId}"]`);
    let objectEl = doc.querySelector(`object[id="${cellId}"]`);
    
    const elementToUpdate = objectEl || targetEl;
    if (!elementToUpdate) {
      console.warn(`Cell ${cellId} not found in XML`);
      return;
    }
    
    // Set all properties
    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined && value !== null) {
        elementToUpdate.setAttribute(objectEl ? key : `data-${key}`, String(value));
      }
    }
    
    // Serialize and reload
    const serializer = new XMLSerializer();
    const newXml = serializer.serializeToString(doc);
    currentXmlRef.current = newXml;
    
    sendMessage('load', { xml: newXml });
    onXmlChange?.(newXml);
  } catch (err) {
    console.error('Failed to set custom properties:', err);
  }
}, [sendMessage, onXmlChange]);

// Get custom properties for a cell by parsing XML locally
const getCustomProperties = useCallback(async (cellId: string): Promise<Record<string, any>> => {
  if (!currentXmlRef.current) return {};
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentXmlRef.current, 'text/xml');
    
    const properties: Record<string, any> = {};
    
    // Check Object element first
    const objectEl = doc.querySelector(`object[id="${cellId}"]`);
    if (objectEl) {
      Array.from(objectEl.attributes).forEach(attr => {
        if (!['id', 'label'].includes(attr.name)) {
          properties[attr.name] = attr.value;
        }
      });
    }
    
    // Also check mxCell for data-* attributes
    const cellEl = doc.querySelector(`mxCell[id="${cellId}"]`);
    if (cellEl) {
      Array.from(cellEl.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          const key = attr.name.replace('data-', '');
          properties[key] = attr.value;
        }
      });
    }
    
    return properties;
  } catch (err) {
    console.error('Failed to get custom properties:', err);
    return {};
  }
}, []);
```

**Also update `parseCellFromXml` to read data-* attributes:**

```tsx
const parseCellFromXml = useCallback((xml: string, cellId: string): DrawioCellData | null => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const cell = doc.querySelector(`mxCell[id="${cellId}"]`);
    if (!cell) return null;

    const geometry = cell.querySelector('mxGeometry');
    const style = cell.getAttribute('style') || '';
    const value = cell.getAttribute('value') || '';

    // Parse custom properties from multiple sources
    const customProperties: Record<string, any> = {};
    
    // 1. From Object element with same ID
    const objectEl = doc.querySelector(`object[id="${cellId}"]`);
    if (objectEl) {
      Array.from(objectEl.attributes).forEach(attr => {
        if (!['id', 'label'].includes(attr.name)) {
          customProperties[attr.name] = attr.value;
        }
      });
    }
    
    // 2. From data-* attributes on mxCell
    Array.from(cell.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) {
        const key = attr.name.replace('data-', '');
        customProperties[key] = attr.value;
      }
    });
    
    // 3. From child Object element
    const childObject = cell.querySelector('Object[as="customData"], Object[as="threagileData"]');
    if (childObject) {
      Array.from(childObject.attributes).forEach(attr => {
        if (!['as'].includes(attr.name)) {
          customProperties[attr.name] = attr.value;
        }
      });
    }

    return {
      id: cellId,
      value: objectEl?.getAttribute('label') || value,
      style,
      geometry: {
        x: parseFloat(geometry?.getAttribute('x') || '0'),
        y: parseFloat(geometry?.getAttribute('y') || '0'),
        width: parseFloat(geometry?.getAttribute('width') || '100'),
        height: parseFloat(geometry?.getAttribute('height') || '60'),
      },
      customProperties,
    };
  } catch (err) {
    console.error('Failed to parse cell from XML:', err);
    return null;
  }
}, []);
```

**Update useImperativeHandle to expose new methods:**

```tsx
useImperativeHandle(ref, () => ({
  getXml,
  setXml,
  exportPng,
  exportSvg,
  setCustomProperty,
  setCustomProperties,  // Add batch method
  getCustomProperties,
}), [getXml, setXml, exportPng, exportSvg, setCustomProperty, setCustomProperties, getCustomProperties]);
```

**Update DrawioEmbedRef interface:**

```tsx
export interface DrawioEmbedRef {
  getXml: () => Promise<string>;
  setXml: (xml: string) => void;
  exportPng: () => Promise<Blob>;
  exportSvg: () => Promise<string>;
  setCustomProperty: (cellId: string, key: string, value: any) => void;
  setCustomProperties: (cellId: string, properties: Record<string, any>) => void;  // Add this
  getCustomProperties: (cellId: string) => Promise<Record<string, any>>;
}
```

---

## Also Update: useDrawioPropertyBridge Hook

**File:** `apps/dashboard/src/hooks/useDrawioPropertyBridge.ts`

The hook calls `drawioRef.current.setCustomProperty()` in a loop. Update to use batch method:

**Current (INEFFICIENT):**
```tsx
const updateAllProperties = useCallback(async (properties: ThreagileProperties) => {
  if (!selectedElement || !drawioRef.current) return;
  setIsSyncing(true);
  try {
    for (const [key, value] of Object.entries(properties)) {
      drawioRef.current.setCustomProperty(selectedElement.id, key, value);  // ← Multiple reloads!
    }
    // ...
  }
}, [selectedElement, drawioRef]);
```

**Fix (SINGLE RELOAD):**
```tsx
const updateAllProperties = useCallback(async (properties: ThreagileProperties) => {
  if (!selectedElement || !drawioRef.current) return;
  setIsSyncing(true);
  try {
    // Use batch method for single XML reload
    drawioRef.current.setCustomProperties(selectedElement.id, properties);
    
    setSelectedElement((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        properties,
      };
    });
  } finally {
    setIsSyncing(false);
  }
}, [selectedElement, drawioRef]);
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `diagram/page.tsx` | Change `refreshLock()` to `acquireLock()` in interval |
| `DrawioEmbed.tsx` | Add `configure: '1'` to URL params |
| `DrawioEmbed.tsx` | Handle `configure` event to request selection notifications |
| `DrawioEmbed.tsx` | Add fallback polling or manual refresh button |
| `DrawioEmbed.tsx` | **Rewrite `setCustomProperty` to modify XML locally + reload via `load` action** |
| `DrawioEmbed.tsx` | **Add `setCustomProperties` batch method for efficiency** |
| `DrawioEmbed.tsx` | **Rewrite `getCustomProperties` to parse XML locally** |
| `DrawioEmbed.tsx` | **Update `parseCellFromXml` to read data-* attributes** |
| `useDrawioPropertyBridge.ts` | **Use `setCustomProperties` batch method instead of loop**

---

## Testing

1. **Lock Extension:**
   - Open diagram, wait 2+ minutes
   - Verify lock doesn't expire (check network tab for POST /lock calls every 60s)

2. **Selection → PropertyPanel:**
   - Click a shape in Draw.io
   - Verify PropertyPanel updates with shape's properties
   - If not working, check console for postMessage events

3. **Property Editing (CRITICAL):**
   - Select a component shape
   - Change "Technology" dropdown to "database"
   - Change "Criticality" to "critical"
   - Toggle "Internet Facing" checkbox
   - Click Apply/Save
   - **Verify:** Draw.io reloads with updated XML
   - **Verify:** Re-select the shape, PropertyPanel shows saved values
   - **Verify:** Export XML and confirm custom properties are in the file

4. **End-to-End Property Persistence:**
   - Edit properties on a shape
   - Save diagram (Ctrl+S)
   - Refresh page
   - Select same shape
   - Verify properties persisted correctly

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DrawioCellData, DrawioEmbedRef } from '@/components/threat-modeling/DrawioEmbed';

export interface ThreagileProperties {
  // Component properties
  technology?: string;
  criticality?: 'critical' | 'important' | 'operational' | 'archive';
  internetFacing?: boolean;
  encryption?: 'none' | 'transparent' | 'data-with-symmetric-shared-key' | 'data-with-asymmetric-shared-key' | 'data-with-end-user-individual-key';
  authentication?: 'none' | 'credentials' | 'session-id' | 'token' | 'client-certificate' | 'two-factor' | 'externalized';
  multiTenant?: boolean;
  redundant?: boolean;
  customDevelopment?: boolean;
  outOfScope?: boolean;
  justificationOutOfScope?: string;

  // DataFlow properties
  protocol?: string;
  authorization?: boolean;
  vpn?: boolean;
  ipFiltered?: boolean;
  readonly?: boolean;
  dataAssets?: string[];

  // Trust boundary properties
  boundaryType?: string;
}

export interface SelectedElement {
  id: string;
  type: 'component' | 'dataflow' | 'trust_boundary';
  name: string;
  properties: ThreagileProperties;
}

export function useDrawioPropertyBridge(drawioRef: React.RefObject<DrawioEmbedRef>) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Determine element type from Draw.io style
  const getElementType = useCallback((style: string): 'component' | 'dataflow' | 'trust_boundary' => {
    if (style.includes('edgeStyle') || style.includes('endArrow') || style.includes('startArrow')) {
      return 'dataflow';
    }
    if (style.includes('swimlane') || style.includes('group') || style.includes('rounded=0;dashed=1')) {
      return 'trust_boundary';
    }
    return 'component';
  }, []);

  // Parse custom properties from Draw.io cell - cast to ThreagileProperties
  // Since customProperties comes from XML attributes, we safely cast it
  const parseProperties = useCallback((cellData: DrawioCellData): ThreagileProperties => {
    const props = cellData.customProperties || {};
    // Cast the Record<string, any> to ThreagileProperties
    return props as ThreagileProperties;
  }, []);

  // Handle selection change from Draw.io
  const handleSelectionChange = useCallback((cellId: string | null, cellData: DrawioCellData | null) => {
    if (!cellId || !cellData) {
      setSelectedElement(null);
      return;
    }

    const elementType = getElementType(cellData.style);
    const properties = parseProperties(cellData);

    setSelectedElement({
      id: cellId,
      type: elementType,
      name: cellData.value || 'Unnamed',
      properties,
    });
  }, [getElementType, parseProperties]);

  // Update property in Draw.io
  const updateProperty = useCallback(async (key: keyof ThreagileProperties, value: any) => {
    if (!selectedElement || !drawioRef.current) return;

    setIsSyncing(true);
    try {
      // setCustomProperty is now async
      await drawioRef.current.setCustomProperty(selectedElement.id, key, value);

      // Update local state
      setSelectedElement((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          properties: {
            ...prev.properties,
            [key]: value,
          },
        };
      });
    } finally {
      setIsSyncing(false);
    }
  }, [selectedElement, drawioRef]);

  // Update all properties at once using batch method for single XML reload
  const updateAllProperties = useCallback(async (formData: any) => {
    if (!selectedElement || !drawioRef.current) return;

    setIsSyncing(true);
    try {
      // Filter out non-property fields (id, name, type are not custom properties)
      const { id, name, type, ...threagileProperties } = formData;

      // Also update the element's label/name in Draw.io if it changed
      if (name && name !== selectedElement.name) {
        // Name is handled via the value attribute, not custom properties
        // For now, just save custom properties
      }

      // Save only Threagile properties
      await drawioRef.current.setCustomProperties(selectedElement.id, threagileProperties);

      setSelectedElement((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          name: name || prev.name,
          properties: threagileProperties as ThreagileProperties,
        };
      });
    } finally {
      setIsSyncing(false);
    }
  }, [selectedElement, drawioRef]);

  return {
    selectedElement,
    isSyncing,
    handleSelectionChange,
    updateProperty,
    updateAllProperties,
  };
}

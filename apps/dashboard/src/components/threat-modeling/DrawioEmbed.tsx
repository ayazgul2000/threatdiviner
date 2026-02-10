'use client';

import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';

export interface DrawioEmbedProps {
  initialXml?: string;
  onXmlChange?: (xml: string) => void;
  readOnly?: boolean;
  onReady?: () => void;
  onSave?: (xml: string) => void;
}

export interface DrawioEmbedRef {
  getXml: () => Promise<string>;
  setXml: (xml: string) => void;
  exportPng: () => Promise<Blob>;
  exportSvg: () => Promise<string>;
}

const DRAWIO_URL = 'https://embed.diagrams.net/';
const VALID_ORIGINS = ['diagrams.net', 'draw.io'];

const DrawioEmbed = forwardRef<DrawioEmbedRef, DrawioEmbedProps>(({
  initialXml,
  onXmlChange,
  readOnly = false,
  onReady,
  onSave,
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const currentXmlRef = useRef<string>(initialXml || '');

  // Pending export resolver
  const pendingExportResolver = useRef<((xml: string) => void) | null>(null);

  const isValidOrigin = useCallback((origin: string) => {
    return VALID_ORIGINS.some(valid => origin.includes(valid));
  }, []);

  const sendMessage = useCallback((msg: Record<string, any>) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(JSON.stringify(msg), '*');
  }, []);

  const requestExport = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      pendingExportResolver.current = resolve;
      sendMessage({ action: 'export', format: 'xml', xml: true });

      setTimeout(() => {
        if (pendingExportResolver.current === resolve) {
          pendingExportResolver.current = null;
          resolve(currentXmlRef.current);
        }
      }, 5000);
    });
  }, [sendMessage]);

  // Message handler
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!isValidOrigin(event.origin)) return;

      let data: any;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      // Handle export response
      if (data.event === 'export' && data.xml) {
        if (pendingExportResolver.current) {
          const resolver = pendingExportResolver.current;
          pendingExportResolver.current = null;
          resolver(data.xml);
        }
        return;
      }

      switch (data.event) {
        case 'configure':
          sendMessage({ action: 'configure', config: JSON.stringify({}) });
          break;

        case 'init':
          setIsReady(true);
          onReady?.();
          sendMessage({
            action: 'load',
            xml: initialXml || '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>',
            autosave: 1,
          });
          break;

        case 'load':
          setTimeout(async () => {
            const xml = await requestExport();
            if (xml) {
              currentXmlRef.current = xml;
              onXmlChange?.(xml);
            }
          }, 300);
          break;

        case 'autosave':
        case 'save':
        case 'change': {
          const xml = await requestExport();
          if (xml) {
            currentXmlRef.current = xml;
            onXmlChange?.(xml);
          }
          if (data.event === 'save') {
            onSave?.(xml);
          }
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [initialXml, onXmlChange, onReady, onSave, sendMessage, requestExport, isValidOrigin]);

  // Public API
  const getXml = useCallback(async () => requestExport(), [requestExport]);

  const setXml = useCallback((xml: string) => {
    sendMessage({ action: 'load', xml });
  }, [sendMessage]);

  const exportPng = useCallback(async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (!isValidOrigin(event.origin)) return;
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.event === 'export' && data.data) {
            window.removeEventListener('message', handler);
            const base64 = data.data.split(',')[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            resolve(new Blob([bytes], { type: 'image/png' }));
          }
        } catch { /* ignore */ }
      };
      window.addEventListener('message', handler);
      sendMessage({ action: 'export', format: 'png' });
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('PNG export timeout'));
      }, 10000);
    });
  }, [sendMessage, isValidOrigin]);

  const exportSvg = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (!isValidOrigin(event.origin)) return;
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.event === 'export' && data.data) {
            window.removeEventListener('message', handler);
            resolve(data.data);
          }
        } catch { /* ignore */ }
      };
      window.addEventListener('message', handler);
      sendMessage({ action: 'export', format: 'svg' });
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve('');
      }, 10000);
    });
  }, [sendMessage, isValidOrigin]);

  useImperativeHandle(ref, () => ({
    getXml, setXml, exportPng, exportSvg,
  }), [getXml, setXml, exportPng, exportSvg]);

  const params = new URLSearchParams({
    embed: '1', proto: 'json', spin: '1', modified: 'unsavedChanges', keepmodified: '1',
    libraries: '1', noSaveBtn: readOnly ? '1' : '0', saveAndExit: '0', noExitBtn: '1',
    libs: 'general;aws4;azure;gcp2;network;clipart;flowchart;uml;er;mscae',
    ui: 'kennedy', autosave: '1', configure: '1',
    dark: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? '1' : '0',
  });

  return (
    <div className="w-full h-full relative">
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading diagram editor...</span>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={`${DRAWIO_URL}?${params.toString()}`}
        className="w-full h-full border-0"
        style={{ opacity: isReady ? 1 : 0 }}
        title="Diagram Editor"
      />
    </div>
  );
});

DrawioEmbed.displayName = 'DrawioEmbed';
export default DrawioEmbed;

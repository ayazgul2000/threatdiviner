import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as zlib from 'zlib';
import { parseStringPromise } from 'xml2js';

interface MxCell {
  $: {
    id: string;
    value?: string;
    style?: string;
    vertex?: string;
    edge?: string;
    source?: string;
    target?: string;
    parent?: string;
  };
  mxGeometry?: Array<{
    $: {
      x?: string;
      y?: string;
      width?: string;
      height?: string;
    };
  }>;
}

interface ParsedDiagram {
  vertices: MxCell[];
  edges: MxCell[];
}

export interface SyncResult {
  success: boolean;
  componentsCreated: number;
  componentsUpdated: number;
  componentsDeleted: number;
  dataFlowsCreated: number;
  dataFlowsUpdated: number;
  dataFlowsDeleted: number;
  errors: string[];
}

@Injectable()
export class DiagramSyncService {
  private readonly logger = new Logger(DiagramSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncDiagramToDatabase(
    threatModelId: string,
    tenantId: string,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      componentsCreated: 0,
      componentsUpdated: 0,
      componentsDeleted: 0,
      dataFlowsCreated: 0,
      dataFlowsUpdated: 0,
      dataFlowsDeleted: 0,
      errors: [],
    };

    try {
      const model = await this.prisma.threatModel.findFirst({
        where: { id: threatModelId, tenantId },
      });

      if (!model) {
        return { ...result, success: false, errors: ['Threat model not found'] };
      }

      if (!model.diagramXml) {
        this.logger.debug('No diagramXml found, nothing to sync');
        return result;
      }

      const decodedXml = this.decodeMxFileXml(model.diagramXml);
      const parsed = await this.parseMxGraphModel(decodedXml);

      if (!parsed) {
        return { ...result, success: false, errors: ['Failed to parse diagram XML'] };
      }

      const drawioIdMap = await this.syncComponents(
        threatModelId,
        parsed.vertices,
        result,
      );

      await this.syncDataFlows(
        threatModelId,
        parsed.edges,
        drawioIdMap,
        result,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Diagram sync failed: ${message}`);
      result.success = false;
      result.errors.push(`Sync failed: ${message}`);
    }

    return result;
  }

  /**
   * Decodes mxfile XML. Handles 3 formats:
   * 1. Raw <mxGraphModel> XML (unencoded)
   * 2. <mxfile> with encoded/compressed <diagram> content
   * 3. <mxfile> with unencoded <diagram> content (plain mxGraphModel inside)
   */
  decodeMxFileXml(xml: string): string {
    const trimmed = xml.trim();

    // Format 1: already a raw mxGraphModel
    if (trimmed.startsWith('<mxGraphModel')) {
      return trimmed;
    }

    // Format 2 & 3: mxfile wrapper
    if (trimmed.startsWith('<mxfile')) {
      // Extract <diagram> content
      const diagramMatch = trimmed.match(/<diagram[^>]*>([\s\S]*?)<\/diagram>/);
      if (!diagramMatch || !diagramMatch[1]) {
        throw new Error('No <diagram> element found in mxfile');
      }

      const diagramContent = diagramMatch[1].trim();

      // Format 3: diagram content is already XML
      if (diagramContent.startsWith('<mxGraphModel')) {
        return diagramContent;
      }

      // Format 2: base64 + deflate encoded
      try {
        const decoded = Buffer.from(diagramContent, 'base64');
        const inflated = zlib.inflateRawSync(decoded);
        const uri = inflated.toString('utf-8');
        return decodeURIComponent(uri);
      } catch {
        // Fallback: try treating as plain text (some versions don't compress)
        try {
          const decoded = Buffer.from(diagramContent, 'base64');
          return decodeURIComponent(decoded.toString('utf-8'));
        } catch {
          // Last resort: return as-is
          return diagramContent;
        }
      }
    }

    // Unknown format, return as-is
    return trimmed;
  }

  async parseMxGraphModel(xml: string): Promise<ParsedDiagram | null> {
    try {
      const result = await parseStringPromise(xml, {
        explicitArray: true,
        mergeAttrs: false,
      });

      const mxGraphModel = result.mxGraphModel;
      if (!mxGraphModel) {
        this.logger.warn('No mxGraphModel found in parsed XML');
        return null;
      }

      const cells: MxCell[] = [];

      // Cells can be at root level or nested inside <root>
      const root = mxGraphModel.root?.[0];
      if (root?.mxCell) {
        cells.push(...root.mxCell);
      }
      // Also check for cells directly on the object elements
      if (root?.object) {
        for (const obj of root.object) {
          // <object> wraps an mxCell with extra attributes
          if (obj.mxCell?.[0]) {
            const cell = obj.mxCell[0];
            // Merge object attributes into cell
            cells.push({
              $: {
                ...cell.$,
                id: obj.$.id || cell.$.id,
                value: obj.$.label || obj.$.value || cell.$.value,
              },
              mxGeometry: cell.mxGeometry,
            });
          }
        }
      }

      const vertices: MxCell[] = [];
      const edges: MxCell[] = [];

      for (const cell of cells) {
        const id = cell.$?.id;
        // Skip root cells (id 0 and 1 are Draw.io defaults)
        if (!id || id === '0' || id === '1') {
          continue;
        }

        if (cell.$.edge === '1') {
          edges.push(cell);
        } else if (cell.$.vertex === '1') {
          vertices.push(cell);
        }
      }

      this.logger.debug(
        `Parsed diagram: ${vertices.length} vertices, ${edges.length} edges`,
      );

      return { vertices, edges };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`XML parse failed: ${message}`);
      return null;
    }
  }

  resolveComponentType(style: string | undefined): string {
    if (!style) return 'process';

    const styleLower = style.toLowerCase();

    // Check for specific shape styles
    if (styleLower.includes('cylinder') || styleLower.includes('shape=cylinder')) {
      return 'datastore';
    }
    if (styleLower.includes('ellipse') || styleLower.includes('shape=ellipse')) {
      return 'external_entity';
    }
    if (styleLower.includes('cloud') || styleLower.includes('shape=cloud')) {
      return 'external_entity';
    }
    if (styleLower.includes('shape=mxgraph.flowchart.database')) {
      return 'datastore';
    }
    if (styleLower.includes('rhombus') || styleLower.includes('shape=rhombus')) {
      return 'process';
    }

    // Default: rectangle = process
    return 'process';
  }

  private async syncComponents(
    threatModelId: string,
    vertices: MxCell[],
    result: SyncResult,
  ): Promise<Map<string, string>> {
    // Map of drawioId -> database component ID
    const drawioIdMap = new Map<string, string>();

    // Load existing components for this threat model
    const existingComponents = await this.prisma.threatModelComponent.findMany({
      where: { threatModelId },
    });

    // Build map of drawioId -> existing DB record
    const existingByDrawioId = new Map<
      string,
      (typeof existingComponents)[0]
    >();
    for (const comp of existingComponents) {
      const metadata = comp.metadata as Record<string, unknown> | null;
      const drawioId = metadata?.drawioId as string | undefined;
      if (drawioId) {
        existingByDrawioId.set(drawioId, comp);
        drawioIdMap.set(drawioId, comp.id);
      }
    }

    // Track which drawioIds are still in the diagram
    const activeDrawioIds = new Set<string>();

    for (const vertex of vertices) {
      const drawioId = vertex.$.id;
      activeDrawioIds.add(drawioId);

      const name =
        this.stripHtml(vertex.$.value) || `Component ${drawioId}`;
      const type = this.resolveComponentType(vertex.$.style);
      const geometry = vertex.mxGeometry?.[0]?.$;
      const positionX = geometry?.x ? parseFloat(geometry.x) : 0;
      const positionY = geometry?.y ? parseFloat(geometry.y) : 0;

      const existing = existingByDrawioId.get(drawioId);

      if (existing) {
        // Update existing component
        try {
          await this.prisma.threatModelComponent.update({
            where: { id: existing.id },
            data: {
              name,
              type,
              positionX,
              positionY,
              metadata: {
                ...(existing.metadata as Record<string, unknown>),
                drawioId,
                drawioStyle: vertex.$.style || '',
              } as Prisma.InputJsonValue,
            },
          });
          drawioIdMap.set(drawioId, existing.id);
          result.componentsUpdated++;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to update component ${drawioId}: ${msg}`);
        }
      } else {
        // Create new component
        try {
          const created = await this.prisma.threatModelComponent.create({
            data: {
              threatModelId,
              name,
              type,
              positionX,
              positionY,
              metadata: {
                drawioId,
                drawioStyle: vertex.$.style || '',
              } as Prisma.InputJsonValue,
            },
          });
          drawioIdMap.set(drawioId, created.id);
          result.componentsCreated++;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to create component ${drawioId}: ${msg}`);
        }
      }
    }

    // Delete components whose drawioId is no longer in the diagram
    // Only delete those that HAVE a drawioId (preserve manually created components)
    for (const [drawioId, comp] of existingByDrawioId) {
      if (!activeDrawioIds.has(drawioId)) {
        try {
          await this.prisma.threatModelComponent.delete({
            where: { id: comp.id },
          });
          drawioIdMap.delete(drawioId);
          result.componentsDeleted++;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to delete component ${drawioId}: ${msg}`);
        }
      }
    }

    return drawioIdMap;
  }

  private async syncDataFlows(
    threatModelId: string,
    edges: MxCell[],
    drawioIdMap: Map<string, string>,
    result: SyncResult,
  ): Promise<void> {
    // Load existing data flows for this threat model
    const existingFlows = await this.prisma.threatModelDataFlow.findMany({
      where: { threatModelId },
    });

    // Build map of drawioId -> existing DB record
    const existingByDrawioId = new Map<
      string,
      (typeof existingFlows)[0]
    >();
    for (const flow of existingFlows) {
      const metadata = flow.metadata as Record<string, unknown> | null;
      const drawioId = metadata?.drawioId as string | undefined;
      if (drawioId) {
        existingByDrawioId.set(drawioId, flow);
      }
    }

    // Track which drawioIds are still in the diagram
    const activeDrawioIds = new Set<string>();

    for (const edge of edges) {
      const drawioId = edge.$.id;
      activeDrawioIds.add(drawioId);

      const sourceDrawioId = edge.$.source;
      const targetDrawioId = edge.$.target;

      // Skip edges with missing source/target (may reference trust boundaries)
      if (!sourceDrawioId || !targetDrawioId) {
        this.logger.debug(
          `Skipping edge ${drawioId}: missing source or target`,
        );
        continue;
      }

      const sourceDbId = drawioIdMap.get(sourceDrawioId);
      const targetDbId = drawioIdMap.get(targetDrawioId);

      if (!sourceDbId || !targetDbId) {
        this.logger.debug(
          `Skipping edge ${drawioId}: source/target not found in component map`,
        );
        continue;
      }

      const label = this.stripHtml(edge.$.value) || undefined;
      const existing = existingByDrawioId.get(drawioId);

      if (existing) {
        // Update existing data flow
        try {
          await this.prisma.threatModelDataFlow.update({
            where: { id: existing.id },
            data: {
              sourceId: sourceDbId,
              targetId: targetDbId,
              label,
              metadata: {
                ...(existing.metadata as Record<string, unknown>),
                drawioId,
                drawioStyle: edge.$.style || '',
              } as Prisma.InputJsonValue,
            },
          });
          result.dataFlowsUpdated++;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to update data flow ${drawioId}: ${msg}`);
        }
      } else {
        // Create new data flow
        try {
          await this.prisma.threatModelDataFlow.create({
            data: {
              threatModelId,
              sourceId: sourceDbId,
              targetId: targetDbId,
              label,
              metadata: {
                drawioId,
                drawioStyle: edge.$.style || '',
              } as Prisma.InputJsonValue,
            },
          });
          result.dataFlowsCreated++;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to create data flow ${drawioId}: ${msg}`);
        }
      }
    }

    // Delete data flows whose drawioId is no longer in the diagram
    // Only delete those that HAVE a drawioId (preserve manually created flows)
    for (const [drawioId, flow] of existingByDrawioId) {
      if (!activeDrawioIds.has(drawioId)) {
        try {
          await this.prisma.threatModelDataFlow.delete({
            where: { id: flow.id },
          });
          result.dataFlowsDeleted++;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to delete data flow ${drawioId}: ${msg}`);
        }
      }
    }
  }

  /**
   * Strip HTML tags from Draw.io cell values.
   * Draw.io may store values as HTML like "<b>Web Server</b>" or with <br> tags.
   */
  private stripHtml(value: string | undefined): string {
    if (!value) return '';
    return value
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}

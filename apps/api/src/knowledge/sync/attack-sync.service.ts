// apps/api/src/knowledge/sync/attack-sync.service.ts
// MITRE ATT&CK Enterprise sync service - fetches from STIX JSON

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';

// ATT&CK Enterprise STIX bundle URL
const ATTACK_JSON_URL = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

interface StixObject {
  type: string;
  id: string;
  name?: string;
  description?: string;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
    url?: string;
  }>;
  x_mitre_shortname?: string;
  x_mitre_platforms?: string[];
  x_mitre_data_sources?: string[];
  x_mitre_detection?: string;
  x_mitre_is_subtechnique?: boolean;
  kill_chain_phases?: Array<{
    kill_chain_name: string;
    phase_name: string;
  }>;
  aliases?: string[];
  created?: string;
  modified?: string;
  source_ref?: string;
  target_ref?: string;
  relationship_type?: string;
}

interface StixBundle {
  type: string;
  id: string;
  objects: StixObject[];
}

@Injectable()
export class AttackSyncService {
  private readonly logger = new Logger(AttackSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Monthly full sync
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async syncAttack(): Promise<{ techniques: number; tactics: number; groups: number; errors: number }> {
    this.logger.log('ATT&CK sync starting...');
    let techniques = 0;
    let tactics = 0;
    let groups = 0;
    let errors = 0;

    try {
      const bundle = await this.downloadJson();

      // Extract and process tactics first (x-mitre-tactic)
      const tacticObjects = bundle.objects.filter(o => o.type === 'x-mitre-tactic');
      this.logger.log(`Found ${tacticObjects.length} tactics to process`);

      for (const tactic of tacticObjects) {
        try {
          await this.upsertTactic(tactic);
          tactics++;
        } catch (e) {
          errors++;
          this.logger.warn(`Tactic sync error for ${tactic.id}: ${e}`);
        }
      }

      // Build tactic ID -> shortname map for technique relationships
      const tacticMap = new Map<string, string>();
      for (const t of tacticObjects) {
        if (t.x_mitre_shortname) {
          tacticMap.set(t.x_mitre_shortname, this.extractAttackId(t));
        }
      }

      // Process attack patterns (techniques)
      const techniqueObjects = bundle.objects.filter(o => o.type === 'attack-pattern');
      this.logger.log(`Found ${techniqueObjects.length} techniques to process`);

      // Process parent techniques first, then sub-techniques
      const parentTechniques = techniqueObjects.filter(t => !t.x_mitre_is_subtechnique);
      const subTechniques = techniqueObjects.filter(t => t.x_mitre_is_subtechnique);

      // Get mitigation relationships
      const mitigationRelations = bundle.objects.filter(
        o => o.type === 'relationship' && o.relationship_type === 'mitigates'
      );
      const mitigationMap = this.buildMitigationMap(mitigationRelations, bundle.objects);

      for (const technique of parentTechniques) {
        try {
          await this.upsertTechnique(technique, tacticMap, mitigationMap, null);
          techniques++;
        } catch (e) {
          errors++;
          this.logger.warn(`Technique sync error for ${technique.id}: ${e}`);
        }
      }

      for (const technique of subTechniques) {
        try {
          const parentId = this.findParentTechnique(technique, bundle.objects);
          await this.upsertTechnique(technique, tacticMap, mitigationMap, parentId);
          techniques++;
        } catch (e) {
          errors++;
          this.logger.warn(`Sub-technique sync error for ${technique.id}: ${e}`);
        }
      }

      // Process intrusion sets (groups)
      const groupObjects = bundle.objects.filter(o => o.type === 'intrusion-set');
      this.logger.log(`Found ${groupObjects.length} groups to process`);

      // Get group-technique relationships
      const useRelations = bundle.objects.filter(
        o => o.type === 'relationship' && o.relationship_type === 'uses'
      );

      for (const group of groupObjects) {
        try {
          await this.upsertGroup(group, useRelations);
          groups++;
        } catch (e) {
          errors++;
          this.logger.warn(`Group sync error for ${group.id}: ${e}`);
        }
      }

      // Update sync status
      await this.prisma.dataSyncStatus.upsert({
        where: { sourceType: 'attack' },
        update: {
          lastSyncAt: new Date(),
          recordCount: techniques + tactics + groups,
          status: errors > 0 ? 'partial' : 'success',
          errorMessage: errors > 0 ? `${errors} records failed` : null,
        },
        create: {
          sourceType: 'attack',
          lastSyncAt: new Date(),
          recordCount: techniques + tactics + groups,
          status: errors > 0 ? 'partial' : 'success',
        },
      });

      this.logger.log(`ATT&CK sync complete: ${tactics} tactics, ${techniques} techniques, ${groups} groups, ${errors} errors`);
    } catch (e) {
      this.logger.error('ATT&CK sync failed', e);
      await this.prisma.dataSyncStatus.upsert({
        where: { sourceType: 'attack' },
        update: {
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : String(e),
        },
        create: {
          sourceType: 'attack',
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : String(e),
        },
      });
    }

    return { techniques, tactics, groups, errors };
  }

  private async downloadJson(): Promise<StixBundle> {
    return new Promise((resolve, reject) => {
      https.get(ATTACK_JSON_URL, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(data as StixBundle);
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private extractAttackId(obj: StixObject): string {
    const ref = obj.external_references?.find(r => r.source_name === 'mitre-attack');
    return ref?.external_id || obj.id;
  }

  private extractAttackUrl(obj: StixObject): string {
    const ref = obj.external_references?.find(r => r.source_name === 'mitre-attack');
    return ref?.url || `https://attack.mitre.org/`;
  }

  private async upsertTactic(tactic: StixObject): Promise<void> {
    const id = this.extractAttackId(tactic);

    await this.prisma.attackTactic.upsert({
      where: { id },
      update: {
        name: tactic.name || '',
        description: tactic.description || '',
        shortName: tactic.x_mitre_shortname || '',
        url: this.extractAttackUrl(tactic),
        updatedAt: new Date(),
      },
      create: {
        id,
        name: tactic.name || '',
        description: tactic.description || '',
        shortName: tactic.x_mitre_shortname || '',
        url: this.extractAttackUrl(tactic),
      },
    });
  }

  private async upsertTechnique(
    technique: StixObject,
    tacticMap: Map<string, string>,
    mitigationMap: Map<string, Array<{ id: string; name: string; description: string }>>,
    parentId: string | null
  ): Promise<void> {
    const id = this.extractAttackId(technique);

    // Get the first kill chain phase to determine primary tactic
    const killChain = technique.kill_chain_phases?.find(k => k.kill_chain_name === 'mitre-attack');
    const tacticId = killChain?.phase_name
      ? (tacticMap.get(killChain.phase_name) || killChain.phase_name)
      : 'unknown';

    // Extract CAPEC references
    const capecRefs = technique.external_references
      ?.filter(r => r.source_name === 'capec')
      .map(r => r.external_id || '')
      .filter(Boolean) || [];

    // Extract CWE references (from CAPEC mappings would be more accurate, but basic extraction)
    const cweRefs: string[] = [];

    // Get mitigations for this technique
    const mitigations = mitigationMap.get(technique.id) || [];

    await this.prisma.attackTechnique.upsert({
      where: { id },
      update: {
        name: technique.name || '',
        description: technique.description || '',
        tacticId,
        isSubTechnique: technique.x_mitre_is_subtechnique || false,
        parentId,
        platforms: technique.x_mitre_platforms || [],
        dataSources: technique.x_mitre_data_sources || [],
        detection: technique.x_mitre_detection || null,
        mitigations,
        capecIds: capecRefs,
        cweIds: cweRefs,
        url: this.extractAttackUrl(technique),
        updatedAt: new Date(),
      },
      create: {
        id,
        name: technique.name || '',
        description: technique.description || '',
        tacticId,
        isSubTechnique: technique.x_mitre_is_subtechnique || false,
        parentId,
        platforms: technique.x_mitre_platforms || [],
        dataSources: technique.x_mitre_data_sources || [],
        detection: technique.x_mitre_detection || null,
        mitigations,
        capecIds: capecRefs,
        cweIds: cweRefs,
        url: this.extractAttackUrl(technique),
      },
    });
  }

  private async upsertGroup(group: StixObject, useRelations: StixObject[]): Promise<void> {
    const id = this.extractAttackId(group);
    const groupId = group.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id || id;

    // Find techniques used by this group
    const usedTechniques = useRelations
      .filter(r => r.source_ref === group.id && r.target_ref?.includes('attack-pattern'))
      .map(r => {
        const techRef = r.target_ref?.split('--')[1] || '';
        return techRef;
      })
      .filter(Boolean);

    // Find software used by this group
    const usedSoftware = useRelations
      .filter(r => r.source_ref === group.id && (r.target_ref?.includes('malware') || r.target_ref?.includes('tool')))
      .map(r => r.target_ref?.split('--')[1] || '')
      .filter(Boolean);

    await this.prisma.attackGroup.upsert({
      where: { id },
      update: {
        groupId,
        name: group.name || '',
        description: group.description || null,
        aliases: group.aliases || [],
        techniques: usedTechniques,
        software: usedSoftware,
        url: this.extractAttackUrl(group),
        updatedAt: new Date(),
      },
      create: {
        id,
        groupId,
        name: group.name || '',
        description: group.description || null,
        aliases: group.aliases || [],
        techniques: usedTechniques,
        software: usedSoftware,
        url: this.extractAttackUrl(group),
      },
    });
  }

  private buildMitigationMap(
    relations: StixObject[],
    allObjects: StixObject[]
  ): Map<string, Array<{ id: string; name: string; description: string }>> {
    const map = new Map<string, Array<{ id: string; name: string; description: string }>>();

    // Build lookup for mitigation objects
    const mitigationObjects = new Map<string, StixObject>();
    for (const obj of allObjects) {
      if (obj.type === 'course-of-action') {
        mitigationObjects.set(obj.id, obj);
      }
    }

    // Build technique -> mitigations mapping
    for (const rel of relations) {
      if (rel.source_ref && rel.target_ref) {
        const mitigation = mitigationObjects.get(rel.source_ref);
        if (mitigation) {
          const techniqueId = rel.target_ref;
          if (!map.has(techniqueId)) {
            map.set(techniqueId, []);
          }
          map.get(techniqueId)!.push({
            id: this.extractAttackId(mitigation),
            name: mitigation.name || '',
            description: mitigation.description || '',
          });
        }
      }
    }

    return map;
  }

  private findParentTechnique(subTechnique: StixObject, allObjects: StixObject[]): string | null {
    const subId = this.extractAttackId(subTechnique);
    // Sub-technique IDs are formatted as T####.###
    const parentMatch = subId.match(/^(T\d+)\.\d+$/);
    if (!parentMatch) return null;

    const parentId = parentMatch[1];
    // Verify parent exists
    const parent = allObjects.find(
      o => o.type === 'attack-pattern' && this.extractAttackId(o) === parentId
    );
    return parent ? parentId : null;
  }

  // Manual sync trigger
  async syncManual(): Promise<{ techniques: number; tactics: number; groups: number; errors: number }> {
    return this.syncAttack();
  }

  getSourceUrl(): string {
    return ATTACK_JSON_URL;
  }

  // Get sync status
  async getSyncStatus(): Promise<{ lastSync: Date | null; recordCount: number; status: string }> {
    const status = await this.prisma.dataSyncStatus.findUnique({
      where: { sourceType: 'attack' },
    });
    return {
      lastSync: status?.lastSyncAt || null,
      recordCount: status?.recordCount || 0,
      status: status?.status || 'never',
    };
  }
}

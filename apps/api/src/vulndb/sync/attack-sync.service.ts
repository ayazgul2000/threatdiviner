import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  kill_chain_phases?: Array<{
    kill_chain_name: string;
    phase_name: string;
  }>;
  x_mitre_platforms?: string[];
  x_mitre_data_sources?: string[];
  x_mitre_detection?: string;
  x_mitre_is_subtechnique?: boolean;
}

interface StixBundle {
  type: 'bundle';
  id: string;
  objects: StixObject[];
}

@Injectable()
export class AttackSyncService {
  private readonly logger = new Logger(AttackSyncService.name);
  // MITRE ATT&CK Enterprise Matrix STIX data
  private readonly ATTACK_URL = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<{ tactics: number; techniques: number }> {
    await this.updateSyncStatus('attack', 'syncing');
    let tactics = 0;
    let techniques = 0;

    try {
      this.logger.log('Fetching MITRE ATT&CK data...');
      const bundle = await this.fetchAttackData();

      // Process tactics first
      const tacticObjects = bundle.objects.filter(o => o.type === 'x-mitre-tactic');
      this.logger.log(`Processing ${tacticObjects.length} tactics...`);

      for (const tactic of tacticObjects) {
        try {
          await this.processTactic(tactic);
          tactics++;
        } catch (error) {
          this.logger.error(`Error processing tactic ${tactic.id}:`, error);
        }
      }

      // Then process techniques
      const techniqueObjects = bundle.objects.filter(o => o.type === 'attack-pattern');
      this.logger.log(`Processing ${techniqueObjects.length} techniques...`);

      // Sort to process parent techniques before sub-techniques
      const sortedTechniques = techniqueObjects.sort((a, b) => {
        const aIsSub = a.x_mitre_is_subtechnique || false;
        const bIsSub = b.x_mitre_is_subtechnique || false;
        if (aIsSub && !bIsSub) return 1;
        if (!aIsSub && bIsSub) return -1;
        return 0;
      });

      for (const technique of sortedTechniques) {
        try {
          await this.processTechnique(technique);
          techniques++;
        } catch (error) {
          this.logger.error(`Error processing technique ${technique.id}:`, error);
        }
      }

      await this.updateSyncStatus('attack', 'success', tactics + techniques);
      this.logger.log(`ATT&CK sync complete: ${tactics} tactics, ${techniques} techniques`);
      return { tactics, techniques };
    } catch (error) {
      await this.updateSyncStatus('attack', 'failed', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async fetchAttackData(): Promise<StixBundle> {
    const response = await fetch(this.ATTACK_URL);

    if (!response.ok) {
      throw new Error(`ATT&CK API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async processTactic(tactic: StixObject): Promise<void> {
    const externalRef = tactic.external_references?.find(r => r.source_name === 'mitre-attack');
    if (!externalRef?.external_id) return;

    const id = externalRef.external_id; // TA0001
    const name = tactic.name || '';
    const description = tactic.description || '';
    const shortName = tactic.kill_chain_phases?.[0]?.phase_name || id.toLowerCase().replace('ta', 'tactic-');
    const url = externalRef.url || `https://attack.mitre.org/tactics/${id}/`;

    await this.prisma.attackTactic.upsert({
      where: { id },
      create: { id, name, description, shortName, url },
      update: { name, description, shortName, url },
    });
  }

  private async processTechnique(technique: StixObject): Promise<void> {
    const externalRef = technique.external_references?.find(r => r.source_name === 'mitre-attack');
    if (!externalRef?.external_id) return;

    const id = externalRef.external_id; // T1566 or T1566.001
    const name = technique.name || '';
    const description = technique.description || '';
    const isSubTechnique = technique.x_mitre_is_subtechnique || false;
    const platforms = technique.x_mitre_platforms || [];
    const dataSources = technique.x_mitre_data_sources || [];
    const detection = technique.x_mitre_detection || null;
    const url = externalRef.url || `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`;

    // Extract parent ID for sub-techniques
    let parentId: string | null = null;
    if (isSubTechnique && id.includes('.')) {
      parentId = id.split('.')[0];
    }

    // Get tactic from kill chain phases
    const tacticPhase = technique.kill_chain_phases?.find(p => p.kill_chain_name === 'mitre-attack');
    let tacticId: string | null = null;

    if (tacticPhase) {
      // Map phase name to tactic ID (e.g., "initial-access" -> find TA0001)
      const tactic = await this.prisma.attackTactic.findFirst({
        where: { shortName: tacticPhase.phase_name },
      });
      tacticId = tactic?.id || null;
    }

    // If no tactic found, skip (required field)
    if (!tacticId) {
      // Default to reconnaissance if no tactic found
      tacticId = 'TA0043';
    }

    // Extract CAPEC IDs from external references
    const capecIds = technique.external_references
      ?.filter(r => r.source_name === 'capec')
      ?.map(r => r.external_id || '')
      ?.filter(Boolean) || [];

    await this.prisma.attackTechnique.upsert({
      where: { id },
      create: {
        id,
        name,
        description,
        tacticId,
        isSubTechnique,
        parentId,
        platforms,
        dataSources,
        detection,
        mitigations: [],
        capecIds,
        cweIds: [], // Will be populated from CAPEC mapping
        url,
      },
      update: {
        name,
        description,
        tacticId,
        isSubTechnique,
        parentId,
        platforms,
        dataSources,
        detection,
        capecIds,
        url,
      },
    });
  }

  private async updateSyncStatus(
    source: string,
    status: string,
    recordCount?: number,
    errorMessage?: string,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.dataSyncStatus.upsert({
      where: { id: source },
      create: {
        id: source,
        status,
        recordCount: recordCount || 0,
        errorMessage,
        lastSyncAt: now,
        lastSuccessAt: status === 'success' ? now : undefined,
        nextSyncAt: status === 'success' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
      },
      update: {
        status,
        recordCount: recordCount || undefined,
        errorMessage,
        lastSyncAt: now,
        lastSuccessAt: status === 'success' ? now : undefined,
        nextSyncAt: status === 'success' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
      },
    });
  }
}

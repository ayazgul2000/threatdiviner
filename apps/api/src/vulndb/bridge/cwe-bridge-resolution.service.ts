import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

interface Layer1Config {
  [category: string]: {
    cwe699Subcategories: string[];
    technologyKeywords: string[];
  };
}

interface Layer2Entry {
  category: string;
  icons: string[];
  excludeCwes: string[];
}

interface Layer2Config {
  [subcategory: string]: Layer2Entry;
}

interface Layer3Entry {
  subcategory: string;
  excludeCwes: string[];
  addCwes: string[];
}

interface Layer3Config {
  [icon: string]: Layer3Entry;
}

interface IconRegistryEntry {
  types: string[];
  modules: string[];
  classes: string[];
}

interface IconRegistry {
  [iconName: string]: IconRegistryEntry;
}

interface IconTypeOverrides {
  [iconName: string]: string; // corrected type or "skip"
}

export interface BridgeResolutionResult {
  icon: string;
  categories: string[];
  subcategory: string | null;
  cwes: string[];
  count: number;
  layers: {
    layer1Count: number;
    layer1ByType: Record<string, number>;
    layer2Excluded: string[];
    layer3Excluded: string[];
    layer3Added: string[];
  };
}

@Injectable()
export class CweBridgeResolutionService {
  private layer1: Layer1Config;
  private layer2: Layer2Config;
  private layer3: Layer3Config;
  private iconRegistry: IconRegistry;
  private typeOverrides: IconTypeOverrides;

  constructor(private readonly prisma: PrismaService) {
    this.layer1 = this.loadJson<Layer1Config>('layer1-category-defaults.json');
    this.layer2 = this.loadJson<Layer2Config>('layer2-subcategory-exclusions.json');
    this.layer3 = this.loadJson<Layer3Config>('layer3-icon-overrides.json');
    this.iconRegistry = this.loadJson<IconRegistry>('icon-registry.json');
    this.typeOverrides = this.loadJson<IconTypeOverrides>('icon-type-overrides.json');
  }

  private loadJson<T>(filename: string): T {
    const filePath = path.join(__dirname, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  /**
   * Resolve final CWEs for an icon.
   * 1. Look up icon in registry to get its types (possibly multiple)
   * 2. Union Layer 1 CWEs from all matching types
   * 3. Apply Layer 2 exclusions
   * 4. Apply Layer 3 exclusions + additions
   * Formula: (Union(Layer1 per type) - Layer2_exclusions - Layer3_exclusions) + Layer3_additions
   */
  async resolve(iconName: string): Promise<BridgeResolutionResult> {
    const iconLower = iconName.toLowerCase();

    // Look up icon in registry to get types
    const registryEntry = this.iconRegistry[iconLower];
    const { types, subcategory } = this.findIconPlacement(iconLower, registryEntry);

    if (types.length === 0) {
      return {
        icon: iconLower,
        categories: [],
        subcategory: null,
        cwes: [],
        count: 0,
        layers: { layer1Count: 0, layer1ByType: {}, layer2Excluded: [], layer3Excluded: [], layer3Added: [] },
      };
    }

    // Step 1: Union Layer 1 CWEs from all types
    const cweSet = new Set<string>();
    const layer1ByType: Record<string, number> = {};

    for (const type of types) {
      const typeCwes = await this.resolveLayer1(type);
      layer1ByType[type] = typeCwes.length;
      for (const cwe of typeCwes) {
        cweSet.add(cwe);
      }
    }

    const layer1Cwes = Array.from(cweSet);

    // Step 2: Apply Layer 2 exclusions
    const layer2Exclusions = subcategory
      ? this.layer2[subcategory]?.excludeCwes || []
      : [];
    const afterLayer2 = layer1Cwes.filter((cwe) => !layer2Exclusions.includes(cwe));

    // Step 3: Apply Layer 3 exclusions + additions
    const layer3Config = this.layer3[iconLower];
    const layer3Exclusions = layer3Config?.excludeCwes || [];
    const layer3Additions = layer3Config?.addCwes || [];

    const afterLayer3Exclusions = afterLayer2.filter((cwe) => !layer3Exclusions.includes(cwe));
    const finalCwes = [...new Set([...afterLayer3Exclusions, ...layer3Additions])];

    finalCwes.sort();

    return {
      icon: iconLower,
      categories: types,
      subcategory,
      cwes: finalCwes,
      count: finalCwes.length,
      layers: {
        layer1Count: layer1Cwes.length,
        layer1ByType,
        layer2Excluded: layer2Exclusions,
        layer3Excluded: layer3Exclusions,
        layer3Added: layer3Additions,
      },
    };
  }

  /**
   * Resolve by category directly (no icon lookup, just Layer 1 defaults).
   */
  async resolveCategory(category: string): Promise<BridgeResolutionResult> {
    if (!this.layer1[category]) {
      return {
        icon: '',
        categories: [category],
        subcategory: null,
        cwes: [],
        count: 0,
        layers: { layer1Count: 0, layer1ByType: {}, layer2Excluded: [], layer3Excluded: [], layer3Added: [] },
      };
    }

    const cwes = await this.resolveLayer1(category);
    cwes.sort();

    return {
      icon: '',
      categories: [category],
      subcategory: null,
      cwes,
      count: cwes.length,
      layers: {
        layer1Count: cwes.length,
        layer1ByType: { [category]: cwes.length },
        layer2Excluded: [],
        layer3Excluded: [],
        layer3Added: [],
      },
    };
  }

  /**
   * List all known categories from Layer 1 config.
   */
  getCategories(): string[] {
    return Object.keys(this.layer1);
  }

  /**
   * List all icons from the registry with their types and module info.
   */
  getKnownIcons(): { icon: string; types: string[]; effectiveTypes: string[]; modules: string[]; subcategory: string | null; overridden: boolean; skipped: boolean }[] {
    const icons: { icon: string; types: string[]; effectiveTypes: string[]; modules: string[]; subcategory: string | null; overridden: boolean; skipped: boolean }[] = [];

    for (const [iconName, entry] of Object.entries(this.iconRegistry)) {
      const override = this.typeOverrides[iconName];
      const skipped = override === 'skip';
      const overridden = !!override && !skipped;

      // Effective types after overrides
      let effectiveTypes: string[];
      if (skipped) {
        effectiveTypes = [];
      } else if (overridden) {
        effectiveTypes = this.layer1[override] ? [override] : [];
      } else {
        effectiveTypes = entry.types.filter((t) => this.layer1[t]);
      }

      // Check subcategory
      let subcategory: string | null = null;
      const layer3Entry = this.layer3[iconName];
      if (layer3Entry) {
        subcategory = layer3Entry.subcategory;
      } else {
        for (const [subcat, subEntry] of Object.entries(this.layer2)) {
          if (subEntry.icons.includes(iconName)) {
            subcategory = subcat;
            break;
          }
        }
      }

      icons.push({
        icon: iconName,
        types: entry.types,
        effectiveTypes,
        modules: entry.modules,
        subcategory,
        overridden,
        skipped,
      });
    }

    return icons;
  }

  /**
   * Get registry stats: total icons, multi-type count, unmapped count.
   */
  getStats(): {
    totalIcons: number;
    multiTypeIcons: number;
    mappedIcons: number;
    unmappedIcons: number;
    skippedIcons: number;
    overriddenIcons: number;
    uniqueTypes: string[];
    mappedTypes: string[];
    unmappedTypes: string[];
  } {
    const allTypes = new Set<string>();
    let multiType = 0;
    let mapped = 0;
    let unmapped = 0;
    let skipped = 0;
    let overridden = 0;

    for (const [iconName, entry] of Object.entries(this.iconRegistry)) {
      entry.types.forEach((t) => allTypes.add(t));
      if (entry.types.length > 1) multiType++;

      const override = this.typeOverrides[iconName];
      if (override === 'skip') {
        skipped++;
        continue;
      }

      if (override) {
        overridden++;
        if (this.layer1[override]) {
          mapped++;
          allTypes.add(override);
        } else {
          unmapped++;
        }
      } else {
        const hasMappedType = entry.types.some((t) => this.layer1[t]);
        if (hasMappedType) mapped++;
        else unmapped++;
      }
    }

    const mappedTypes = Array.from(allTypes).filter((t) => this.layer1[t]).sort();
    const unmappedTypes = Array.from(allTypes).filter((t) => !this.layer1[t]).sort();

    return {
      totalIcons: Object.keys(this.iconRegistry).length,
      multiTypeIcons: multiType,
      mappedIcons: mapped,
      unmappedIcons: unmapped,
      skippedIcons: skipped,
      overriddenIcons: overridden,
      uniqueTypes: Array.from(allTypes).sort(),
      mappedTypes,
      unmappedTypes,
    };
  }

  /**
   * Find which types and subcategory an icon belongs to.
   * Uses icon registry for types, Layer 2/3 for subcategory.
   */
  private findIconPlacement(
    iconLower: string,
    registryEntry: IconRegistryEntry | undefined,
  ): {
    types: string[];
    subcategory: string | null;
  } {
    // Check type overrides first (corrects general/other icons)
    const override = this.typeOverrides[iconLower];
    if (override === 'skip') {
      return { types: [], subcategory: null };
    }

    let types: string[] = [];

    if (override) {
      // Use the overridden type if it exists in Layer 1
      if (this.layer1[override]) {
        types = [override];
      }
    } else if (registryEntry) {
      // Fall back to registry types, filtered to Layer 1
      types = registryEntry.types.filter((t) => this.layer1[t]);
    }

    // If still no types, check if iconName is itself a Layer 1 category
    if (types.length === 0 && this.layer1[iconLower]) {
      types = [iconLower];
    }

    // Find subcategory from Layer 3 first, then Layer 2
    let subcategory: string | null = null;

    const layer3Entry = this.layer3[iconLower];
    if (layer3Entry) {
      subcategory = layer3Entry.subcategory;
    } else {
      for (const [subcat, entry] of Object.entries(this.layer2)) {
        if (entry.icons.includes(iconLower)) {
          subcategory = subcat;
          break;
        }
      }
    }

    return { types, subcategory };
  }

  /**
   * Resolve Layer 1 CWEs for a single type from two sources:
   * 1. CWE-699 subcategory members (from DB)
   * 2. applicablePlatforms.technologies keyword matches (JSONB query)
   */
  private async resolveLayer1(category: string): Promise<string[]> {
    const config = this.layer1[category];
    if (!config) return [];

    const cweSet = new Set<string>();

    // Source 1: CWE-699 subcategory members
    if (config.cwe699Subcategories.length > 0) {
      const members = await this.prisma.cweCategoryMember.findMany({
        where: {
          categoryId: { in: config.cwe699Subcategories },
        },
        select: { cweId: true },
      });
      for (const m of members) {
        cweSet.add(m.cweId);
      }
    }

    // Source 2: applicablePlatforms.technologies keyword matches
    if (config.technologyKeywords.length > 0) {
      for (const keyword of config.technologyKeywords) {
        const cwes = await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM cwes
          WHERE applicable_platforms::jsonb -> 'technologies' @> ${JSON.stringify([{ name: keyword }])}::jsonb
        `;
        for (const cwe of cwes) {
          cweSet.add(cwe.id);
        }
      }
    }

    return Array.from(cweSet);
  }
}

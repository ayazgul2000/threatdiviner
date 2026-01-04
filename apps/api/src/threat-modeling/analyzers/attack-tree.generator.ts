import { Injectable } from '@nestjs/common';

export interface AttackTreeNode {
  id?: string;
  label: string;
  type: 'AND' | 'OR' | 'LEAF';
  description?: string;
  probability?: number;
  cost?: number;
  difficulty?: 'trivial' | 'easy' | 'moderate' | 'hard' | 'expert';
  children?: AttackTreeNode[];
  mitigations?: string[];
  cweIds?: string[];
  attackTechniques?: string[];
}

export interface AttackTree {
  id: string;
  name: string;
  goal: string;
  description: string;
  root: AttackTreeNode;
  metadata: {
    createdAt: string;
    targetSystem: string;
    attackerProfile: string;
    assumptions: string[];
  };
  analysis: AttackTreeAnalysis;
}

export interface AttackTreeAnalysis {
  totalPaths: number;
  minCostPath: AttackPath;
  highestProbabilityPath: AttackPath;
  easiestPath: AttackPath;
  leafNodes: number;
  andNodes: number;
  orNodes: number;
  maxDepth: number;
  criticalNodes: string[];
}

export interface AttackPath {
  nodes: string[];
  probability: number;
  cost: number;
  difficulty: string;
}

export interface AttackTreeTemplate {
  id: string;
  name: string;
  category: string;
  goal: string;
  applicableTo: string[];
  tree: Partial<AttackTreeNode>;
}

@Injectable()
export class AttackTreeGenerator {
  private readonly templates: AttackTreeTemplate[] = [
    {
      id: 'DATA_EXFILTRATION',
      name: 'Data Exfiltration Attack Tree',
      category: 'information_disclosure',
      goal: 'Exfiltrate sensitive data from the target system',
      applicableTo: ['database', 'datastore', 'api'],
      tree: {
        type: 'OR',
        label: 'Exfiltrate Data',
        children: [
          {
            type: 'AND',
            label: 'SQL Injection Path',
            children: [
              { type: 'LEAF', label: 'Find injectable input', probability: 0.7, difficulty: 'easy' },
              { type: 'LEAF', label: 'Craft SQL payload', probability: 0.8, difficulty: 'moderate' },
              { type: 'LEAF', label: 'Extract data via UNION', probability: 0.6, difficulty: 'moderate' },
            ],
          },
          {
            type: 'AND',
            label: 'API Exploitation Path',
            children: [
              { type: 'LEAF', label: 'Identify unprotected endpoints', probability: 0.5, difficulty: 'moderate' },
              { type: 'LEAF', label: 'Bypass authentication', probability: 0.4, difficulty: 'hard' },
              { type: 'LEAF', label: 'Extract data via API', probability: 0.8, difficulty: 'easy' },
            ],
          },
          {
            type: 'AND',
            label: 'Insider Threat Path',
            children: [
              { type: 'LEAF', label: 'Compromise employee credentials', probability: 0.3, difficulty: 'hard' },
              { type: 'LEAF', label: 'Access internal systems', probability: 0.9, difficulty: 'trivial' },
              { type: 'LEAF', label: 'Copy data to external storage', probability: 0.7, difficulty: 'easy' },
            ],
          },
        ],
      },
    },
    {
      id: 'AUTHENTICATION_BYPASS',
      name: 'Authentication Bypass Attack Tree',
      category: 'spoofing',
      goal: 'Bypass authentication to gain unauthorized access',
      applicableTo: ['application', 'api', 'service'],
      tree: {
        type: 'OR',
        label: 'Bypass Authentication',
        children: [
          {
            type: 'AND',
            label: 'Credential Theft',
            children: [
              {
                type: 'OR',
                label: 'Obtain Credentials',
                children: [
                  { type: 'LEAF', label: 'Phishing attack', probability: 0.4, difficulty: 'moderate' },
                  { type: 'LEAF', label: 'Credential stuffing', probability: 0.3, difficulty: 'easy' },
                  { type: 'LEAF', label: 'Social engineering', probability: 0.2, difficulty: 'hard' },
                ],
              },
              { type: 'LEAF', label: 'Use stolen credentials', probability: 0.9, difficulty: 'trivial' },
            ],
          },
          {
            type: 'AND',
            label: 'Session Hijacking',
            children: [
              { type: 'LEAF', label: 'Intercept session token', probability: 0.3, difficulty: 'hard' },
              { type: 'LEAF', label: 'Replay session token', probability: 0.8, difficulty: 'easy' },
            ],
          },
          {
            type: 'AND',
            label: 'Authentication Logic Flaw',
            children: [
              { type: 'LEAF', label: 'Identify logic vulnerability', probability: 0.2, difficulty: 'expert' },
              { type: 'LEAF', label: 'Craft bypass payload', probability: 0.7, difficulty: 'moderate' },
            ],
          },
        ],
      },
    },
    {
      id: 'PRIVILEGE_ESCALATION',
      name: 'Privilege Escalation Attack Tree',
      category: 'elevation_of_privilege',
      goal: 'Escalate privileges from low-privilege user to admin',
      applicableTo: ['application', 'service', 'infrastructure'],
      tree: {
        type: 'OR',
        label: 'Escalate Privileges',
        children: [
          {
            type: 'AND',
            label: 'IDOR Exploitation',
            children: [
              { type: 'LEAF', label: 'Identify resource IDs', probability: 0.8, difficulty: 'easy' },
              { type: 'LEAF', label: 'Manipulate ID parameter', probability: 0.7, difficulty: 'easy' },
              { type: 'LEAF', label: 'Access unauthorized resource', probability: 0.5, difficulty: 'easy' },
            ],
          },
          {
            type: 'AND',
            label: 'Role Manipulation',
            children: [
              { type: 'LEAF', label: 'Find role parameter', probability: 0.4, difficulty: 'moderate' },
              { type: 'LEAF', label: 'Modify role value', probability: 0.6, difficulty: 'easy' },
            ],
          },
          {
            type: 'AND',
            label: 'Token Manipulation',
            children: [
              { type: 'LEAF', label: 'Decode JWT token', probability: 0.9, difficulty: 'trivial' },
              { type: 'LEAF', label: 'Modify claims', probability: 0.8, difficulty: 'easy' },
              { type: 'OR', label: 'Bypass signature', children: [
                { type: 'LEAF', label: 'Exploit none algorithm', probability: 0.3, difficulty: 'moderate' },
                { type: 'LEAF', label: 'Find weak secret', probability: 0.2, difficulty: 'hard' },
              ]},
            ],
          },
        ],
      },
    },
    {
      id: 'SERVICE_DISRUPTION',
      name: 'Service Disruption Attack Tree',
      category: 'denial_of_service',
      goal: 'Disrupt service availability',
      applicableTo: ['application', 'api', 'service', 'infrastructure'],
      tree: {
        type: 'OR',
        label: 'Disrupt Service',
        children: [
          {
            type: 'AND',
            label: 'Resource Exhaustion',
            children: [
              { type: 'LEAF', label: 'Identify resource-intensive operation', probability: 0.7, difficulty: 'moderate' },
              { type: 'LEAF', label: 'Send high volume of requests', probability: 0.9, difficulty: 'easy' },
            ],
          },
          {
            type: 'AND',
            label: 'Application Logic DoS',
            children: [
              { type: 'LEAF', label: 'Find algorithmic complexity issue', probability: 0.4, difficulty: 'hard' },
              { type: 'LEAF', label: 'Craft worst-case input', probability: 0.6, difficulty: 'moderate' },
            ],
          },
          {
            type: 'AND',
            label: 'Dependency Targeting',
            children: [
              { type: 'LEAF', label: 'Identify critical dependency', probability: 0.8, difficulty: 'easy' },
              { type: 'LEAF', label: 'Attack dependency service', probability: 0.5, difficulty: 'moderate' },
            ],
          },
        ],
      },
    },
    {
      id: 'CODE_EXECUTION',
      name: 'Remote Code Execution Attack Tree',
      category: 'tampering',
      goal: 'Execute arbitrary code on the target system',
      applicableTo: ['application', 'service', 'infrastructure'],
      tree: {
        type: 'OR',
        label: 'Execute Code',
        children: [
          {
            type: 'AND',
            label: 'Injection Path',
            children: [
              {
                type: 'OR',
                label: 'Find Injection Point',
                children: [
                  { type: 'LEAF', label: 'OS command injection', probability: 0.2, difficulty: 'hard' },
                  { type: 'LEAF', label: 'Template injection', probability: 0.3, difficulty: 'moderate' },
                  { type: 'LEAF', label: 'Expression language injection', probability: 0.25, difficulty: 'hard' },
                ],
              },
              { type: 'LEAF', label: 'Craft exploit payload', probability: 0.7, difficulty: 'moderate' },
            ],
          },
          {
            type: 'AND',
            label: 'Deserialization',
            children: [
              { type: 'LEAF', label: 'Find deserialization endpoint', probability: 0.3, difficulty: 'moderate' },
              { type: 'LEAF', label: 'Create malicious object', probability: 0.6, difficulty: 'hard' },
              { type: 'LEAF', label: 'Trigger execution', probability: 0.8, difficulty: 'moderate' },
            ],
          },
          {
            type: 'AND',
            label: 'File Upload',
            children: [
              { type: 'LEAF', label: 'Find upload functionality', probability: 0.7, difficulty: 'easy' },
              { type: 'LEAF', label: 'Bypass file type checks', probability: 0.5, difficulty: 'moderate' },
              { type: 'LEAF', label: 'Access uploaded file', probability: 0.6, difficulty: 'moderate' },
            ],
          },
        ],
      },
    },
  ];

  generate(
    goal: string,
    targetSystem: any,
    options: {
      attackerProfile?: string;
      maxDepth?: number;
      includeTemplates?: string[];
    } = {}
  ): AttackTree {
    const {
      attackerProfile = 'external_attacker',
      maxDepth = 5,
      includeTemplates = [],
    } = options;

    // Find relevant templates based on target system type
    const relevantTemplates = this.templates.filter(template => {
      if (includeTemplates.length > 0 && !includeTemplates.includes(template.id)) {
        return false;
      }
      return template.applicableTo.some(type =>
        targetSystem.type?.includes(type) || type === 'application'
      );
    });

    // Generate tree from templates
    const root = this.buildTree(goal, relevantTemplates, targetSystem, maxDepth);

    // Analyze the tree
    const analysis = this.analyzeTree(root);

    return {
      id: `AT-${Date.now()}`,
      name: `Attack Tree: ${goal}`,
      goal,
      description: `Attack tree generated for ${targetSystem.name || 'target system'}`,
      root,
      metadata: {
        createdAt: new Date().toISOString(),
        targetSystem: targetSystem.name || 'Unknown',
        attackerProfile,
        assumptions: [
          'Attacker has network access to the target',
          'Target system is operational',
          'Standard security controls are in place',
        ],
      },
      analysis,
    };
  }

  generateFromThreat(threat: any, targetSystem: any): AttackTree {
    const category = threat.strideCategory || threat.category || 'tampering';
    const goal = threat.title || threat.name || 'Compromise target';

    // Find template matching the threat category
    const template = this.templates.find(t => t.category === category);

    if (template) {
      return this.generate(goal, targetSystem, {
        includeTemplates: [template.id],
      });
    }

    // Generate custom tree if no template matches
    return this.generateCustomTree(threat, targetSystem);
  }

  private buildTree(
    goal: string,
    templates: AttackTreeTemplate[],
    targetSystem: any,
    maxDepth: number
  ): AttackTreeNode {
    const root: AttackTreeNode = {
      id: 'ROOT',
      label: goal,
      type: 'OR',
      description: `Root goal: ${goal}`,
      children: [],
    };

    // Add children from templates
    for (const template of templates) {
      const child = this.cloneAndContextualize(
        template.tree as AttackTreeNode,
        targetSystem,
        `${template.id}-`
      );
      if (child) {
        root.children!.push(child);
      }
    }

    // Limit depth
    this.limitDepth(root, maxDepth, 0);

    // Assign IDs
    this.assignIds(root, 'N');

    return root;
  }

  private cloneAndContextualize(
    node: Partial<AttackTreeNode>,
    targetSystem: any,
    prefix: string
  ): AttackTreeNode {
    const cloned: AttackTreeNode = {
      id: `${prefix}${node.label?.replace(/\s+/g, '_') || 'node'}`,
      label: node.label || 'Unknown',
      type: node.type || 'LEAF',
      description: node.description,
      probability: node.probability,
      cost: node.cost,
      difficulty: node.difficulty,
      mitigations: node.mitigations,
      cweIds: node.cweIds,
      attackTechniques: node.attackTechniques,
    };

    if (node.children && node.children.length > 0) {
      cloned.children = node.children.map((child, idx) =>
        this.cloneAndContextualize(child, targetSystem, `${prefix}${idx}-`)
      );
    }

    // Contextualize labels with target system info
    if (targetSystem.name) {
      cloned.label = cloned.label.replace(/target/gi, targetSystem.name);
    }

    return cloned;
  }

  private limitDepth(node: AttackTreeNode, maxDepth: number, currentDepth: number): void {
    if (currentDepth >= maxDepth) {
      // Convert to leaf node
      node.type = 'LEAF';
      node.children = undefined;
      if (!node.probability) node.probability = 0.5;
      if (!node.difficulty) node.difficulty = 'moderate';
      return;
    }

    if (node.children) {
      for (const child of node.children) {
        this.limitDepth(child, maxDepth, currentDepth + 1);
      }
    }
  }

  private assignIds(node: AttackTreeNode, prefix: string, index = 0): void {
    node.id = `${prefix}${index}`;

    if (node.children) {
      node.children.forEach((child, idx) => {
        this.assignIds(child, `${node.id}-`, idx);
      });
    }
  }

  private generateCustomTree(threat: any, targetSystem: any): AttackTree {
    const goal = threat.title || threat.name || 'Compromise target';

    // Build a simple tree based on threat characteristics
    const root: AttackTreeNode = {
      id: 'ROOT',
      label: goal,
      type: 'OR',
      description: threat.description,
      children: [
        {
          id: 'PATH1',
          label: 'Direct Attack',
          type: 'AND',
          children: [
            {
              id: 'PATH1-1',
              label: 'Reconnaissance',
              type: 'LEAF',
              probability: 0.8,
              difficulty: 'easy',
              description: 'Gather information about the target',
            },
            {
              id: 'PATH1-2',
              label: 'Identify Vulnerability',
              type: 'LEAF',
              probability: 0.5,
              difficulty: 'moderate',
              description: 'Find exploitable weakness',
            },
            {
              id: 'PATH1-3',
              label: 'Exploit Vulnerability',
              type: 'LEAF',
              probability: 0.6,
              difficulty: 'moderate',
              description: 'Execute the attack',
            },
          ],
        },
        {
          id: 'PATH2',
          label: 'Indirect Attack',
          type: 'AND',
          children: [
            {
              id: 'PATH2-1',
              label: 'Compromise Related System',
              type: 'LEAF',
              probability: 0.4,
              difficulty: 'hard',
              description: 'Attack adjacent system first',
            },
            {
              id: 'PATH2-2',
              label: 'Pivot to Target',
              type: 'LEAF',
              probability: 0.7,
              difficulty: 'moderate',
              description: 'Move laterally to target',
            },
          ],
        },
      ],
    };

    return {
      id: `AT-CUSTOM-${Date.now()}`,
      name: `Attack Tree: ${goal}`,
      goal,
      description: `Custom attack tree for ${threat.title || 'threat'}`,
      root,
      metadata: {
        createdAt: new Date().toISOString(),
        targetSystem: targetSystem.name || 'Unknown',
        attackerProfile: 'external_attacker',
        assumptions: ['Generic attack model'],
      },
      analysis: this.analyzeTree(root),
    };
  }

  analyzeTree(root: AttackTreeNode): AttackTreeAnalysis {
    const paths: AttackPath[] = [];
    const nodeStats = { leaf: 0, and: 0, or: 0 };
    let maxDepth = 0;
    const criticalNodes: string[] = [];

    // Collect all paths
    this.collectPaths(root, [], paths, nodeStats, 0, (depth) => {
      maxDepth = Math.max(maxDepth, depth);
    });

    // Identify critical nodes (high probability leaf nodes in OR subtrees)
    this.findCriticalNodes(root, criticalNodes);

    // Find optimal paths
    const sortedByCost = [...paths].sort((a, b) => a.cost - b.cost);
    const sortedByProb = [...paths].sort((a, b) => b.probability - a.probability);
    const sortedByDifficulty = [...paths].sort((a, b) => {
      const difficultyOrder = { trivial: 0, easy: 1, moderate: 2, hard: 3, expert: 4 };
      const aDiff = difficultyOrder[a.difficulty as keyof typeof difficultyOrder] || 2;
      const bDiff = difficultyOrder[b.difficulty as keyof typeof difficultyOrder] || 2;
      return aDiff - bDiff;
    });

    return {
      totalPaths: paths.length,
      minCostPath: sortedByCost[0] || this.emptyPath(),
      highestProbabilityPath: sortedByProb[0] || this.emptyPath(),
      easiestPath: sortedByDifficulty[0] || this.emptyPath(),
      leafNodes: nodeStats.leaf,
      andNodes: nodeStats.and,
      orNodes: nodeStats.or,
      maxDepth,
      criticalNodes,
    };
  }

  private collectPaths(
    node: AttackTreeNode,
    currentPath: string[],
    paths: AttackPath[],
    stats: { leaf: number; and: number; or: number },
    depth: number,
    updateDepth: (d: number) => void
  ): AttackPath[] {
    updateDepth(depth);
    const newPath = [...currentPath, node.id || ''].filter(Boolean) as string[];

    if (node.type === 'LEAF' || !node.children || node.children.length === 0) {
      stats.leaf++;
      const path: AttackPath = {
        nodes: newPath,
        probability: node.probability || 0.5,
        cost: node.cost || 100,
        difficulty: node.difficulty || 'moderate',
      };
      paths.push(path);
      return [path];
    }

    if (node.type === 'AND') {
      stats.and++;
      // All children must succeed - multiply probabilities, sum costs
      let combinedProb = 1;
      let combinedCost = 0;
      let maxDifficulty = 'trivial';
      const difficultyOrder = ['trivial', 'easy', 'moderate', 'hard', 'expert'];

      for (const child of node.children) {
        const childPaths = this.collectPaths(child, newPath as string[], paths, stats, depth + 1, updateDepth);
        if (childPaths.length > 0) {
          const bestChild = childPaths.sort((a, b) => b.probability - a.probability)[0];
          combinedProb *= bestChild.probability;
          combinedCost += bestChild.cost;
          if (difficultyOrder.indexOf(bestChild.difficulty) > difficultyOrder.indexOf(maxDifficulty)) {
            maxDifficulty = bestChild.difficulty;
          }
        }
      }

      return [{
        nodes: newPath as string[],
        probability: combinedProb,
        cost: combinedCost,
        difficulty: maxDifficulty,
      }];
    }

    if (node.type === 'OR') {
      stats.or++;
      // Any child can succeed - take best path
      const allChildPaths: AttackPath[] = [];

      for (const child of node.children) {
        const childPaths = this.collectPaths(child, newPath as string[], paths, stats, depth + 1, updateDepth);
        allChildPaths.push(...childPaths);
      }

      return allChildPaths;
    }

    return [];
  }

  private findCriticalNodes(node: AttackTreeNode, critical: string[]): void {
    if (node.type === 'LEAF' && (node.probability || 0) >= 0.7 && node.id) {
      critical.push(node.id);
    }

    if (node.children) {
      for (const child of node.children) {
        this.findCriticalNodes(child, critical);
      }
    }
  }

  private emptyPath(): AttackPath {
    return { nodes: [], probability: 0, cost: 0, difficulty: 'unknown' };
  }

  // Export tree to different formats
  exportToMermaid(tree: AttackTree): string {
    const lines: string[] = ['graph TD'];

    const processNode = (node: AttackTreeNode, parentId?: string) => {
      const nodeId = (node.id || 'node').replace(/-/g, '_');
      const shape = node.type === 'LEAF' ? `[${node.label}]` : `{${node.label}}`;
      lines.push(`    ${nodeId}${shape}`);

      if (parentId) {
        const edgeLabel = node.probability ? `|p=${node.probability}|` : '';
        lines.push(`    ${parentId} -->${edgeLabel} ${nodeId}`);
      }

      if (node.children) {
        for (const child of node.children) {
          processNode(child, nodeId);
        }
      }
    };

    processNode(tree.root);
    return lines.join('\n');
  }

  exportToJson(tree: AttackTree): string {
    return JSON.stringify(tree, null, 2);
  }

  // Get available templates
  getTemplates(): AttackTreeTemplate[] {
    return this.templates.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      goal: t.goal,
      applicableTo: t.applicableTo,
      tree: {}, // Don't expose full tree
    }));
  }
}

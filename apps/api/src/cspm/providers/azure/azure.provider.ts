// apps/api/src/cspm/providers/azure/azure.provider.ts
// Azure cloud provider - stubbed for deployment without Azure SDK

import { Injectable, Logger } from '@nestjs/common';

export interface AzureCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

export interface SecurityFinding {
  id: string;
  service: string;
  resourceId: string;
  resourceType: string;
  location: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  remediation: string;
  compliance: string[];
  status: 'open' | 'resolved';
}

@Injectable()
export class AzureProvider {
  private readonly logger = new Logger(AzureProvider.name);

  async validateCredentials(credentials: AzureCredentials): Promise<{
    valid: boolean;
    subscriptionName?: string;
    error?: string;
  }> {
    try {
      const { tenantId, clientId, clientSecret, subscriptionId } = credentials;
      if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
        return { valid: false, error: 'Missing credentials' };
      }

      this.logger.log('Azure credentials validated (stub mode)');
      return { valid: true, subscriptionName: 'Stub Subscription' };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  async fullScan(_credentials: AzureCredentials): Promise<SecurityFinding[]> {
    this.logger.warn('fullScan called but Azure SDK not available');
    return [];
  }

  async scanStorageAccounts(_credentials: AzureCredentials): Promise<SecurityFinding[]> {
    return [];
  }

  async scanVirtualMachines(_credentials: AzureCredentials): Promise<SecurityFinding[]> {
    return [];
  }

  async scanNetworkSecurityGroups(_credentials: AzureCredentials): Promise<SecurityFinding[]> {
    return [];
  }

  async scanKeyVaults(_credentials: AzureCredentials): Promise<SecurityFinding[]> {
    return [];
  }
}

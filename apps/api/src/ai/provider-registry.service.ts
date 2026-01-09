// apps/api/src/ai/provider-registry.service.ts
// Dynamic provider registry with failover, circuit breaker, and health monitoring

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AIProvider,
  ProviderName,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  ModelInfo,
  ConfigValidationResult,
} from './interfaces/ai-provider.interface';

export interface ProviderHealth {
  name: ProviderName;
  available: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  avgLatencyMs: number;
  circuitOpen: boolean;
}

export interface ProviderStats {
  name: ProviderName;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensUsed: number;
  avgLatencyMs: number;
  lastUsed: Date | null;
}

interface CircuitState {
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;
  openedAt: Date | null;
}

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private providers = new Map<ProviderName, AIProvider>();
  private providerOrder: ProviderName[] = [];
  private circuitStates = new Map<ProviderName, CircuitState>();
  private healthStatus = new Map<ProviderName, ProviderHealth>();
  private stats = new Map<ProviderName, ProviderStats>();
  private latencyHistory = new Map<ProviderName, number[]>();

  // Circuit breaker settings
  private readonly failureThreshold = 5;
  private readonly recoveryTimeMs = 60000; // 1 minute
  private readonly healthCheckIntervalMs = 30000; // 30 seconds

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async onModuleInit(): Promise<void> {
    // Start periodic health checks
    setInterval(() => this.checkAllProviderHealth(), this.healthCheckIntervalMs);
  }

  /**
   * Register a provider with the registry
   */
  registerProvider(provider: AIProvider, priority?: number): void {
    this.providers.set(provider.name, provider);

    // Initialize circuit state
    this.circuitStates.set(provider.name, {
      failures: 0,
      lastFailure: null,
      isOpen: false,
      openedAt: null,
    });

    // Initialize health status
    this.healthStatus.set(provider.name, {
      name: provider.name,
      available: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      avgLatencyMs: 0,
      circuitOpen: false,
    });

    // Initialize stats
    this.stats.set(provider.name, {
      name: provider.name,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokensUsed: 0,
      avgLatencyMs: 0,
      lastUsed: null,
    });

    this.latencyHistory.set(provider.name, []);

    // Add to provider order
    if (priority !== undefined && priority < this.providerOrder.length) {
      this.providerOrder.splice(priority, 0, provider.name);
    } else {
      this.providerOrder.push(provider.name);
    }

    this.logger.log(`Registered provider: ${provider.name} (${provider.displayName})`);
    this.eventEmitter.emit('ai.provider.registered', { name: provider.name });
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(name: ProviderName): boolean {
    if (!this.providers.has(name)) {
      return false;
    }

    this.providers.delete(name);
    this.circuitStates.delete(name);
    this.healthStatus.delete(name);
    this.stats.delete(name);
    this.latencyHistory.delete(name);
    this.providerOrder = this.providerOrder.filter(p => p !== name);

    this.logger.log(`Unregistered provider: ${name}`);
    this.eventEmitter.emit('ai.provider.unregistered', { name });
    return true;
  }

  /**
   * Get a provider by name
   */
  getProvider(name: ProviderName): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all available models across providers
   */
  getAllModels(): Array<ModelInfo & { provider: ProviderName }> {
    const models: Array<ModelInfo & { provider: ProviderName }> = [];
    for (const [name, provider] of this.providers) {
      for (const model of provider.models) {
        models.push({ ...model, provider: name });
      }
    }
    return models;
  }

  /**
   * Set provider priority order
   */
  setProviderOrder(order: ProviderName[]): void {
    // Validate all providers exist
    for (const name of order) {
      if (!this.providers.has(name)) {
        throw new Error(`Provider ${name} not registered`);
      }
    }
    this.providerOrder = order;
    this.logger.log(`Provider order updated: ${order.join(' -> ')}`);
  }

  /**
   * Execute completion with automatic failover
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (const providerName of this.providerOrder) {
      // Check circuit breaker
      if (this.isCircuitOpen(providerName)) {
        this.logger.debug(`Circuit open for ${providerName}, skipping`);
        continue;
      }

      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        // Check if provider is available
        const health = this.healthStatus.get(providerName);
        if (health && !health.available) {
          this.logger.debug(`Provider ${providerName} unavailable, skipping`);
          continue;
        }

        const response = await provider.complete(request);
        const latency = Date.now() - startTime;

        // Record success
        this.recordSuccess(providerName, latency, response.usage.inputTokens + response.usage.outputTokens);
        return response;
      } catch (error: any) {
        lastError = error;
        const latency = Date.now() - startTime;
        this.recordFailure(providerName, latency, error);

        // If rate limited, try next provider
        if (error?.status === 429 || error?.status === 529) {
          this.logger.warn(`Provider ${providerName} rate limited, trying next`);
          continue;
        }

        // If internal error, try next provider
        if (error?.status >= 500) {
          this.logger.warn(`Provider ${providerName} server error, trying next`);
          continue;
        }

        // For other errors, don't failover
        throw error;
      }
    }

    throw lastError || new Error('All AI providers failed or unavailable');
  }

  /**
   * Execute streaming completion with automatic failover
   */
  async *streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (const providerName of this.providerOrder) {
      if (this.isCircuitOpen(providerName)) continue;

      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        const health = this.healthStatus.get(providerName);
        if (health && !health.available) continue;

        yield* provider.streamComplete(request);

        const latency = Date.now() - startTime;
        this.recordSuccess(providerName, latency, 0);
        return;
      } catch (error: any) {
        lastError = error;
        const latency = Date.now() - startTime;
        this.recordFailure(providerName, latency, error);

        if (error?.status === 429 || error?.status === 529 || error?.status >= 500) {
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('All AI providers failed or unavailable');
  }

  /**
   * Get health status for all providers
   */
  getHealthStatus(): ProviderHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get stats for all providers
   */
  getStats(): ProviderStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Validate configuration for a provider
   */
  async validateProviderConfig(name: ProviderName): Promise<ConfigValidationResult> {
    const provider = this.providers.get(name);
    if (!provider) {
      return { valid: false, errors: [`Provider ${name} not registered`], warnings: [] };
    }
    return provider.validateConfig();
  }

  /**
   * Force a health check for a specific provider
   */
  async checkProviderHealth(name: ProviderName): Promise<ProviderHealth | null> {
    const provider = this.providers.get(name);
    if (!provider) return null;

    const startTime = Date.now();
    try {
      const available = await provider.isAvailable();
      const latency = Date.now() - startTime;

      const health: ProviderHealth = {
        name,
        available,
        lastCheck: new Date(),
        consecutiveFailures: available ? 0 : (this.healthStatus.get(name)?.consecutiveFailures || 0) + 1,
        avgLatencyMs: latency,
        circuitOpen: this.isCircuitOpen(name),
      };

      this.healthStatus.set(name, health);
      return health;
    } catch (error) {
      const health: ProviderHealth = {
        name,
        available: false,
        lastCheck: new Date(),
        consecutiveFailures: (this.healthStatus.get(name)?.consecutiveFailures || 0) + 1,
        avgLatencyMs: 0,
        circuitOpen: this.isCircuitOpen(name),
      };

      this.healthStatus.set(name, health);
      return health;
    }
  }

  /**
   * Reset circuit breaker for a provider
   */
  resetCircuit(name: ProviderName): void {
    const state = this.circuitStates.get(name);
    if (state) {
      state.failures = 0;
      state.lastFailure = null;
      state.isOpen = false;
      state.openedAt = null;
    }

    const health = this.healthStatus.get(name);
    if (health) {
      health.circuitOpen = false;
    }

    this.logger.log(`Circuit reset for ${name}`);
    this.eventEmitter.emit('ai.circuit.reset', { name });
  }

  private isCircuitOpen(name: ProviderName): boolean {
    const state = this.circuitStates.get(name);
    if (!state || !state.isOpen) return false;

    // Check if recovery time has passed
    if (state.openedAt && Date.now() - state.openedAt.getTime() > this.recoveryTimeMs) {
      // Half-open state - allow one request through
      state.isOpen = false;
      this.logger.log(`Circuit half-open for ${name}`);
      return false;
    }

    return true;
  }

  private recordSuccess(name: ProviderName, latencyMs: number, tokensUsed: number): void {
    const state = this.circuitStates.get(name);
    if (state) {
      state.failures = 0;
      state.isOpen = false;
      state.openedAt = null;
    }

    const stats = this.stats.get(name);
    if (stats) {
      stats.totalRequests++;
      stats.successfulRequests++;
      stats.totalTokensUsed += tokensUsed;
      stats.lastUsed = new Date();
      this.updateAvgLatency(name, latencyMs);
      stats.avgLatencyMs = this.getAvgLatency(name);
    }

    const health = this.healthStatus.get(name);
    if (health) {
      health.consecutiveFailures = 0;
      health.circuitOpen = false;
    }
  }

  private recordFailure(name: ProviderName, latencyMs: number, error: any): void {
    const state = this.circuitStates.get(name);
    if (state) {
      state.failures++;
      state.lastFailure = new Date();

      if (state.failures >= this.failureThreshold) {
        state.isOpen = true;
        state.openedAt = new Date();
        this.logger.warn(`Circuit opened for ${name} after ${state.failures} failures`);
        this.eventEmitter.emit('ai.circuit.opened', { name, failures: state.failures });
      }
    }

    const stats = this.stats.get(name);
    if (stats) {
      stats.totalRequests++;
      stats.failedRequests++;
      stats.lastUsed = new Date();
    }

    const health = this.healthStatus.get(name);
    if (health) {
      health.consecutiveFailures++;
      health.circuitOpen = this.isCircuitOpen(name);
    }

    this.logger.error(`Provider ${name} failed: ${error.message}`);
    this.eventEmitter.emit('ai.provider.error', { name, error: error.message });
  }

  private updateAvgLatency(name: ProviderName, latencyMs: number): void {
    const history = this.latencyHistory.get(name);
    if (history) {
      history.push(latencyMs);
      // Keep last 100 samples
      if (history.length > 100) {
        history.shift();
      }
    }
  }

  private getAvgLatency(name: ProviderName): number {
    const history = this.latencyHistory.get(name);
    if (!history || history.length === 0) return 0;
    return Math.round(history.reduce((a, b) => a + b, 0) / history.length);
  }

  private async checkAllProviderHealth(): Promise<void> {
    for (const name of this.providers.keys()) {
      await this.checkProviderHealth(name);
    }
  }
}

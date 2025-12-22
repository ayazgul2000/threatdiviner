import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  tenantId: string;
  eventType: string;
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  tags?: string[];
}

export interface SearchQuery {
  tenantId: string;
  eventTypes?: string[];
  sources?: string[];
  severities?: string[];
  startTime?: Date;
  endTime?: Date;
  searchText?: string;
  tags?: string[];
  size?: number;
  from?: number;
}

export interface SearchResult {
  total: number;
  events: SecurityEvent[];
  aggregations?: Record<string, unknown>;
}

@Injectable()
export class OpenSearchProvider implements OnModuleInit {
  private readonly logger = new Logger(OpenSearchProvider.name);
  private readonly opensearchUrl: string;
  private readonly indexPrefix: string;
  private readonly enabled: boolean;

  // In-memory store for when OpenSearch is not available
  private readonly inMemoryEvents: Map<string, SecurityEvent[]> = new Map();
  private readonly maxInMemoryEvents = 10000;

  constructor(private readonly configService: ConfigService) {
    this.opensearchUrl = this.configService.get(
      'OPENSEARCH_URL',
      'http://localhost:9200',
    );
    this.indexPrefix = this.configService.get(
      'OPENSEARCH_INDEX_PREFIX',
      'threatdiviner',
    );
    this.enabled = this.configService.get('OPENSEARCH_ENABLED', 'false') === 'true';
  }

  async onModuleInit(): Promise<void> {
    if (this.enabled) {
      await this.ensureIndicesExist();
    } else {
      this.logger.log('OpenSearch disabled, using in-memory event storage');
    }
  }

  /**
   * Check if OpenSearch is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await fetch(this.opensearchUrl);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create indices if they don't exist
   */
  private async ensureIndicesExist(): Promise<void> {
    try {
      const indexName = `${this.indexPrefix}-events`;
      const response = await fetch(`${this.opensearchUrl}/${indexName}`);

      if (response.status === 404) {
        await this.createIndex(indexName);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure indices exist: ${error}`);
    }
  }

  /**
   * Create an index with proper mapping
   */
  private async createIndex(indexName: string): Promise<void> {
    const mapping = {
      mappings: {
        properties: {
          id: { type: 'keyword' },
          timestamp: { type: 'date' },
          tenantId: { type: 'keyword' },
          eventType: { type: 'keyword' },
          source: { type: 'keyword' },
          severity: { type: 'keyword' },
          title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          description: { type: 'text' },
          metadata: { type: 'object', enabled: true },
          tags: { type: 'keyword' },
        },
      },
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        index: {
          refresh_interval: '5s',
        },
      },
    };

    try {
      const response = await fetch(`${this.opensearchUrl}/${indexName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
      });

      if (response.ok) {
        this.logger.log(`Created index: ${indexName}`);
      } else {
        const error = await response.text();
        this.logger.error(`Failed to create index ${indexName}: ${error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create index ${indexName}: ${error}`);
    }
  }

  /**
   * Index a security event
   */
  async indexEvent(event: SecurityEvent): Promise<void> {
    if (!this.enabled) {
      this.storeInMemory(event);
      return;
    }

    const indexName = `${this.indexPrefix}-events`;

    try {
      const response = await fetch(
        `${this.opensearchUrl}/${indexName}/_doc/${event.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...event,
            timestamp: event.timestamp.toISOString(),
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to index event: ${error}`);
        this.storeInMemory(event);
      }
    } catch (error) {
      this.logger.error(`Failed to index event: ${error}`);
      this.storeInMemory(event);
    }
  }

  /**
   * Bulk index multiple events
   */
  async bulkIndex(events: SecurityEvent[]): Promise<void> {
    if (!this.enabled) {
      events.forEach((e) => this.storeInMemory(e));
      return;
    }

    const indexName = `${this.indexPrefix}-events`;
    const body = events
      .flatMap((event) => [
        { index: { _index: indexName, _id: event.id } },
        { ...event, timestamp: event.timestamp.toISOString() },
      ])
      .map((line) => JSON.stringify(line))
      .join('\n') + '\n';

    try {
      const response = await fetch(`${this.opensearchUrl}/_bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-ndjson' },
        body,
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Bulk index failed: ${error}`);
        events.forEach((e) => this.storeInMemory(e));
      }
    } catch (error) {
      this.logger.error(`Bulk index failed: ${error}`);
      events.forEach((e) => this.storeInMemory(e));
    }
  }

  /**
   * Search for security events
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    if (!this.enabled) {
      return this.searchInMemory(query);
    }

    const indexName = `${this.indexPrefix}-events`;
    const esQuery = this.buildSearchQuery(query);

    try {
      const response = await fetch(`${this.opensearchUrl}/${indexName}/_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esQuery),
      });

      if (!response.ok) {
        this.logger.error(`Search failed: ${await response.text()}`);
        return this.searchInMemory(query);
      }

      const result = await response.json();
      return {
        total: result.hits.total?.value || result.hits.total || 0,
        events: result.hits.hits.map((hit: any) => ({
          ...hit._source,
          timestamp: new Date(hit._source.timestamp),
        })),
        aggregations: result.aggregations,
      };
    } catch (error) {
      this.logger.error(`Search failed: ${error}`);
      return this.searchInMemory(query);
    }
  }

  /**
   * Get aggregations for dashboards
   */
  async getAggregations(
    tenantId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    byEventType: Record<string, number>;
    timeline: Array<{ date: string; count: number }>;
  }> {
    const query = {
      query: {
        bool: {
          must: [
            { term: { tenantId } },
            {
              range: {
                timestamp: {
                  gte: startTime.toISOString(),
                  lte: endTime.toISOString(),
                },
              },
            },
          ],
        },
      },
      size: 0,
      aggs: {
        bySeverity: { terms: { field: 'severity', size: 10 } },
        bySource: { terms: { field: 'source', size: 20 } },
        byEventType: { terms: { field: 'eventType', size: 50 } },
        timeline: {
          date_histogram: {
            field: 'timestamp',
            calendar_interval: 'day',
          },
        },
      },
    };

    if (!this.enabled) {
      return this.getInMemoryAggregations(tenantId, startTime, endTime);
    }

    const indexName = `${this.indexPrefix}-events`;

    try {
      const response = await fetch(`${this.opensearchUrl}/${indexName}/_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        return this.getInMemoryAggregations(tenantId, startTime, endTime);
      }

      const result = await response.json();
      const aggs = result.aggregations;

      return {
        bySeverity: this.bucketsToRecord(aggs.bySeverity?.buckets || []),
        bySource: this.bucketsToRecord(aggs.bySource?.buckets || []),
        byEventType: this.bucketsToRecord(aggs.byEventType?.buckets || []),
        timeline: (aggs.timeline?.buckets || []).map((b: any) => ({
          date: b.key_as_string,
          count: b.doc_count,
        })),
      };
    } catch (error) {
      this.logger.error(`Aggregations failed: ${error}`);
      return this.getInMemoryAggregations(tenantId, startTime, endTime);
    }
  }

  private bucketsToRecord(buckets: Array<{ key: string; doc_count: number }>): Record<string, number> {
    const record: Record<string, number> = {};
    for (const bucket of buckets) {
      record[bucket.key] = bucket.doc_count;
    }
    return record;
  }

  /**
   * Build OpenSearch query from SearchQuery
   */
  private buildSearchQuery(query: SearchQuery): object {
    const must: object[] = [{ term: { tenantId: query.tenantId } }];

    if (query.eventTypes?.length) {
      must.push({ terms: { eventType: query.eventTypes } });
    }

    if (query.sources?.length) {
      must.push({ terms: { source: query.sources } });
    }

    if (query.severities?.length) {
      must.push({ terms: { severity: query.severities } });
    }

    if (query.tags?.length) {
      must.push({ terms: { tags: query.tags } });
    }

    if (query.startTime || query.endTime) {
      const range: Record<string, string> = {};
      if (query.startTime) range.gte = query.startTime.toISOString();
      if (query.endTime) range.lte = query.endTime.toISOString();
      must.push({ range: { timestamp: range } });
    }

    if (query.searchText) {
      must.push({
        multi_match: {
          query: query.searchText,
          fields: ['title', 'description'],
        },
      });
    }

    return {
      query: { bool: { must } },
      sort: [{ timestamp: { order: 'desc' } }],
      size: query.size || 100,
      from: query.from || 0,
    };
  }

  /**
   * Store event in memory (fallback when OpenSearch unavailable)
   */
  private storeInMemory(event: SecurityEvent): void {
    if (!this.inMemoryEvents.has(event.tenantId)) {
      this.inMemoryEvents.set(event.tenantId, []);
    }

    const events = this.inMemoryEvents.get(event.tenantId)!;
    events.unshift(event);

    // Limit memory usage
    if (events.length > this.maxInMemoryEvents) {
      events.pop();
    }
  }

  /**
   * Search in memory (fallback)
   */
  private searchInMemory(query: SearchQuery): SearchResult {
    let events = this.inMemoryEvents.get(query.tenantId) || [];

    // Apply filters
    if (query.eventTypes?.length) {
      events = events.filter((e) => query.eventTypes!.includes(e.eventType));
    }
    if (query.sources?.length) {
      events = events.filter((e) => query.sources!.includes(e.source));
    }
    if (query.severities?.length) {
      events = events.filter((e) => query.severities!.includes(e.severity));
    }
    if (query.startTime) {
      events = events.filter((e) => e.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      events = events.filter((e) => e.timestamp <= query.endTime!);
    }
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(searchLower) ||
          e.description?.toLowerCase().includes(searchLower),
      );
    }

    const total = events.length;
    const from = query.from || 0;
    const size = query.size || 100;
    const paged = events.slice(from, from + size);

    return { total, events: paged };
  }

  /**
   * Get aggregations from in-memory events
   */
  private getInMemoryAggregations(
    tenantId: string,
    startTime: Date,
    endTime: Date,
  ): {
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    byEventType: Record<string, number>;
    timeline: Array<{ date: string; count: number }>;
  } {
    let events = this.inMemoryEvents.get(tenantId) || [];
    events = events.filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime,
    );

    const bySeverity: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byEventType: Record<string, number> = {};
    const byDate: Record<string, number> = {};

    for (const event of events) {
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      bySource[event.source] = (bySource[event.source] || 0) + 1;
      byEventType[event.eventType] = (byEventType[event.eventType] || 0) + 1;
      const date = event.timestamp.toISOString().split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    }

    const timeline = Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { bySeverity, bySource, byEventType, timeline };
  }
}

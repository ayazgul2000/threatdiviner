import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VectorDocument {
  id: string;
  collection: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

interface InMemoryCollection {
  points: Map<string, { vector: number[]; metadata: Record<string, unknown> }>;
}

@Injectable()
export class VectorDbService implements OnModuleDestroy {
  private readonly logger = new Logger(VectorDbService.name);
  private readonly qdrantUrl: string;
  private readonly vectorSize: number;
  private isQdrantAvailable = false;
  private inMemoryStore: Map<string, InMemoryCollection> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.qdrantUrl = this.configService.get('QDRANT_URL', 'http://localhost:6333');
    this.vectorSize = this.configService.get('VECTOR_SIZE', 1536);
  }

  async initialize(): Promise<void> {
    try {
      // Try to connect to Qdrant
      const response = await fetch(`${this.qdrantUrl}/collections`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        this.isQdrantAvailable = true;
        this.logger.log('Connected to Qdrant vector database');
        await this.ensureCollections();
      } else {
        throw new Error(`Qdrant returned status ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(`Qdrant not available, using in-memory fallback: ${error}`);
      this.isQdrantAvailable = false;
      this.initializeInMemoryCollections();
    }
  }

  async onModuleDestroy() {
    // Clean up any resources if needed
    this.inMemoryStore.clear();
  }

  async isAvailable(): Promise<boolean> {
    return this.isQdrantAvailable || this.inMemoryStore.size > 0;
  }

  private async ensureCollections(): Promise<void> {
    const collections = ['cwe_remediation', 'attack_techniques', 'compliance_controls'];

    for (const collection of collections) {
      try {
        const checkResponse = await fetch(`${this.qdrantUrl}/collections/${collection}`, {
          method: 'GET',
        });

        if (checkResponse.status === 404) {
          // Create collection
          const createResponse = await fetch(`${this.qdrantUrl}/collections/${collection}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vectors: {
                size: this.vectorSize,
                distance: 'Cosine',
              },
            }),
          });

          if (createResponse.ok) {
            this.logger.log(`Created Qdrant collection: ${collection}`);
          } else {
            throw new Error(`Failed to create collection: ${await createResponse.text()}`);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to ensure collection ${collection}: ${error}`);
      }
    }
  }

  private initializeInMemoryCollections(): void {
    const collections = ['cwe_remediation', 'attack_techniques', 'compliance_controls'];
    for (const collection of collections) {
      this.inMemoryStore.set(collection, { points: new Map() });
    }
    this.logger.log('Initialized in-memory vector store');
  }

  async upsert(document: VectorDocument): Promise<void> {
    if (this.isQdrantAvailable) {
      await this.qdrantUpsert(document);
    } else {
      this.inMemoryUpsert(document);
    }
  }

  async upsertMany(collection: string, documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return;

    if (this.isQdrantAvailable) {
      await this.qdrantUpsertMany(collection, documents);
    } else {
      for (const doc of documents) {
        this.inMemoryUpsert(doc);
      }
    }
  }

  async search(collection: string, queryVector: number[], limit: number = 5): Promise<SearchResult[]> {
    if (this.isQdrantAvailable) {
      return this.qdrantSearch(collection, queryVector, limit);
    } else {
      return this.inMemorySearch(collection, queryVector, limit);
    }
  }

  async getCollectionStats(): Promise<Array<{ name: string; documentCount: number }>> {
    const collections = ['cwe_remediation', 'attack_techniques', 'compliance_controls'];
    const stats: Array<{ name: string; documentCount: number }> = [];

    for (const collection of collections) {
      try {
        if (this.isQdrantAvailable) {
          const response = await fetch(`${this.qdrantUrl}/collections/${collection}`, {
            method: 'GET',
          });
          if (response.ok) {
            const data = await response.json();
            stats.push({
              name: collection,
              documentCount: data.result?.points_count || 0,
            });
          }
        } else {
          const col = this.inMemoryStore.get(collection);
          stats.push({
            name: collection,
            documentCount: col?.points.size || 0,
          });
        }
      } catch (error) {
        this.logger.error(`Failed to get stats for ${collection}: ${error}`);
        stats.push({ name: collection, documentCount: 0 });
      }
    }

    return stats;
  }

  // Qdrant-specific methods
  private async qdrantUpsert(document: VectorDocument): Promise<void> {
    const point: QdrantPoint = {
      id: document.id,
      vector: document.embedding,
      payload: document.metadata,
    };

    const response = await fetch(
      `${this.qdrantUrl}/collections/${document.collection}/points?wait=true`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: [point] }),
      }
    );

    if (!response.ok) {
      throw new Error(`Qdrant upsert failed: ${await response.text()}`);
    }
  }

  private async qdrantUpsertMany(collection: string, documents: VectorDocument[]): Promise<void> {
    const points: QdrantPoint[] = documents.map(doc => ({
      id: doc.id,
      vector: doc.embedding,
      payload: doc.metadata,
    }));

    // Batch in chunks of 100
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);

      const response = await fetch(
        `${this.qdrantUrl}/collections/${collection}/points?wait=true`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: batch }),
        }
      );

      if (!response.ok) {
        throw new Error(`Qdrant batch upsert failed: ${await response.text()}`);
      }
    }
  }

  private async qdrantSearch(collection: string, queryVector: number[], limit: number): Promise<SearchResult[]> {
    const response = await fetch(
      `${this.qdrantUrl}/collections/${collection}/points/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vector: queryVector,
          limit,
          with_payload: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Qdrant search failed: ${await response.text()}`);
    }

    const data = await response.json();
    return (data.result || []).map((hit: { id: string; score: number; payload: Record<string, unknown> }) => ({
      id: hit.id,
      score: hit.score,
      metadata: hit.payload,
    }));
  }

  // In-memory fallback methods
  private inMemoryUpsert(document: VectorDocument): void {
    let collection = this.inMemoryStore.get(document.collection);
    if (!collection) {
      collection = { points: new Map() };
      this.inMemoryStore.set(document.collection, collection);
    }
    collection.points.set(document.id, {
      vector: document.embedding,
      metadata: document.metadata,
    });
  }

  private inMemorySearch(collection: string, queryVector: number[], limit: number): SearchResult[] {
    const col = this.inMemoryStore.get(collection);
    if (!col || col.points.size === 0) {
      return [];
    }

    // Calculate cosine similarity for all points
    const results: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];

    for (const [id, point] of col.points.entries()) {
      const score = this.cosineSimilarity(queryVector, point.vector);
      results.push({ id, score, metadata: point.metadata });
    }

    // Sort by score descending and take top N
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }
}

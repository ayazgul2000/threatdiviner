// apps/api/src/knowledge/rag/embedding.service.ts
// Embedding generation using OpenAI text-embedding-3-small

import { Injectable, Logger } from '@nestjs/common';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set, returning zero embedding');
      return new Array(EMBEDDING_DIMENSION).fill(0);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text.substring(0, 8000), // Truncate to fit model context
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      return data.data[0].embedding;
    } catch (e) {
      this.logger.error('Embedding generation failed', e);
      return new Array(EMBEDDING_DIMENSION).fill(0);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.generateEmbedding(text));
      await new Promise(r => setTimeout(r, 50)); // Rate limit
    }
    return results;
  }

  getDimension(): number {
    return EMBEDDING_DIMENSION;
  }
}

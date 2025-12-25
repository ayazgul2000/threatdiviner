import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openaiApiKey: string | undefined;
  private readonly openaiUrl: string;
  private readonly model: string;
  private readonly vectorSize: number;

  constructor(private readonly configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openaiUrl = this.configService.get('OPENAI_API_URL', 'https://api.openai.com/v1');
    this.model = this.configService.get('EMBEDDING_MODEL', 'text-embedding-3-small');
    this.vectorSize = this.configService.get('VECTOR_SIZE', 1536);

    if (this.openaiApiKey) {
      this.logger.log('OpenAI embedding service initialized');
    } else {
      this.logger.warn('OPENAI_API_KEY not configured - using local hash-based embeddings (lower quality)');
    }
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available with fallback
  }

  async embed(text: string): Promise<number[] | null> {
    if (!text || text.trim().length === 0) {
      return null;
    }

    if (this.openaiApiKey) {
      return this.openaiEmbed(text);
    } else {
      return this.localEmbed(text);
    }
  }

  async embedBatch(texts: string[]): Promise<Array<number[] | null>> {
    if (this.openaiApiKey) {
      return this.openaiEmbedBatch(texts);
    } else {
      return Promise.all(texts.map(t => this.localEmbed(t)));
    }
  }

  private async openaiEmbed(text: string): Promise<number[] | null> {
    try {
      const response = await fetch(`${this.openaiUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text.substring(0, 8000), // Limit input length
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI embedding failed: ${error}`);
      }

      const data = await response.json();
      return data.data[0]?.embedding || null;
    } catch (error) {
      this.logger.error(`OpenAI embedding failed: ${error}`);
      // Fall back to local embedding
      return this.localEmbed(text);
    }
  }

  private async openaiEmbedBatch(texts: string[]): Promise<Array<number[] | null>> {
    try {
      // Filter out empty texts
      const validTexts = texts.map((t, i) => ({ text: t?.substring(0, 8000) || '', originalIndex: i }))
        .filter(t => t.text.length > 0);

      if (validTexts.length === 0) {
        return texts.map(() => null);
      }

      const response = await fetch(`${this.openaiUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: validTexts.map(t => t.text),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI batch embedding failed: ${error}`);
      }

      const data = await response.json();
      const embeddings = data.data as Array<{ embedding: number[]; index: number }>;

      // Map embeddings back to original positions
      const result: Array<number[] | null> = texts.map(() => null);
      for (const embedding of embeddings) {
        const originalIndex = validTexts[embedding.index]?.originalIndex;
        if (originalIndex !== undefined) {
          result[originalIndex] = embedding.embedding;
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`OpenAI batch embedding failed: ${error}`);
      // Fall back to local embeddings
      return Promise.all(texts.map(t => this.localEmbed(t)));
    }
  }

  /**
   * Local fallback embedding using a simple hash-based approach.
   * This produces consistent embeddings but with lower semantic quality than ML models.
   */
  private async localEmbed(text: string): Promise<number[] | null> {
    if (!text || text.trim().length === 0) {
      return null;
    }

    // Normalize text
    const normalizedText = text.toLowerCase().trim();

    // Create a deterministic embedding based on character and word features
    const embedding = new Array(this.vectorSize).fill(0);

    // Character-based features
    for (let i = 0; i < normalizedText.length; i++) {
      const charCode = normalizedText.charCodeAt(i);
      const position = i % this.vectorSize;
      embedding[position] += (charCode / 256) * Math.sin((i + 1) * 0.1);
    }

    // Word-based features
    const words = normalizedText.split(/\s+/).filter(w => w.length > 0);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordHash = this.hashString(word);
      const position = wordHash % this.vectorSize;

      // Add word frequency and position information
      embedding[position] += 1 / (i + 1);
      embedding[(position + 1) % this.vectorSize] += word.length / 20;
    }

    // N-gram features (character bigrams and trigrams)
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= normalizedText.length - n; i++) {
        const ngram = normalizedText.substring(i, i + n);
        const hash = this.hashString(ngram);
        const position = hash % this.vectorSize;
        embedding[position] += 0.5 / n;
      }
    }

    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

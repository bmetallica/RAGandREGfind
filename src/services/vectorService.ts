import axios from "axios";
import { env } from "../config/env";

interface OllamaEmbedResponse {
  embeddings?: number[][];
  embedding?: number[];
}

export class VectorService {
  async embed(texts: string[], model = env.EMBEDDING_MODEL): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const response = await axios.post<OllamaEmbedResponse>(
        `${env.OLLAMA_BASE_URL}/api/embed`,
        {
          model,
          input: texts
        },
        {
          timeout: 60_000
        }
      );

      const embeddings = response.data.embeddings ?? (response.data.embedding ? [response.data.embedding] : []);
      if (embeddings.length !== texts.length) {
        throw new Error(`expected ${texts.length} embeddings, received ${embeddings.length}`);
      }

      for (const embedding of embeddings) {
        if (embedding.length !== env.EMBEDDING_DIMENSION) {
          throw new Error(
            `embedding dimension mismatch: expected ${env.EMBEDDING_DIMENSION}, received ${embedding.length}`
          );
        }
      }

      return embeddings;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data ?? error.message;
        throw new Error(`failed to reach Ollama at ${env.OLLAMA_BASE_URL}: ${JSON.stringify(detail)}`);
      }

      throw error;
    }
  }

  async embedOne(text: string, model = env.EMBEDDING_MODEL): Promise<number[]> {
    const [embedding] = await this.embed([text], model);
    return embedding;
  }
}

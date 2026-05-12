import axios from "axios";
import { env } from "../config/env";

interface OllamaGenerateResponse {
  response?: string;
}

export class LlmService {
  async generate(prompt: string, model = env.LLM_MODEL): Promise<string> {
    try {
      const response = await axios.post<OllamaGenerateResponse>(
        `${env.OLLAMA_BASE_URL}/api/generate`,
        {
          model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1
          }
        },
        {
          timeout: 120_000
        }
      );

      const text = response.data.response?.trim();
      if (!text) {
        throw new Error("empty response from Ollama generate API");
      }

      return text;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data ?? error.message;
        throw new Error(`failed to reach Ollama generate API at ${env.OLLAMA_BASE_URL}: ${JSON.stringify(detail)}`);
      }

      throw error;
    }
  }
}

import { createModel } from '@tanstack/ai';
import { openaiCompatible } from '@tanstack/ai-openai/compatible';
import { env } from '#/env';

/** Default model + endpoint. Forks can override per call via {@link RunModelOptions}. */
export const defaultModel = 'devstral-2-123b-instruct-2512';
const defaultBaseUrl = 'https://api.scaleway.ai/v1';

/**
 * Provider-native sampling options for the Scaleway OpenAI-compatible Chat
 * Completions endpoint. Keys map 1:1 to the wire payload, so they live under
 * TanStack AI's `modelOptions` rather than as loose top-level chat props.
 */
export interface ScalewayModelOptions {
  temperature?: number;
  top_p?: number;
  max_completion_tokens?: number;
}

/**
 * Build a TanStack AI adapter for the Scaleway endpoint (OpenAI Chat
 * Completions compatible). The model is declared via `createModel` so that
 * `modelOptions` is typed as {@link ScalewayModelOptions} at the call site.
 */
export function createAgentAdapter(options: { model?: string; baseUrl?: string } = {}) {
  const apiKey = env.SCW_AI_API_KEY;
  if (!apiKey) throw new Error('SCW_AI_API_KEY is not configured');

  const model = options.model ?? defaultModel;
  const provider = openaiCompatible({
    name: 'scaleway',
    baseURL: options.baseUrl ?? defaultBaseUrl,
    apiKey,
    models: [createModel(model, { input: ['text'], modelOptions: {} as ScalewayModelOptions })],
  });
  return provider(model);
}

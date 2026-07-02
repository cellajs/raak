import { chat, type ModelMessage, maxIterations, type StreamChunk } from '@tanstack/ai';
import type { AuthContext } from '#/core/context';
import { createAgentAdapter, defaultModel, type ScalewayModelOptions } from '#/modules/agent/provider';
import { buildTools } from '#/modules/ai/tool-registry';

export { defaultModel };

export interface RunModelOptions {
  /** Conversation so far, in model format. The caller owns history/persistence. */
  messages: Array<ModelMessage<string | null>>;
  /** System prompts to prepend (e.g. from `buildSystemPrompt`). */
  systemPrompts?: string[];
  /** Server tools to expose. Defaults to the fork's `buildTools(ctx)` registry. */
  tools?: ReturnType<typeof buildTools>;
  /** Max agent-loop iterations before stopping. */
  iterations?: number;
  /** Override the model id. */
  model?: string;
  /** Override the OpenAI-compatible base URL. */
  baseUrl?: string;
  /** Provider-native sampling options (temperature, top_p, max_completion_tokens). */
  modelOptions?: ScalewayModelOptions;
}

/**
 * Run the AI model over a set of messages and return a raw chunk stream.
 *
 * This is the agent's server-side model runner: it wires the model adapter,
 * system prompts, and the shared server tool registry (from `#/modules/ai`),
 * then drives the agent loop. It has no knowledge of chats, messages, or
 * persistence — the caller (the agent's `stream-chat`) owns history and storage.
 */
export function runModel(ctx: AuthContext, options: RunModelOptions): AsyncIterable<StreamChunk> {
  return chat({
    adapter: createAgentAdapter({ model: options.model, baseUrl: options.baseUrl }),
    messages: options.messages,
    systemPrompts: options.systemPrompts ?? [],
    tools: options.tools ?? buildTools(ctx),
    agentLoopStrategy: maxIterations(options.iterations ?? 5),
    modelOptions: options.modelOptions,
  });
}

import OpenAI from 'openai'
import type { ChatMessage, ChatProvider } from './types'
import type { TokenUsage, StreamOptions } from '@/lib/tools/types'

const MODEL_MAP: Record<string, string> = {
  'Llama 3.3 70B': 'llama-3.3-70b-versatile',
  'Llama 3.1 8B':  'llama-3.1-8b-instant',
  'Mixtral 8x7B':  'mixtral-8x7b-32768',
  'Gemma2 9B':     'gemma2-9b-it',
}

export class GroqProvider implements ChatProvider {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  }

  async stream(messages: ChatMessage[], model: string, options?: StreamOptions): Promise<ReadableStream<Uint8Array>> {
    const resolvedModel = MODEL_MAP[model] ?? model
    const encoder = new TextEncoder()

    // Groq does not support vision/attachments in this flow.
    // Strip all non-chat fields before calling the API to prevent 400 errors.
    const groqMessages = messages.map(msg => ({
      role:    msg.role,
      content: msg.content.trim().length > 0
        ? msg.content
        : '[file attached — vision not supported by Groq]',
    }))
    const completion = await this.client.chat.completions.create({
      model: resolvedModel,
      messages: groqMessages,
      stream: true,
      stream_options: { include_usage: true },
    })

    return new ReadableStream({
      async start(controller) {
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
          if (chunk.usage) {
            try {
              const usage: TokenUsage = {
                provider:      'groq',
                model:         resolvedModel,
                input_tokens:  chunk.usage.prompt_tokens     ?? 0,
                output_tokens: chunk.usage.completion_tokens ?? 0,
                total_tokens:  chunk.usage.total_tokens      ??
                  (chunk.usage.prompt_tokens ?? 0) + (chunk.usage.completion_tokens ?? 0),
              }
              await options?.onUsage?.(usage)
            } catch (error) {
              console.error('[groq] failed to capture token usage', error)
            }
          }
        }
        controller.close()
      },
    })
  }
}

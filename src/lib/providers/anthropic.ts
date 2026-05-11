import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ChatProvider } from './types'

const MODEL_MAP: Record<string, string> = {
  'Claude Sonnet':     'claude-sonnet-4-5',
  'Claude 3.5 Sonnet': 'claude-sonnet-4-5',
  'Claude 3.7 Sonnet': 'claude-sonnet-4-5',
  'Claude 3 Haiku':    'claude-3-haiku-20240307',
  'Claude 3 Opus':     'claude-3-opus-20240229',
}

export class AnthropicProvider implements ChatProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async stream(messages: ChatMessage[], model: string): Promise<ReadableStream<Uint8Array>> {
    const resolvedModel = MODEL_MAP[model] ?? model
    const encoder = new TextEncoder()

    const sdkStream = await this.client.messages.create({
      model: resolvedModel,
      max_tokens: 2048,
      messages,
      stream: true,
    })

    return new ReadableStream({
      async start(controller) {
        for await (const event of sdkStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      },
    })
  }
}

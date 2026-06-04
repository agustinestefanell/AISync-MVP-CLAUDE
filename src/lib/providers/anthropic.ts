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

    const sdkMessages: Anthropic.MessageParam[] = messages.map(msg => {
      if (msg.role === 'user' && msg.attachments?.length) {
        const blocks: Anthropic.MessageParam['content'] = [
          ...msg.attachments.map(att => {
            if (att.type === 'image') {
              return {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: att.media_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: att.data,
                },
              }
            }
            return {
              type: 'document' as const,
              source: {
                type: 'base64' as const,
                media_type: att.media_type as 'application/pdf',
                data: att.data,
              },
            }
          }),
          { type: 'text' as const, text: msg.content },
        ]
        return { role: msg.role, content: blocks }
      }
      return { role: msg.role, content: msg.content }
    })

    const sdkStream = await this.client.messages.create({
      model: resolvedModel,
      max_tokens: 2048,
      messages: sdkMessages,
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

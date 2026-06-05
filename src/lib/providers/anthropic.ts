import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ChatProvider } from './types'
import type { ToolCall, ToolDefinition } from '@/lib/tools'

const MODEL_MAP: Record<string, string> = {
  'Claude Sonnet':     'claude-sonnet-4-5',
  'Claude 3.5 Sonnet': 'claude-sonnet-4-5',
  'Claude 3.7 Sonnet': 'claude-sonnet-4-5',
  'Claude 3 Haiku':    'claude-3-haiku-20240307',
  'Claude 3 Opus':     'claude-3-opus-20240229',
}

function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map(msg => {
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
        ...(msg.content ? [{ type: 'text' as const, text: msg.content }] : []),
      ]
      return { role: msg.role, content: blocks }
    }
    return { role: msg.role, content: msg.content }
  })
}

export class AnthropicProvider implements ChatProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async stream(messages: ChatMessage[], model: string): Promise<ReadableStream<Uint8Array>> {
    const resolvedModel = MODEL_MAP[model] ?? model
    const encoder = new TextEncoder()

    const sdkMessages = toAnthropicMessages(messages)

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

  async complete(
    messages: ChatMessage[],
    model: string,
    tools?: ToolDefinition[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const resolvedModel = MODEL_MAP[model] ?? model
    const sdkMessages = toAnthropicMessages(messages)

    const response = await this.client.messages.create({
      model: resolvedModel,
      max_tokens: 2048,
      messages: sdkMessages,
      ...(tools?.length ? {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters as Anthropic.Tool['input_schema'],
        })),
      } : {}),
    })

    const textParts: string[] = []
    const toolCalls: ToolCall[] = []

    for (const block of response.content) {
      if (block.type === 'text') textParts.push(block.text)
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        })
      }
    }

    return {
      content: textParts.join('\n'),
      toolCalls: toolCalls.length ? toolCalls : undefined,
    }
  }
}

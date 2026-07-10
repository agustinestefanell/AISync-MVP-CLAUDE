import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ChatProvider } from './types'
import type { ToolCall, ToolDefinition } from '@/lib/tools'
import type { TokenUsage, StreamOptions } from '@/lib/tools/types'

const MODEL_MAP: Record<string, string> = {
  'Claude Sonnet':     'claude-sonnet-4-6',
  'Claude 3.5 Sonnet': 'claude-sonnet-4-6',
  'Claude 3.7 Sonnet': 'claude-sonnet-4-6',
  'Claude Sonnet 4.6': 'claude-sonnet-4-6',
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
    return { role: msg.role, content: msg.content || '[file attached]' }
  })
}

export class AnthropicProvider implements ChatProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async stream(messages: ChatMessage[], model: string, options?: StreamOptions): Promise<ReadableStream<Uint8Array>> {
    const resolvedModel = MODEL_MAP[model] ?? model
    const encoder = new TextEncoder()

    const sdkMessages = toAnthropicMessages(messages)

    const sdkStream = this.client.messages.stream({
      model: resolvedModel,
      max_tokens: 2048,
      messages: sdkMessages,
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
        try {
          const finalMsg = await sdkStream.finalMessage()
          const usage: TokenUsage = {
            provider:      'anthropic',
            model:         resolvedModel,
            input_tokens:  finalMsg.usage?.input_tokens  ?? 0,
            output_tokens: finalMsg.usage?.output_tokens ?? 0,
            total_tokens:  (finalMsg.usage?.input_tokens ?? 0) + (finalMsg.usage?.output_tokens ?? 0),
          }
          await options?.onUsage?.(usage)
        } catch (error) {
          console.error('[anthropic] failed to capture token usage', error)
        }
        controller.close()
      },
    })
  }

  async complete(
    messages: ChatMessage[],
    model: string,
    tools?: ToolDefinition[],
    options?: StreamOptions
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

    try {
      const usage: TokenUsage = {
        provider:      'anthropic',
        model:         resolvedModel,
        input_tokens:  response.usage?.input_tokens  ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
        total_tokens:  (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      }
      await options?.onUsage?.(usage)
    } catch (error) {
      console.error('[anthropic] failed to capture token usage', error)
    }

    return {
      content: textParts.join('\n'),
      toolCalls: toolCalls.length ? toolCalls : undefined,
    }
  }
}

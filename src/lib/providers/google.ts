import { GoogleGenerativeAI, type Part, type FunctionDeclaration } from '@google/generative-ai'
import { randomUUID } from 'crypto'
import type { ChatMessage, ChatProvider } from './types'
import type { ToolCall, ToolDefinition } from '@/lib/tools'
import type { TokenUsage, StreamOptions } from '@/lib/tools/types'

const MODEL_MAP: Record<string, string> = {
  'Gemini 2.0 Flash':  'gemini-2.0-flash',
  // Legacy mappings for backwards compatibility
  'Gemini 2.0':        'gemini-2.0-flash',
  'Gemini 2.5 Flash':  'gemini-2.0-flash',
  'Gemini 1.5 Pro':    'gemini-2.0-flash',
  'Gemini 1.5 Flash':  'gemini-2.0-flash',
}

export class GoogleProvider implements ChatProvider {
  private genAI: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  async stream(messages: ChatMessage[], model: string, options?: StreamOptions): Promise<ReadableStream<Uint8Array>> {
    const resolvedModel = MODEL_MAP[model] ?? model
    const genModel = this.genAI.getGenerativeModel({ model: resolvedModel })
    const encoder = new TextEncoder()

    // Gemini separa historial del mensaje actual
    // Note: attachments in history messages are not forwarded to Google.
    // Only the current message supports inlineData parts.
    // This is a known MVP limitation.
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1]

    const chat = genModel.startChat({ history })

    let result
    if (lastMessage.attachments?.length) {
      const parts: (string | Part)[] = [
        ...lastMessage.attachments.map(att => ({
          inlineData: { mimeType: att.media_type, data: att.data },
        })),
        lastMessage.content,
      ]
      result = await chat.sendMessageStream(parts)
    } else {
      result = await chat.sendMessageStream(lastMessage.content)
    }

    return new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) controller.enqueue(encoder.encode(text))
        }
        try {
          const finalResponse = await result.response
          const usageMetadata = finalResponse.usageMetadata
          const usage: TokenUsage = {
            provider:      'google',
            model:         resolvedModel,
            input_tokens:  usageMetadata?.promptTokenCount     ?? 0,
            output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
            total_tokens:  usageMetadata?.totalTokenCount      ??
              (usageMetadata?.promptTokenCount ?? 0) + (usageMetadata?.candidatesTokenCount ?? 0),
          }
          await options?.onUsage?.(usage)
        } catch (error) {
          console.error('[google] failed to capture token usage', error)
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

    const genModel = this.genAI.getGenerativeModel({
      model: resolvedModel,
      ...(tools?.length ? {
        tools: [{
          functionDeclarations: tools.map(t => ({
            name:        t.name,
            description: t.description,
            parameters:  t.parameters as unknown as FunctionDeclaration['parameters'],
          })),
        }],
      } : {}),
    })

    const lastMessage = messages[messages.length - 1]
    const response = (await genModel.generateContent(lastMessage.content)).response
    const functionCalls = response.functionCalls() ?? []

    try {
      const usageMetadata = response.usageMetadata
      const usage: TokenUsage = {
        provider:      'google',
        model:         resolvedModel,
        input_tokens:  usageMetadata?.promptTokenCount     ?? 0,
        output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
        total_tokens:  usageMetadata?.totalTokenCount      ??
          (usageMetadata?.promptTokenCount ?? 0) + (usageMetadata?.candidatesTokenCount ?? 0),
      }
      await options?.onUsage?.(usage)
    } catch (error) {
      console.error('[google] failed to capture token usage', error)
    }

    return {
      content:   response.text() ?? '',
      toolCalls: functionCalls.length ? functionCalls.map(fc => ({
        id:    randomUUID(),
        name:  fc.name,
        input: fc.args as Record<string, unknown>,
      })) : undefined,
    }
  }
}

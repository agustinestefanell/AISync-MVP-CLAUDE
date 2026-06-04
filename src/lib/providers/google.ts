import { GoogleGenerativeAI, type Part, type FunctionDeclaration } from '@google/generative-ai'
import { randomUUID } from 'crypto'
import type { ChatMessage, ChatProvider } from './types'
import type { ToolCall, ToolDefinition } from '@/lib/tools'

const MODEL_MAP: Record<string, string> = {
  'Gemini 2.0':        'gemini-2.5-flash',
  'Gemini 2.0 Flash':  'gemini-2.5-flash',
  'Gemini 2.5 Flash':  'gemini-2.5-flash',
  'Gemini 1.5 Pro':    'gemini-1.5-pro',
  'Gemini 1.5 Flash':  'gemini-1.5-flash',
}

export class GoogleProvider implements ChatProvider {
  private genAI: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  async stream(messages: ChatMessage[], model: string): Promise<ReadableStream<Uint8Array>> {
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

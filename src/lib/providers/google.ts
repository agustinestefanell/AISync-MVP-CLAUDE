import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChatMessage, ChatProvider } from './types'

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
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1]

    const chat = genModel.startChat({ history })
    const result = await chat.sendMessageStream(lastMessage.content)

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
}

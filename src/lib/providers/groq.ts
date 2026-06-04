import OpenAI from 'openai'
import type { ChatMessage, ChatProvider } from './types'

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

  async stream(messages: ChatMessage[], model: string): Promise<ReadableStream<Uint8Array>> {
    const resolvedModel = MODEL_MAP[model] ?? model
    const encoder = new TextEncoder()

    // Note: Groq models currently do not support vision/attachments.
    // ChatMessage.attachments are ignored silently.
    const completion = await this.client.chat.completions.create({
      model: resolvedModel,
      messages,
      stream: true,
    })

    return new ReadableStream({
      async start(controller) {
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      },
    })
  }
}

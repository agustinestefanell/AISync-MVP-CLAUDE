import OpenAI from 'openai'
import type { ChatMessage, ChatProvider } from './types'

const MODEL_MAP: Record<string, string> = {
  'GPT-4o':      'gpt-4o',
  'GPT-4o Mini': 'gpt-4o-mini',
  'GPT-4 Turbo': 'gpt-4-turbo',
  'o1':          'o1',
  'o3 Mini':     'o3-mini',
}

export class OpenAIProvider implements ChatProvider {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async stream(messages: ChatMessage[], model: string): Promise<ReadableStream<Uint8Array>> {
    const resolvedModel = MODEL_MAP[model] ?? model
    const encoder = new TextEncoder()

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

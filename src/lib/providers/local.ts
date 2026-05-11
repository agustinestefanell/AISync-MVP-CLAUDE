import OpenAI from 'openai'
import type { ChatMessage, ChatProvider } from './types'

// Sirve tanto para IA Local (Ollama/LM Studio) como para providers personalizados
// con API compatible con OpenAI. Si no se pasa apiKey usa 'local' como placeholder
// (Ollama no requiere key real).
export class LocalProvider implements ChatProvider {
  private client: OpenAI

  constructor(endpoint: string, apiKey?: string) {
    this.client = new OpenAI({
      apiKey:  apiKey ?? 'local',
      baseURL: endpoint.replace(/\/$/, ''),
    })
  }

  async stream(messages: ChatMessage[], model: string): Promise<ReadableStream<Uint8Array>> {
    const completion = await this.client.chat.completions.create({
      model,
      messages,
      stream: true,
    })

    const encoder = new TextEncoder()
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

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

    // OpenAI image_url supports image attachments here.
    // PDF/document support requires the Files API and is intentionally deferred.
    const sdkMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map(msg => {
      if (msg.role === 'user' && msg.attachments?.length) {
        const imageAtts = msg.attachments.filter(att => att.type === 'image')
        if (!imageAtts.length) {
          // No image attachments — PDFs not supported via image_url, send text with notice
          return { role: 'user' as const, content: msg.content || '[File attached — PDF not supported by OpenAI. Use Anthropic or Gemini.]' }
        }

        const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
          ...imageAtts.map(att => ({
            type: 'image_url' as const,
            image_url: { url: `data:${att.media_type};base64,${att.data}` },
          })),
          { type: 'text' as const, text: msg.content },
        ]
        return { role: 'user' as const, content: parts }
      }
      return { role: msg.role, content: msg.content }
    })

    const completion = await this.client.chat.completions.create({
      model: resolvedModel,
      messages: sdkMessages,
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

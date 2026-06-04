import { tavily } from '@tavily/core'
import type { ToolExecutor } from './types'

export const webSearchTool: ToolExecutor = {
  definition: {
    name: 'web_search',
    description:
      'Search the web for current information. Use when the user asks about recent events, current prices, news, or anything that requires up-to-date information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
      },
      required: ['query'],
    },
  },

  async execute(input) {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) throw new Error('TAVILY_API_KEY not configured')

    const client = tavily({ apiKey })

    const result = await client.search(input.query as string, {
      maxResults: 5,
      searchDepth: 'basic',
    })

    return result.results
      .map(r => `${r.title}\n${r.url}\n${r.content}`)
      .join('\n\n---\n\n')
  },
}

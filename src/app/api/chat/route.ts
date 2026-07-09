import { createClient } from '@/lib/supabase/server'
import { rateLimiters } from '@/lib/rate-limit'
import { getProvider } from '@/lib/providers'
import { resolveProviderApiKey, KNOWN_PROVIDERS } from '@/lib/providers/resolveApiKey'
import { LocalProvider } from '@/lib/providers/local'
import { getSystemPrompt } from '@/lib/db/system-prompts'
import { listActivePromptsForContext } from '@/lib/db/prompts'
import { getContextSourcesForRuntime } from '@/lib/db/context'
import { getTool, webSearchTool } from '@/lib/tools'
import type { ChatMessage } from '@/lib/providers/types'
import type { ToolResult } from '@/lib/tools'
import { AnthropicProvider } from '@/lib/providers/anthropic'
import { OpenAIProvider }   from '@/lib/providers/openai'
import { GroqProvider }     from '@/lib/providers/groq'
import { GoogleProvider }   from '@/lib/providers/google'
import type { TokenUsage } from '@/lib/tools/types'

export const dynamic = 'force-dynamic'

interface PanelSnapshot {
  role:         string
  panel:        string
  lastMessages: { role: string; content: string }[]
}

function truncateContextText(text: string, maxLength = 35000): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized.' }, { status: 401 })

  const rateLimit = await rateLimiters.chat.check(`chat:${user.id}`)
  if (!rateLimit.success) {
    return Response.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(rateLimit.reset),
        },
      }
    )
  }

  const {
    messages: rawMessages,
    provider, model, endpoint, agentRole,
    team_id, team_type,
    panel_id, session_id,
    project_id, workspace_id,
    otherPanelsSnapshot,
    webSearchEnabled,
  } = await req.json() as {
    messages:              ChatMessage[]
    provider:              string
    model:                 string
    endpoint?:             string
    agentRole?:            string
    team_id?:              string | null
    workspace_id?:         string | null
    team_type?:            string | null
    panel_id?:             string | null
    session_id?:           string | null
    project_id?:           string | null
    otherPanelsSnapshot?:  PanelSnapshot[]
    webSearchEnabled?:     boolean
  }

  // ── Capa 1: Role system prompt ──────────────────────────────────────────────
  const rolePromptParts: ChatMessage[] = []
  if (agentRole) {
    const systemPrompt = await getSystemPrompt(agentRole)
    if (systemPrompt) {
      rolePromptParts.push(
        { role: 'user',      content: systemPrompt },
        { role: 'assistant', content: 'Understood.' },
      )
    }
  }

  // ── Capa 2: Web search availability instruction (solo si webSearchEnabled) ────
  const webSearchInstructionParts: ChatMessage[] = []
  if (webSearchEnabled) {
    webSearchInstructionParts.push(
      {
        role: 'user',
        content:
          'Web search access is a hard external switch controlled by the user for security reasons you cannot see. ' +
          'Its state may change between messages in this same conversation. ' +
          'It is currently ENABLED for this message. ' +
          'Never assume it is unavailable based on what you said in earlier turns — if the tool is offered to you now, use it whenever the user\'s request needs current, factual, or up-to-date information. ' +
          'Do not decline to search just because you previously said you could not.',
      },
      { role: 'assistant', content: 'Understood.' },
    )
  }

  // ── Capa 3: Team system prompt from Supabase (tolerant — table may not have team_id column yet) ──
  const teamPromptParts: ChatMessage[] = []
  if (team_id) {
    try {
      const { data: tp } = await supabase
        .from('system_prompts')
        .select('role_prompt')
        .eq('team_id', team_id)
        .eq('is_active', true)
        .maybeSingle()
      if (tp?.role_prompt) {
        teamPromptParts.push(
          { role: 'user',      content: tp.role_prompt },
          { role: 'assistant', content: 'Understood.' },
        )
      }
    } catch {
      // no team prompt available — continue without breaking
    }
  }

  // ── Capa: Prompt Library — Team prompts first, Worker prompts after ─────────
  // Orden de precedencia: Team Prompt → Worker Prompt (Worker prevalece en su ámbito).
  const promptLibraryParts: ChatMessage[] = []
  try {
    const { teamPrompts, workerPrompts } = await listActivePromptsForContext({
      teamId:    team_id,
      sessionId: session_id,
      agentRole: panel_id,
    })

    if (teamPrompts.length > 0) {
      const content = [
        'Active Team Prompts from Prompt Library:',
        ...teamPrompts.map(p => `[Title: ${p.title} | Version: ${p.version}]\n${p.body}`),
      ].join('\n\n')
      promptLibraryParts.push(
        { role: 'user',      content },
        { role: 'assistant', content: 'Understood.' },
      )
    }

    if (workerPrompts.length > 0) {
      const content = [
        'Active Worker Prompts from Prompt Library:',
        ...workerPrompts.map(p => `[Title: ${p.title} | Version: ${p.version}]\n${p.body}`),
      ].join('\n\n')
      promptLibraryParts.push(
        { role: 'user',      content },
        { role: 'assistant', content: 'Understood.' },
      )
    }
  } catch { /* prompt library unavailable — continue without breaking */ }

  // ── Capa: Context Files — Project → Team → Session (material factual/documental) ─
  const contextFilesParts: ChatMessage[] = []
  try {
    const contextSources = await getContextSourcesForRuntime({
      projectId:  project_id  ?? null,
      teamId:     team_id     ?? null,
      sessionId:  session_id  ?? null,
    })

    if (contextSources.length > 0) {
      const lines = contextSources.map(s => {
        const scopeLabel = s.scope === 'project' ? 'Project Context'
          : s.scope === 'team' ? 'Team Context'
          : 'Session Context'
        return `[${scopeLabel}] Title: ${s.title}\nContent: ${truncateContextText(s.content_text ?? '')}`
      }).join('\n\n')

      contextFilesParts.push(
        { role: 'user',      content: `Context files available to this agent:\n\n${lines}` },
        { role: 'assistant', content: 'Understood. I have reviewed the context files.' },
      )
    }
  } catch { /* context files unavailable — continue without breaking */ }

  // ── Capa 4: Snapshot of other panels (SAT only — MAT left isolated by default) ──
  const snapshotParts: ChatMessage[] = []
  const snapshot = otherPanelsSnapshot ?? []
  if (team_type === 'SAT' && snapshot.length > 0) {
    const lines = snapshot
      .filter(p => p.lastMessages?.length > 0)
      .map(p => {
        const msgs = p.lastMessages
          .map(m => `  ${m.role === 'user' ? 'User' : p.role}: ${m.content.slice(0, 400)}`)
          .join('\n')
        return `${p.role}:\n${msgs}`
      })
      .join('\n\n')

    if (lines) {
      snapshotParts.push(
        { role: 'user',      content: `Current state of other team agents:\n\n${lines}` },
        { role: 'assistant', content: 'Understood. I have the current context of my team.' },
      )
    }
  }

  // ── Assemble final message array (order: role → web search instruction → team → prompt library → context files → snapshot → history) ──
  const messages: ChatMessage[] = [
    ...rolePromptParts,
    ...webSearchInstructionParts,
    ...teamPromptParts,
    ...promptLibraryParts,
    ...contextFilesParts,
    ...snapshotParts,
    ...rawMessages,
  ]

  // ── Trazar adjuntos — awaited via Promise.allSettled (serverless-safe) ────────
  const attachmentMessages = rawMessages.filter((m: ChatMessage) => m.attachments?.length)
  if (attachmentMessages.length && session_id && workspace_id && user) {
    const attachmentRows = attachmentMessages.flatMap((m: ChatMessage) =>
      (m.attachments ?? []).map(att => ({
        session_id,
        workspace_id,
        account_id:      user.id,
        filename:        att.name ?? 'unknown',
        mime_type:       att.media_type,
        attachment_type: att.type,
        provider,
        status: 'processed',
      }))
    )
    const auditAttachmentInserts = attachmentMessages.flatMap((m: ChatMessage) =>
      (m.attachments ?? []).map(att =>
        supabase.from('audit_log').insert({
          account_id:   user.id,
          workspace_id: workspace_id ?? null,
          event_type:   'attachment_uploaded',
          metadata: {
            filename:        att.name ?? 'unknown',
            mime_type:       att.media_type,
            attachment_type: att.type,
            provider,
          },
        })
      )
    )
    await Promise.allSettled([
      supabase.from('session_attachments').insert(attachmentRows),
      ...auditAttachmentInserts,
    ])
  }

  try {
    // ── IA Local ──────────────────────────────────────────────────────────────
    if (provider === 'IA Local') {
      const stream = await new LocalProvider(endpoint ?? 'http://localhost:11434/v1').stream(messages, model)
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // ── Resolución de API key — fuente única (ARC-001) ────────────────────────
    const resolved = await resolveProviderApiKey(supabase, user.id, provider)

    if (!resolved) {
      return Response.json(
        {
          error: KNOWN_PROVIDERS.has(provider)
            ? `No API key configured for ${provider}. Add your key in Settings → Providers.`
            : `Provider "${provider}" not found. Configure it in Settings → Custom Providers.`,
        },
        { status: 400 }
      )
    }

    // ── Provider personalizado ────────────────────────────────────────────────
    if (resolved.isCustom) {
      const stream = await new LocalProvider(resolved.endpointUrl, resolved.apiKey ?? undefined).stream(messages, model)
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    const providerInstance = getProvider(provider, { apiKey: resolved.apiKey })
    const anthropicProvider = provider === 'Anthropic' ? providerInstance as AnthropicProvider : null
    const openaiProvider    = provider === 'OpenAI'    ? providerInstance as OpenAIProvider    : null
    const groqProvider      = provider === 'Groq'      ? providerInstance as GroqProvider      : null
    const googleProvider    = provider === 'Google'    ? providerInstance as GoogleProvider    : null

    const persistUsage = async (usage: TokenUsage, captureMethod: string) => {
      try {
        await supabase.from('token_usage').insert({
          account_id:     user.id,
          workspace_id:   workspace_id   ?? null,
          session_id:     session_id     ?? null,
          provider:       usage.provider,
          model:          usage.model,
          input_tokens:   usage.input_tokens,
          output_tokens:  usage.output_tokens,
          total_tokens:   usage.total_tokens,
          capture_method: captureMethod,
        })
      } catch (error) {
        console.error('[token_usage] failed to persist usage', error)
      }
    }

    const streamUsageOpts   = { onUsage: (u: TokenUsage) => persistUsage(u, 'stream_final') }
    const completeUsageOpts = { onUsage: (u: TokenUsage) => persistUsage(u, 'response_usage') }

    // ── Tool loop (opt-in via webSearchEnabled) ───────────────────────────────
    if (webSearchEnabled && providerInstance.complete) {
      const first = anthropicProvider
        ? await anthropicProvider.complete(messages, model, [webSearchTool.definition], completeUsageOpts)
        : openaiProvider
        ? await openaiProvider.complete(messages, model, [webSearchTool.definition], completeUsageOpts)
        : googleProvider
        ? await googleProvider.complete(messages, model, [webSearchTool.definition], completeUsageOpts)
        : await providerInstance.complete!(messages, model, [webSearchTool.definition])

      if (first.toolCalls?.length) {
        const toolResults: ToolResult[] = []

        for (const call of first.toolCalls) {
          const tool = getTool(call.name)
          if (!tool) {
            toolResults.push({ tool_call_id: call.id, content: `Tool not found: ${call.name}` })
            continue
          }
          try {
            const toolResult = await tool.execute(call.input)
            const content    = toolResult.content
            const toolSources = toolResult.sources ?? []
            toolResults.push({ tool_call_id: call.id, content })
            // awaited via Promise.allSettled (serverless-safe)
            if (session_id && workspace_id && user) {
              await Promise.allSettled([
                supabase.from('session_tool_calls').insert({
                  session_id,
                  workspace_id,
                  account_id:     user.id,
                  tool_name:      call.name,
                  query:          (call.input.query as string) ?? null,
                  provider,
                  model,
                  result_summary: content.slice(0, 500),
                  sources:        toolSources,
                }),
                supabase.from('audit_log').insert({
                  account_id:   user.id,
                  workspace_id: workspace_id ?? null,
                  event_type:   'tool_call_executed',
                  metadata: {
                    tool_name: call.name,
                    query:     (call.input.query as string) ?? null,
                    provider,
                    model,
                    sources:   toolSources,
                  },
                }),
              ])
            }
          } catch (error) {
            toolResults.push({
              tool_call_id: call.id,
              content: error instanceof Error ? error.message : 'Tool execution failed',
            })
          }
        }

        const messagesWithToolResults: ChatMessage[] = [
          ...messages,
          { role: 'assistant', content: first.content || '[Tool requested]' },
          {
            role: 'user',
            content: toolResults
              .map(r => `Tool result (${r.tool_call_id}):\n${r.content}`)
              .join('\n\n---\n\n'),
          },
        ]

        const toolStream = anthropicProvider
          ? await anthropicProvider.stream(messagesWithToolResults, model, streamUsageOpts)
          : openaiProvider
          ? await openaiProvider.stream(messagesWithToolResults, model, streamUsageOpts)
          : groqProvider
          ? await groqProvider.stream(messagesWithToolResults, model, streamUsageOpts)
          : googleProvider
          ? await googleProvider.stream(messagesWithToolResults, model, streamUsageOpts)
          : await providerInstance.stream(messagesWithToolResults, model)
        return new Response(toolStream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }

      // No tool calls — return first.content directly as stream
      const encoder = new TextEncoder()
      const directStream = new ReadableStream({
        start(controller) {
          if (first.content) controller.enqueue(encoder.encode(first.content))
          controller.close()
        },
      })
      return new Response(directStream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // ── Direct stream (default, no tools) ────────────────────────────────────
    const stream = anthropicProvider
      ? await anthropicProvider.stream(messages, model, streamUsageOpts)
      : openaiProvider
      ? await openaiProvider.stream(messages, model, streamUsageOpts)
      : groqProvider
      ? await groqProvider.stream(messages, model, streamUsageOpts)
      : googleProvider
      ? await googleProvider.stream(messages, model, streamUsageOpts)
      : await providerInstance.stream(messages, model)
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error del provider'
    return Response.json({ error: message }, { status: 500 })
  }
}

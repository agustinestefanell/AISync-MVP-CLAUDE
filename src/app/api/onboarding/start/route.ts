import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface OnboardingPayload {
  initialIntent: string
  projectName?: string
  teamName?: string
}

function computeType(agents: Array<{ provider: string }>): 'SAT' | 'MAT' {
  const providers = new Set(agents.map((a) => a.provider))
  return providers.size === 1 ? 'SAT' : 'MAT'
}

export async function POST(req: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { initialIntent, projectName, teamName }: OnboardingPayload = await req.json()

  if (!initialIntent?.trim()) {
    return NextResponse.json(
      { error: 'Initial intent is required.' },
      { status: 400 }
    )
  }

  const finalProjectName = projectName?.trim() || 'My First Project'
  const finalTeamName = teamName?.trim() || 'My First Team'

  // ── Step 1: Verificar API key ────────────────────────────────────────────
  const { data: keys } = await supabase
    .from('user_api_keys')
    .select('provider, key_last4, api_key, vault_secret_id')
    .eq('account_id', user.id)
    .limit(1)

  if (!keys || keys.length === 0) {
    return NextResponse.json(
      {
        error:
          'No API key configured. Add your key in Settings → Providers.',
      },
      { status: 400 }
    )
  }

  const defaultProvider = keys[0].provider
  const defaultModel =
    defaultProvider === 'Anthropic'
      ? 'claude-3-5-sonnet-20241022'
      : defaultProvider === 'OpenAI'
      ? 'gpt-4o'
      : defaultProvider === 'Google'
      ? 'gemini-2.0-flash'
      : defaultProvider === 'Groq'
      ? 'llama-3.3-70b-versatile'
      : 'claude-3-5-sonnet-20241022'

  let projectId: string | undefined
  let teamId: string | undefined
  let workspaceId: string | undefined

  try {
    // ── Step 2: Crear Project ────────────────────────────────────────────
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: finalProjectName,
        account_id: user.id,
        status: 'active',
      })
      .select('id')
      .single()

    if (projectError || !project) {
      console.error('[onboarding/start] failed to create project', projectError)
      return NextResponse.json(
        { error: 'Failed to create project.' },
        { status: 500 }
      )
    }

    projectId = project.id

    // ── Step 3: Actualizar active_project_id ─────────────────────────────
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ active_project_id: projectId })
      .eq('id', user.id)

    if (updateError) {
      console.error(
        '[onboarding/start] failed to update active_project_id',
        updateError
      )
      // No bloqueante — continuar
    }

    // ── Step 4: Crear Team SAT ───────────────────────────────────────────
    const agents = [
      { role: 'manager', provider: defaultProvider, model: defaultModel },
      { role: 'worker1', provider: defaultProvider, model: defaultModel },
      { role: 'worker2', provider: defaultProvider, model: defaultModel },
    ]

    const teamType = computeType(agents)

    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .insert({
        project_id: projectId,
        name: finalTeamName,
        type: teamType,
        parent_id: null,
      })
      .select('id')
      .single()

    if (teamErr || !team) {
      console.error('[onboarding/start] failed to create team', teamErr)
      // Rollback: eliminar project
      await supabase.from('projects').delete().eq('id', projectId)
      return NextResponse.json(
        { error: 'Failed to create team.' },
        { status: 500 }
      )
    }

    teamId = team.id

    // ── Step 5: Crear Workspace ──────────────────────────────────────────
    const { data: workspace, error: wsErr } = await supabase
      .from('workspaces')
      .insert({
        team_id: teamId,
        name: 'Main Workspace',
        lock_state: 'unlocked',
      })
      .select('id')
      .single()

    if (wsErr || !workspace) {
      console.error('[onboarding/start] failed to create workspace', wsErr)
      // Rollback: eliminar team y project
      await supabase.from('teams').delete().eq('id', teamId)
      await supabase.from('projects').delete().eq('id', projectId)
      return NextResponse.json(
        { error: 'Failed to create workspace.' },
        { status: 500 }
      )
    }

    workspaceId = workspace.id

    // ── Step 6: Crear 3 agent sessions ───────────────────────────────────
    const { error: agentsErr } = await supabase.from('agent_sessions').insert(
      agents.map((a) => ({
        workspace_id: workspaceId,
        agent_role: a.role,
        provider: a.provider,
        model: a.model,
        config: null,
      }))
    )

    if (agentsErr) {
      console.error(
        '[onboarding/start] failed to create agent_sessions',
        agentsErr
      )
      // Rollback: eliminar workspace, team y project
      await supabase.from('workspaces').delete().eq('id', workspaceId)
      await supabase.from('teams').delete().eq('id', teamId)
      await supabase.from('projects').delete().eq('id', projectId)
      return NextResponse.json(
        { error: 'Failed to create agent sessions.' },
        { status: 500 }
      )
    }

    // ── Step 7: Marcar onboarding completado ─────────────────────────────
    const { error: completeErr } = await supabase
      .from('accounts')
      .update({ onboarding_completed: true })
      .eq('id', user.id)

    if (completeErr) {
      console.error(
        '[onboarding/start] failed to mark onboarding_completed',
        completeErr
      )
      // No bloqueante — la estructura ya está creada, el usuario puede entrar
    }

    return NextResponse.json({ workspaceId })
  } catch (error) {
    console.error('[onboarding/start] unexpected error', error)

    // Rollback best-effort
    if (workspaceId) {
      await supabase.from('workspaces').delete().eq('id', workspaceId)
    }
    if (teamId) {
      await supabase.from('teams').delete().eq('id', teamId)
    }
    if (projectId) {
      await supabase.from('projects').delete().eq('id', projectId)
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

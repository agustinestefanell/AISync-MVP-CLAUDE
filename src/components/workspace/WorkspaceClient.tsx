'use client'

import { useState } from 'react'
import TopRibbon from '@/components/layout/TopRibbon'
import BottomRibbon from '@/components/layout/BottomRibbon'
import WorkspaceShell from './WorkspaceShell'
import TokenUsageBadge from './TokenUsageBadge'
import WelcomeScreen from './WelcomeScreen'
import type { WorkspaceWithAgents, Message, HumanMessage } from '@/lib/db/types'

const WORKSPACE_GUIDE = `First of all, Workspace is where you chat with AI. It is one of the two core sides of AISync: operational work. This is the place where you talk to an AI the way you normally do, but inside a more organized system.

We recommend this basic setup: use one Manager session to think, organize, plan, and keep the main direction clear. Use the other sessions as Workers and give them concrete or parallel tasks. Use one team per specific topic. If the work or investigation grows, create more teams. Keep each team focused on one subject, and use one agent per task or area whenever possible. Always keep the main checklist, base logic, and overall coherence in one main Manager. Do not distract that Manager with execution tasks.

Communication tools inside the team
→ User → Agent: write and press Send
→ Agent → Agent: select a message and use Review & Forward
→ Manager of one team → Manager of another team: same logic, using Review & Forward

Traceability and saving tools
→ Save Version: save an important point of the work
→ Save Selection: save only one useful part of the conversation
→ Create Handoff Package: create a formal transfer package for continuity
→ Refresh Session: reset the AI agent without losing the visible chat
→ Audit AI Answer: reserved for answer verification flows (coming soon)

Top ribbon
→ Prompt Library: change how the agent works
→ Add Context File: give the agent documents or source material to work with

In simple terms: use the Manager to think and coordinate, use the Workers to execute, and use the save tools whenever something becomes important enough to preserve, transfer, or revisit later.`

interface WelcomeMetadata {
  connectionId:       string
  requesterEmail:     string
  requesterTeamName:  string
  description?:       string
  color?:             string
}

interface ConnectionContext {
  connectionId:   string
  isHost:         boolean
  otherUserEmail: string
  otherUserName?: string
}

interface Props {
  pageName:             string
  accentColor?:         string
  badge?:               string
  workspace:            WorkspaceWithAgents
  initialMessages:      Record<string, Message[]>
  initialCheckpointId?: string
  prefillMessage?:      string
  userEmail?:           string
  welcomeMetadata?:     WelcomeMetadata
  connectionContext?:   ConnectionContext
  initialHumanMessages?: HumanMessage[]
  currentUserId?:       string
}

export default function WorkspaceClient({ pageName, accentColor, badge, workspace, initialMessages, initialCheckpointId, prefillMessage, userEmail, welcomeMetadata, connectionContext, initialHumanMessages, currentUserId }: Props) {
  const [showMainGuide, setShowMainGuide] = useState(false)
  const [showWelcome, setShowWelcome] = useState(!!welcomeMetadata)

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-app-bg)' }}>
      <TopRibbon
        pageName={pageName}
        pageSubtitle="How to work in Workspace"
        pageSubtitleOnClick={() => setShowMainGuide(true)}
        accentColor={accentColor}
        badge={badge}
        rightBadge={<TokenUsageBadge workspaceId={workspace.id} />}
        userName={userEmail}
      />

      <main className="flex-1 overflow-hidden min-h-0 flex flex-col">
        <WorkspaceShell
          workspace={workspace}
          initialMessages={initialMessages}
          initialCheckpointId={initialCheckpointId}
          prefillMessage={prefillMessage}
          connectionContext={connectionContext}
          initialHumanMessages={initialHumanMessages ?? []}
          currentUserId={currentUserId ?? ''}
        />
      </main>

      <BottomRibbon accentColor={accentColor} />

      {/* Main guide modal */}
      {showMainGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowMainGuide(false) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--color-border-default)] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  How to work in Workspace
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Operational guidance</p>
              </div>
              <button
                onClick={() => setShowMainGuide(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-1 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {WORKSPACE_GUIDE}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Welcome screen for Connected Teams invitee */}
      {showWelcome && welcomeMetadata && (
        <WelcomeScreen
          connectionId={welcomeMetadata.connectionId}
          requesterEmail={welcomeMetadata.requesterEmail}
          requesterTeamName={welcomeMetadata.requesterTeamName}
          description={welcomeMetadata.description}
          color={welcomeMetadata.color}
          onClose={() => setShowWelcome(false)}
        />
      )}
    </div>
  )
}

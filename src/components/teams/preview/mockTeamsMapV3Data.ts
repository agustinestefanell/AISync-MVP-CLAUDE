// Mock data for Teams Map v3 Preview - 2 scenarios (Minimum, Normal)
// Product rule: a Manager or Submanager can have at most 2 Workers.
// Stress scenarios must scale by number of Teams/Subteams, not by Workers per Manager.

export interface MockWorker {
  id: string
  label: string      // Fixed structural label - always 'WORKER'
  code: string       // Display code - 'W1', 'W2', etc.
  name: string       // Editable name - 'Worker 1', 'Data Entry Assistant', etc.
  agent_role: 'worker1' | 'worker2' | 'worker3'
}

export interface MockSubteam {
  id: string
  code: string
  name: string
  role: 'submanager'
  provider: string
  model: string
  color: string
  subteams: MockSubteam[]
  workers: MockWorker[]
}

export interface MockTeam {
  id: string
  code: string
  name: string
  role: 'manager'
  provider: string
  model: string
  color: string
  type?: 'SAT' | 'MAT' | 'isolated'
  subteams: MockSubteam[]
  workers: MockWorker[]
  // Fields for connected/shared teams
  connectionRole?: 'host' | 'invitee'
  partnerEmail?: string
  partnerOrg?: string
}

export interface MockProject {
  id: string
  name: string
  teams: MockTeam[]
  connectedTeams?: MockTeam[]
}

// Minimum case: 1 Project, 1 Team sin Subteams y sin Workers
export const MINIMUM_CASE: MockProject[] = [
  {
    id: 'P-MIN',
    name: 'Minimum Project',
    teams: [
      {
        id: 'T-MIN-01',
        code: 'T-01',
        name: 'Single Team',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#8E4CC6',
        type: 'SAT',
        subteams: [],
        workers: [],
      },
    ],
  },
]

// Normal case: 3 Projects, cada uno con 2-4 Teams; algunos con 1-2 Subteams
export const NORMAL_CASE: MockProject[] = [
  {
    id: 'P-01',
    name: 'Client Strategy',
    teams: [
      {
        id: 'T-01',
        code: 'CS-01',
        name: 'Account Planning',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#8E4CC6',
        type: 'SAT',
        subteams: [
          {
            id: 'ST-01-01',
            code: 'CS-01-A',
            name: 'Q4 Business Planning',
            role: 'submanager',
            provider: 'Anthropic',
            model: 'Claude Sonnet',
            color: '#A67DCE',
            subteams: [],
            workers: [
              {
                id: 'W-ST-01-01',
                label: 'WORKER',
                code: 'W1',
                name: 'Worker 1',
                agent_role: 'worker1',
              },
              {
                id: 'W-ST-01-02',
                label: 'WORKER',
                code: 'W2',
                name: 'Worker 2',
                agent_role: 'worker2',
              },
            ],
          },
        ],
        workers: [
          {
            id: 'W-01-01',
            label: 'WORKER',
            code: 'W1',
            name: 'Worker 1',
            agent_role: 'worker1',
          },
          {
            id: 'W-01-02',
            label: 'WORKER',
            code: 'W2',
            name: 'Worker 2',
            agent_role: 'worker2',
          },
        ],
      },
      {
        id: 'T-02',
        code: 'CS-02',
        name: 'Stakeholder Mapping',
        role: 'manager',
        provider: 'OpenAI',
        model: 'GPT-5.5',
        color: '#2F78C4',
        type: 'SAT',
        subteams: [],
        workers: [
          {
            id: 'W-02-01',
            label: 'WORKER',
            code: 'W1',
            name: 'Worker 1',
            agent_role: 'worker1',
          },
        ],
      },
      {
        id: 'T-03',
        code: 'CS-03',
        name: 'Forecasting',
        role: 'manager',
        provider: 'Google',
        model: 'Gemini 3.5 Flash',
        color: '#2F9C5B',
        type: 'SAT',
        subteams: [
          {
            id: 'ST-03-01',
            code: 'CS-03-A',
            name: 'Revenue Model',
            role: 'submanager',
            provider: 'Google',
            model: 'Gemini 3.5 Flash',
            color: '#5DB87F',
            subteams: [],
            workers: [
              {
                id: 'W-ST-03-01',
                label: 'WORKER',
                code: 'W1',
                name: 'Worker 1',
                agent_role: 'worker1',
              },
            ],
          },
        ],
        workers: [
          {
            id: 'W-03-01',
            label: 'WORKER',
            code: 'W1',
            name: 'Worker 1',
            agent_role: 'worker1',
          },
        ],
      },
    ],
    connectedTeams: [
      {
        id: 'CT-01',
        code: 'SH-01',
        name: 'Shared: External Partner Alpha',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#64748B',
        type: 'isolated',
        subteams: [],
        workers: [],
        connectionRole: 'host',
        partnerEmail: 'partner@acmecorp.com',
        partnerOrg: 'Acme Corp',
      },
    ],
  },
  {
    id: 'P-02',
    name: 'Product Development',
    teams: [
      {
        id: 'T-04',
        code: 'PD-01',
        name: 'Feature Design',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#E66A00',
        type: 'SAT',
        subteams: [
          {
            id: 'ST-04-01',
            code: 'PD-01-A',
            name: 'UI Research',
            role: 'submanager',
            provider: 'Anthropic',
            model: 'Claude Sonnet',
            color: '#F28E33',
            subteams: [],
            workers: [
              {
                id: 'W-ST-04-01',
                label: 'WORKER',
                code: 'W1',
                name: 'Worker 1',
                agent_role: 'worker1',
              },
            ],
          },
          {
            id: 'ST-04-02',
            code: 'PD-01-B',
            name: 'Prototyping',
            role: 'submanager',
            provider: 'Anthropic',
            model: 'Claude Sonnet',
            color: '#F28E33',
            subteams: [],
            workers: [
              {
                id: 'W-ST-04-02',
                label: 'WORKER',
                code: 'W1',
                name: 'Worker 1',
                agent_role: 'worker1',
              },
              {
                id: 'W-ST-04-03',
                label: 'WORKER',
                code: 'W2',
                name: 'Worker 2',
                agent_role: 'worker2',
              },
            ],
          },
        ],
        workers: [
          {
            id: 'W-04-01',
            label: 'WORKER',
            code: 'W1',
            name: 'Worker 1',
            agent_role: 'worker1',
          },
          {
            id: 'W-04-02',
            label: 'WORKER',
            code: 'W2',
            name: 'Worker 2',
            agent_role: 'worker2',
          },
        ],
      },
      {
        id: 'T-05',
        code: 'PD-02',
        name: 'Engineering',
        role: 'manager',
        provider: 'OpenAI',
        model: 'GPT-5.5',
        color: '#D62E68',
        type: 'MAT',
        subteams: [],
        workers: [
          {
            id: 'W-05-01',
            label: 'WORKER',
            code: 'W1',
            name: 'Worker 1',
            agent_role: 'worker1',
          },
        ],
      },
      {
        id: 'T-06',
        code: 'PD-03',
        name: 'QA Testing',
        role: 'manager',
        provider: 'Google',
        model: 'Gemini 3.5 Flash',
        color: '#76B7B2',
        type: 'SAT',
        subteams: [
          {
            id: 'ST-06-01',
            code: 'PD-03-A',
            name: 'Automated Tests',
            role: 'submanager',
            provider: 'Google',
            model: 'Gemini 3.5 Flash',
            color: '#9DCDC9',
            subteams: [],
            workers: [
              {
                id: 'W-ST-06-01',
                label: 'WORKER',
                code: 'W1',
                name: 'Worker 1',
                agent_role: 'worker1',
              },
            ],
          },
        ],
        workers: [
          {
            id: 'W-06-01',
            label: 'WORKER',
            code: 'W1',
            name: 'Worker 1',
            agent_role: 'worker1',
          },
        ],
      },
      {
        id: 'T-07',
        code: 'PD-04',
        name: 'Documentation',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#59A14F',
        type: 'SAT',
        subteams: [],
        workers: [],
      },
    ],
  },
  {
    id: 'P-03',
    name: 'Research Ops',
    teams: [
      {
        id: 'T-08',
        code: 'RO-01',
        name: 'Data Collection',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#EDC948',
        type: 'SAT',
        subteams: [
          {
            id: 'ST-08-01',
            code: 'RO-01-A',
            name: 'Survey Design',
            role: 'submanager',
            provider: 'Anthropic',
            model: 'Claude Sonnet',
            color: '#F4DC7A',
            subteams: [],
            workers: [
              {
                id: 'W-ST-08-01',
                label: 'WORKER',
                code: 'W1',
                name: 'Worker 1',
                agent_role: 'worker1',
              },
            ],
          },
        ],
        workers: [
          {
            id: 'W-08-01',
            label: 'WORKER',
            code: 'W1',
            name: 'Worker 1',
            agent_role: 'worker1',
          },
        ],
      },
      {
        id: 'T-09',
        code: 'RO-02',
        name: 'Analysis',
        role: 'manager',
        provider: 'OpenAI',
        model: 'GPT-5.5',
        color: '#B07AA1',
        type: 'SAT',
        subteams: [],
        workers: [],
      },
    ],
  },
]

// Stress case removed - violates max 2 workers per Manager/Submanager rule
// Empty case removed - does not add value after validating Minimum and Normal

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _STRESS_CASE_REMOVED: MockProject[] = [
  {
    id: 'P-STRESS',
    name: 'Dense Operations Project',
    teams: [
      {
        id: 'T-S01',
        code: 'DO-01',
        name: 'Operations Management',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#8E4CC6',
        type: 'SAT',
        subteams: [],
        workers: [],
      },
      {
        id: 'T-S02',
        code: 'DO-02',
        name: 'Supply Chain',
        role: 'manager',
        provider: 'OpenAI',
        model: 'GPT-5.5',
        color: '#2F78C4',
        type: 'SAT',
        subteams: [
          {
            id: 'ST-S02-01',
            code: 'DO-02-A',
            name: 'Procurement',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#5B9FDB',
            subteams: [],
            workers: [],
          },
          {
            id: 'ST-S02-02',
            code: 'DO-02-B',
            name: 'Logistics',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#5B9FDB',
            subteams: [],
            workers: [],
          },
          {
            id: 'ST-S02-03',
            code: 'DO-02-C',
            name: 'Warehousing',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#5B9FDB',
            subteams: [],
            workers: [],
          },
        ],
        workers: [],
      },
      {
        id: 'T-S03',
        code: 'DO-03',
        name: 'Customer Support',
        role: 'manager',
        provider: 'Google',
        model: 'Gemini 3.5 Flash',
        color: '#2F9C5B',
        type: 'SAT',
        subteams: [],
        workers: [],
      },
      {
        id: 'T-S04',
        code: 'DO-04',
        name: 'Quality Assurance',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#E66A00',
        type: 'SAT',
        subteams: [],
        workers: [],
      },
      {
        id: 'T-S05',
        code: 'DO-05',
        name: 'Production Planning',
        role: 'manager',
        provider: 'OpenAI',
        model: 'GPT-5.5',
        color: '#D62E68',
        type: 'MAT',
        subteams: [
          {
            id: 'ST-S05-01',
            code: 'DO-05-A',
            name: 'Scheduling',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#E75E8F',
            subteams: [],
            workers: [],
          },
          {
            id: 'ST-S05-02',
            code: 'DO-05-B',
            name: 'Capacity',
            role: 'submanager',
            provider: 'Anthropic',
            model: 'Claude Sonnet',
            color: '#E75E8F',
            subteams: [],
            workers: [],
          },
          {
            id: 'ST-S05-03',
            code: 'DO-05-C',
            name: 'Resource Allocation',
            role: 'submanager',
            provider: 'Google',
            model: 'Gemini 3.5 Flash',
            color: '#E75E8F',
            subteams: [],
            workers: [],
          },
          {
            id: 'ST-S05-04',
            code: 'DO-05-D',
            name: 'Optimization',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#E75E8F',
            subteams: [],
            workers: [],
          },
        ],
        workers: [
          {
            label: 'WORKER',
            id: 'W-S05-01',
            code: 'W1',
            name: 'Worker 1',
            agent_role: 'worker1',
          },
          {
            label: 'WORKER',
            id: 'W-S05-02',
            code: 'W2',
            name: 'Worker 2',
            agent_role: 'worker2',
          },
          {
            label: 'WORKER',
            id: 'W-S05-03',
            code: 'W3',
            name: 'Worker 3',
            agent_role: 'worker3',
          },
          {
            label: 'WORKER',
            id: 'W-S05-04',
            code: 'W4',
            name: 'Worker 4',
            agent_role: 'worker1',
          },
          {
            label: 'WORKER',
            id: 'W-S05-05',
            code: 'W5',
            name: 'Worker 5',
            agent_role: 'worker2',
          },
          {
            label: 'WORKER',
            id: 'W-S05-06',
            code: 'W6',
            name: 'Worker 6',
            agent_role: 'worker3',
          },
          {
            label: 'WORKER',
            id: 'W-S05-07',
            code: 'W7',
            name: 'Worker 7',
            agent_role: 'worker1',
          },
          {
            label: 'WORKER',
            id: 'W-S05-08',
            code: 'W8',
            name: 'Worker 8',
            agent_role: 'worker2',
          },
          {
            label: 'WORKER',
            id: 'W-S05-09',
            code: 'W9',
            name: 'Worker 9',
            agent_role: 'worker3',
          },
          {
            label: 'WORKER',
            id: 'W-S05-10',
            code: 'W10',
            name: 'Worker 10',
            agent_role: 'worker1',
          },
          {
            label: 'WORKER',
            id: 'W-S05-11',
            code: 'W11',
            name: 'Worker 11',
            agent_role: 'worker2',
          },
          {
            label: 'WORKER',
            id: 'W-S05-12',
            code: 'W12',
            name: 'Worker 12',
            agent_role: 'worker3',
          },
        ],
      },
      {
        id: 'T-S06',
        code: 'DO-06',
        name: 'Safety & Compliance',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#76B7B2',
        type: 'SAT',
        subteams: [],
        workers: [],
      },
      {
        id: 'T-S07',
        code: 'DO-07',
        name: 'Maintenance',
        role: 'manager',
        provider: 'Google',
        model: 'Gemini 3.5 Flash',
        color: '#59A14F',
        type: 'SAT',
        subteams: [],
        workers: [],
      },
      {
        id: 'T-S08',
        code: 'DO-08',
        name: 'Inventory Control',
        role: 'manager',
        provider: 'OpenAI',
        model: 'GPT-5.5',
        color: '#EDC948',
        type: 'SAT',
        subteams: [
          {
            id: 'ST-S08-01',
            code: 'DO-08-A',
            name: 'Stock Tracking',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#F4DC7A',
            subteams: [],
            workers: [],
          },
          {
            id: 'ST-S08-02',
            code: 'DO-08-B',
            name: 'Ordering',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#F4DC7A',
            subteams: [],
            workers: [],
          },
          {
            id: 'ST-S08-03',
            code: 'DO-08-C',
            name: 'Auditing',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#F4DC7A',
            subteams: [],
            workers: [],
          },
          {
            id: 'ST-S08-04',
            code: 'DO-08-D',
            name: 'Reporting',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#F4DC7A',
            subteams: [],
            workers: [],
          },
          {
            id: 'ST-S08-05',
            code: 'DO-08-E',
            name: 'Optimization',
            role: 'submanager',
            provider: 'OpenAI',
            model: 'GPT-5.5',
            color: '#F4DC7A',
            subteams: [],
            workers: [],
          },
        ],
        workers: [],
      },
      {
        id: 'T-S09',
        code: 'DO-09',
        name: 'Training & Development',
        role: 'manager',
        provider: 'Anthropic',
        model: 'Claude Sonnet',
        color: '#B07AA1',
        type: 'SAT',
        subteams: [],
        workers: [],
      },
    ],
  },
]

export const SCENARIOS = {
  minimum: MINIMUM_CASE,
  normal: NORMAL_CASE,
}

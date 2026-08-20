export interface DocumentationMirrorNode {
  id:        string
  kind:      'root' | 'folder' | 'team' | 'agent'
  label:     string
  path:      string
  roleLabel?: string
  // Solo poblado en nodos kind 'team' — id real del team (no el prefijo
  // "team:" del node.id), usado para abrir el panel de detalle por
  // Workspace (Structure View, 2026-08-20).
  teamId?:   string
  children:  DocumentationMirrorNode[]
}

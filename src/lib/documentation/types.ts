export interface DocumentationMirrorNode {
  id:        string
  kind:      'root' | 'folder' | 'team' | 'agent'
  label:     string
  path:      string
  roleLabel?: string
  children:  DocumentationMirrorNode[]
}

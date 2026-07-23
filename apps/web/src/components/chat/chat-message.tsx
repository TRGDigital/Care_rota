import type { Citation } from '@carerota/domain'
import { CitationChip } from './citation-chip'

type Props = {
  role:      'user' | 'assistant'
  content:   string
  citations?: Citation[]
}

export function ChatMessage({ role, content, citations = [] }: Props) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed">
          {content}
        </div>
        {citations.length > 0 && (
          <div className="flex flex-wrap gap-1 pl-1" role="list" aria-label="Citations">
            {citations.map((c, i) => (
              <div key={i} role="listitem">
                <CitationChip citation={c} index={i} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

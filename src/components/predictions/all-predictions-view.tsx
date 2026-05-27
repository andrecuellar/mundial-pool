import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type {
  AllPredictionsPick,
  AllPredictionsView as AllPredictionsViewData,
} from '@/features/predictions/queries'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '·'
  )
}

type Props = {
  view: AllPredictionsViewData
  currentUserId: string
}

export function AllPredictionsView({ view, currentUserId }: Props) {
  const { members, categories, picks } = view

  return (
    <div className="space-y-4">
      {members.map((m) => {
        const isMe = m.userId === currentUserId
        const memberPicks = picks.get(m.userId) ?? new Map()
        return (
          <Card key={m.userId} className={`overflow-hidden p-0 ${isMe ? 'border-primary/40' : ''}`}>
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-3">
              <Avatar className="h-9 w-9">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.displayName} />}
                <AvatarFallback className="text-xs">{initials(m.displayName)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">{m.displayName}</span>
                {isMe && (
                  <Badge
                    variant="secondary"
                    className="border-primary/20 bg-primary/10 text-primary"
                  >
                    Tú
                  </Badge>
                )}
              </div>
            </div>
            <ul className="divide-y divide-border">
              {categories.map((cat) => {
                const p = memberPicks.get(cat.id)
                return (
                  <li
                    key={cat.id}
                    className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <span className="min-w-0 text-muted-foreground">{cat.name}</span>
                    <span className="text-right text-foreground">{renderPick(p)}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}

function renderPick(p: AllPredictionsPick | undefined): React.ReactNode {
  if (!p || p.kind === 'empty') {
    return <span className="text-xs italic text-muted-foreground">No respondió</span>
  }
  if (p.kind === 'team') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span className="text-base leading-none">{p.teamFlag ?? '🏳️'}</span>
        <span>{p.teamName}</span>
      </span>
    )
  }
  if (p.kind === 'team_set') {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
        {p.teams.map((t) => (
          <span
            key={t.name}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs"
          >
            <span className="leading-none">{t.flag ?? '🏳️'}</span>
            <span className="font-medium">{t.name}</span>
          </span>
        ))}
      </span>
    )
  }
  if (p.kind === 'player') {
    return <span className="font-medium">{p.text}</span>
  }
  return null
}

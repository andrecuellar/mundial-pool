'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { setPreference } from '@/features/auth/notification-preferences'
import { NOTIFICATION_TYPES, type NotificationType } from '@/server/notifications/types'

type Props = {
  initial: Record<NotificationType, boolean>
}

export function NotificationPreferencesForm({ initial }: Props) {
  const [prefs, setPrefs] = useState(initial)
  const [, startTransition] = useTransition()

  function toggle(type: NotificationType, next: boolean) {
    // Optimistic: update local state immediately, revert on failure. Without
    // this the Switch lags 200-400ms behind the click while the server action
    // round-trips, which feels broken.
    setPrefs((p) => ({ ...p, [type]: next }))
    startTransition(async () => {
      const r = await setPreference(type, next)
      if (!r.ok) {
        setPrefs((p) => ({ ...p, [type]: !next }))
        toast.error(r.error)
        return
      }
      toast.success(next ? 'Activado' : 'Desactivado')
    })
  }

  return (
    <ul className="space-y-2">
      {NOTIFICATION_TYPES.map((t) => (
        <li key={t.key}>
          <Card className="flex items-start justify-between gap-4 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="text-2xl leading-none" aria-hidden>
                {t.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {t.description}
                </p>
              </div>
            </div>
            <Switch
              checked={prefs[t.key] ?? true}
              onCheckedChange={(v) => toggle(t.key, v)}
              aria-label={t.label}
            />
          </Card>
        </li>
      ))}
    </ul>
  )
}

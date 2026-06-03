'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  storageKey: string
  message: string
  children: React.ReactNode
}

export function CoachMark({ storageKey, message, children }: Props) {
  const [show, setShow] = useState(false)
  const fullKey = `mp:coach:${storageKey}`

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(fullKey)) return
    setShow(true)
  }, [fullKey])

  function dismiss() {
    setShow(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(fullKey, '1')
    }
  }

  return (
    <span className="relative inline-block">
      <span onClickCapture={dismiss}>{children}</span>
      {show && (
        <span
          role="status"
          className="animate-fade-up pointer-events-auto absolute left-1/2 top-full z-30 mt-2 flex w-max max-w-[14rem] -translate-x-1/2 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-foreground shadow-md backdrop-blur-sm"
        >
          <span
            aria-hidden
            className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-primary/40 bg-primary/10"
          />
          <span className="relative">{message}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              dismiss()
            }}
            aria-label="Descartar"
            className="relative -mr-1 grid h-4 w-4 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
    </span>
  )
}

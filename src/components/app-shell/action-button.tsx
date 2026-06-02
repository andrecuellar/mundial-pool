'use client'

import { Loader2 } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type ButtonProps = ComponentProps<typeof Button>

type Props = Omit<ButtonProps, 'children'> & {
  pending?: boolean
  /** What to show while pending. Defaults to `${children}…` when children is a string. */
  pendingLabel?: ReactNode
  children: ReactNode
}

// Drop-in replacement for <Button> in forms with `useTransition`. Shows a
// spinner and a pending label automatically — removes the `{pending ? '…' :
// 'Foo'}` boilerplate.
export function ActionButton({
  pending = false,
  pendingLabel,
  disabled,
  children,
  ...rest
}: Props) {
  const label = pending
    ? (pendingLabel ?? (typeof children === 'string' ? `${children}…` : children))
    : children

  return (
    <Button disabled={disabled || pending} aria-busy={pending} {...rest}>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {label}
    </Button>
  )
}

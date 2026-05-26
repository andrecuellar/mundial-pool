import { cn } from '@/lib/utils'

type Props = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: { text: 'text-base', dot: 'w-1.5 h-1.5 mx-0.5' },
  md: { text: 'text-xl', dot: 'w-2 h-2 mx-0.5' },
  lg: { text: 'text-3xl', dot: 'w-2.5 h-2.5 mx-1' },
}

export function Wordmark({ size = 'md', className }: Props) {
  const s = sizeMap[size]
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold tracking-tight leading-none text-foreground',
        s.text,
        className,
      )}
    >
      mundial
      <span className={cn('inline-block rounded-full bg-primary', s.dot)} aria-hidden />
      pool
    </span>
  )
}

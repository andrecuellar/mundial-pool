import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Props = {
  href: string
  label: string
  className?: string
}

export function BackLink({ href, label, className }: Props) {
  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <Link href={href}>
        <ChevronLeft className="h-3.5 w-3.5" />
        {label}
      </Link>
    </Button>
  )
}

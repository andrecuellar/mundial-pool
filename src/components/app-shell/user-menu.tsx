'use client'

import { LogOut } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/features/auth/actions'

type Props = {
  name: string
  email: string | null
  avatarUrl: string | null
}

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

export function UserMenu({ name, email, avatarUrl }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
        <Avatar className="h-8 w-8">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
          <AvatarFallback className="text-xs font-medium">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="hidden sm:inline text-sm font-medium">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <div className="text-sm font-medium truncate">{name}</div>
          {email && <div className="text-xs text-muted-foreground truncate">{email}</div>}
        </div>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

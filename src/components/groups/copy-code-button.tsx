'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Props = {
  code: string
  groupName: string
}

// Copies the full invitation text (intro + code + join link), same payload
// the Share button produces. Useful when the user wants to paste into an
// app the native share sheet doesn't support, or just hit "Copy" without
// going through the OS share UI.
export function CopyCodeButton({ code, groupName }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/join/${code}`
    const text = `Te invito a unirte a "${groupName}" en mundial-pool.\n\nMi código es: ${code}\n\n${url}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Invitación copiada al portapapeles')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('No se pudo copiar. Intenta de nuevo.')
    }
  }

  return (
    <Button onClick={handleCopy} variant="secondary" size="sm" type="button">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  )
}

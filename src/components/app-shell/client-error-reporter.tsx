'use client'

import { useEffect } from 'react'
import { installClientErrorReporter } from '@/lib/client-error-reporter'

// Mounted once from the root layout. The install function is idempotent
// (guarded with a module-level `installed` flag) so HMR can't double-register.
export function ClientErrorReporter() {
  useEffect(() => {
    installClientErrorReporter()
  }, [])
  return null
}

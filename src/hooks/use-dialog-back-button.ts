'use client'

import { useEffect, useRef } from 'react'

/**
 * Intercepts the Android (and browser) back gesture while a dialog is open.
 *
 * Without this, the back gesture pops the page route — annoying when the user
 * just wanted to dismiss a modal. We push a synthetic history entry when the
 * dialog opens, so the next popstate dismisses the modal instead of leaving
 * the page. When the user closes the dialog programmatically (X button,
 * Escape, click outside), we pop the entry ourselves to keep the back stack
 * balanced.
 */
export function useDialogBackButton(open: boolean, onOpenChange: (open: boolean) => void) {
  const pushedRef = useRef(false)
  const onOpenChangeRef = useRef(onOpenChange)

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (open) {
      // Mark our entry so we don't trip on someone else's popstate.
      window.history.pushState({ __mpDialog: true }, '')
      pushedRef.current = true

      const handler = () => {
        // Back gesture consumed our entry. Close the dialog WITHOUT popping
        // again — the popstate already moved us off the synthetic entry.
        pushedRef.current = false
        onOpenChangeRef.current(false)
      }
      window.addEventListener('popstate', handler)
      return () => {
        window.removeEventListener('popstate', handler)
      }
    }

    // Dialog just closed. If we still own the synthetic history entry (i.e.
    // the close did NOT come from a popstate), pop it so the back stack stays
    // clean and the user's next back press goes to the previous route.
    if (pushedRef.current) {
      pushedRef.current = false
      window.history.back()
    }
  }, [open])
}

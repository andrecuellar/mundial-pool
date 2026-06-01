// Types and constants that are safe to import from client components. Keeps
// the server-only db imports out of the client bundle.

export const ALLOWED_REACTION_EMOJIS = ['🔥', '😂', '💀', '👀', '🤡', '🤌'] as const
export type ReactionEmoji = (typeof ALLOWED_REACTION_EMOJIS)[number]

export type ReactionBucket = {
  emoji: string
  count: number
  reactedByMe: boolean
  reactors: string[] // display names
}

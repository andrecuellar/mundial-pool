import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <Skeleton className="mb-4 h-5 w-32" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />

      <div className="mt-6 flex gap-2">
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-44" />
      </div>

      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                <Skeleton key={j} className="h-8" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

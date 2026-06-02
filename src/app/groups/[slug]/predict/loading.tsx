import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <Skeleton className="mb-4 h-5 w-32" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />

      <div className="mt-6 space-y-3">
        {Array.from({ length: 14 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-5 w-48" />
            <Skeleton className="mt-3 h-10 w-full" />
          </div>
        ))}
      </div>
    </main>
  )
}

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <Skeleton className="mb-4 h-5 w-32" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />

      <div className="mt-6 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1 max-w-[12rem]" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </main>
  )
}

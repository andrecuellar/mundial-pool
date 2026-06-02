import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <Skeleton className="mb-4 h-5 w-32" />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-56 rounded-xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>

      <Skeleton className="mt-4 h-48 rounded-xl" />
      <Skeleton className="mt-4 h-24 rounded-xl" />
    </main>
  )
}

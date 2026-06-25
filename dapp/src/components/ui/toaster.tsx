'use client'

import { useToast } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts } = useToast()
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg animate-in slide-in-from-right"
        >
          {toast.title && <div className="font-medium">{toast.title}</div>}
          {toast.description && <div className="text-muted-foreground mt-1">{toast.description}</div>}
        </div>
      ))}
    </div>
  )
}

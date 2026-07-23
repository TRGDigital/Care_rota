'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Button } from '@carerota/ui'
import { CheckCircle, Flag, RefreshCw } from 'lucide-react'
import { markPhotoReviewed } from './actions'

type Clocking = {
  id: string
  event_type: string
  event_time_utc: string
  capture_method: string
  photo_url: string | null
  requires_review: boolean
  staff: { id: string; first_name: string; last_name: string; photo_url: string | null } | null
}

export function PhotoReviewClient({
  homeId,
  clockings: initial,
}: {
  homeId: string
  clockings: Clocking[]
}) {
  const [clockings, setClockings] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function removeClocking(id: string) {
    setClockings(c => c.filter(x => x.id !== id))
  }

  if (clockings.length === 0) {
    return (
      <div className="mt-8 text-center py-12 border rounded-lg text-sm text-muted-foreground">
        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
        No photos to review today — all caught up.
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">
        Review these {clockings.length} punch photos from the last 24 hours.
        Flag any that look suspicious.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clockings.map(c => (
          <PhotoCard
            key={c.id}
            homeId={homeId}
            clocking={c}
            isPending={isPending}
            onReviewed={() => removeClocking(c.id)}
            startTransition={startTransition}
          />
        ))}
      </div>
    </div>
  )
}

function PhotoCard({
  homeId,
  clocking,
  isPending,
  onReviewed,
  startTransition,
}: {
  homeId: string
  clocking: Clocking
  isPending: boolean
  onReviewed: () => void
  startTransition: (fn: () => Promise<void>) => void
}) {
  const [flagging, setFlagging] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [error, setError] = useState('')

  const time = new Date(clocking.event_time_utc).toLocaleString('en-GB', {
    dateStyle: 'short', timeStyle: 'short',
  })
  const staffName = clocking.staff
    ? `${clocking.staff.first_name} ${clocking.staff.last_name}`
    : 'Unknown'
  const verb = clocking.event_type === 'clock_in' ? 'Clocked in' : 'Clocked out'

  function handleApprove() {
    startTransition(async () => {
      await markPhotoReviewed(homeId, clocking.id, false, null)
      onReviewed()
    })
  }

  function handleFlag() {
    if (!flagReason.trim()) { setError('Enter a reason before flagging'); return }
    setError('')
    startTransition(async () => {
      await markPhotoReviewed(homeId, clocking.id, true, flagReason.trim())
      onReviewed()
    })
  }

  return (
    <div className="bg-card border rounded-lg overflow-hidden flex flex-col">
      <div className="aspect-video bg-muted relative">
        {clocking.photo_url ? (
          <Image
            src={clocking.photo_url}
            alt={`${verb} photo for ${staffName}`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            No photo
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col gap-2">
        <div>
          <p className="text-sm font-medium">{staffName}</p>
          <p className="text-xs text-muted-foreground">{verb} · {time}</p>
          <p className="text-xs text-muted-foreground capitalize">{clocking.capture_method.replace('_', ' ')}</p>
        </div>

        {flagging ? (
          <div className="space-y-2">
            <textarea
              placeholder="Reason for flagging..."
              value={flagReason}
              onChange={e => setFlagReason(e.target.value)}
              rows={2}
              className="w-full text-xs border rounded px-2 py-1 resize-none"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-1.5">
              <Button size="sm" variant="destructive" onClick={handleFlag} disabled={isPending} className="text-xs">
                {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-1" />}
                Confirm flag
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFlagging(false)} className="text-xs">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-1.5 mt-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={handleApprove}
              disabled={isPending}
              className="flex-1 text-xs"
            >
              <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
              Looks fine
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFlagging(true)}
              disabled={isPending}
              className="flex-1 text-xs text-red-600 hover:text-red-700"
            >
              <Flag className="h-3 w-3 mr-1" />
              Flag
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useTransition, useRef } from 'react'
import { uploadPolicyDocument } from './actions'

type Props = { homeId: string }

export function PolicyUploadForm({ homeId }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const { filename } = await uploadPolicyDocument(homeId, formData)
        setSuccess(`"${filename}" uploaded and queued for indexing.`)
        formRef.current?.reset()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="policy-file">
          Policy document
        </label>
        <input
          id="policy-file"
          type="file"
          name="file"
          accept=".pdf,.docx,.txt"
          required
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT — max 20 MB</p>
      </div>
      {error   && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
      <button type="submit" disabled={pending} className="btn-primary text-sm">
        {pending ? 'Uploading…' : 'Upload document'}
      </button>
    </form>
  )
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function uploadPolicyDocument(
  homeId: string,
  formData: FormData,
): Promise<{ id: string; filename: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const file = formData.get('file') as File | null
  if (!file || !file.size) throw new Error('No file provided')

  const maxBytes = 20 * 1024 * 1024 // 20 MB
  if (file.size > maxBytes) throw new Error('File must be under 20 MB')

  const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
  if (!allowed.includes(file.type)) throw new Error('Only PDF, DOCX, and TXT files are supported')

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${homeId}/policies/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('policy-documents')
    .upload(storagePath, file, { contentType: file.type })

  if (uploadErr) throw new Error(uploadErr.message)

  const { data: doc, error: insertErr } = await supabase
    .from('policy_documents')
    .insert({
      tenant_id:          homeId,
      home_id:            homeId,
      filename:           file.name,
      storage_path:       storagePath,
      mime_type:          file.type,
      file_size_bytes:    file.size,
      status:             'processing',
      created_by_user_id: user.id,
    })
    .select('id')
    .single()

  if (insertErr) throw new Error(insertErr.message)

  // Trigger indexing — in production this would be a background job.
  // For v1 we call the Edge Function directly (fire-and-forget).
  void supabase.functions.invoke('index-policy-document', {
    body: { documentId: doc.id, homeId, storagePath, mimeType: file.type },
  })

  revalidatePath(`/homes/${homeId}/settings/policies`)
  return { id: doc.id, filename: file.name }
}

export async function deletePolicyDocument(homeId: string, documentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: doc } = await supabase
    .from('policy_documents')
    .select('storage_path')
    .eq('id', documentId)
    .eq('home_id', homeId)
    .maybeSingle()

  if (doc?.storage_path) {
    await supabase.storage.from('policy-documents').remove([doc.storage_path])
  }

  // Delete RAG chunks
  await supabase.from('rag_chunks').delete().eq('home_id', homeId).eq('source_id', documentId)

  await supabase.from('policy_documents').delete().eq('id', documentId).eq('home_id', homeId)

  revalidatePath(`/homes/${homeId}/settings/policies`)
}

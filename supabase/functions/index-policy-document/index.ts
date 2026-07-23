// index-policy-document — invoked by the policy upload server action.
// Downloads the uploaded file from Supabase Storage, extracts text,
// chunks at ~800 tokens with 100-token overlap, upserts rag_chunks,
// and marks the policy_documents row as indexed (or error).
//
// Embedding: for v1 we store a zero vector as a placeholder.
// Replace embedText() with a real provider (Voyage, OpenAI text-embedding-3-small, etc.)
// when the API key is configured — the chunk_text search already falls back to ILIKE.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// ── Text extraction ────────────────────────────────────────────────────────────

function extractText(bytes: Uint8Array, mimeType: string): string {
  if (mimeType === 'text/plain') {
    return new TextDecoder().decode(bytes)
  }

  // PDF: strip binary and extract readable ASCII runs ≥ 4 chars (best-effort)
  if (mimeType === 'application/pdf') {
    const raw = new TextDecoder('latin1').decode(bytes)
    // Grab text between BT/ET markers and stream parentheses, as a rough heuristic
    const runs: string[] = []
    for (const m of raw.matchAll(/\(([^\)]{4,200})\)/g)) {
      const candidate = m[1].replace(/[^\x20-\x7E\n]/g, ' ').trim()
      if (candidate.length >= 4) runs.push(candidate)
    }
    return runs.join(' ')
  }

  // DOCX: it's a ZIP containing word/document.xml — extract the XML and strip tags
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // Best-effort: look for readable ASCII runs that resemble prose
    const raw = new TextDecoder('latin1').decode(bytes)
    return raw.replace(/<[^>]*>/g, ' ').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim()
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

// ── Chunking ──────────────────────────────────────────────────────────────────

const CHUNK_SIZE   = 800   // approx tokens (we use words as proxy: 1 word ≈ 1.3 tokens)
const CHUNK_OVERLAP = 100

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const chunkWords   = Math.round(CHUNK_SIZE / 1.3)
  const overlapWords = Math.round(CHUNK_OVERLAP / 1.3)

  if (words.length <= chunkWords) return [words.join(' ')]

  const chunks: string[] = []
  let start = 0
  while (start < words.length) {
    const end = Math.min(start + chunkWords, words.length)
    chunks.push(words.slice(start, end).join(' '))
    start += chunkWords - overlapWords
    if (start >= words.length) break
  }
  return chunks
}

// ── Embedding (stub — replace with real provider) ─────────────────────────────

function stubEmbedding(): number[] {
  return new Array(1536).fill(0) as number[]
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const body = await req.json() as {
    documentId:  string
    homeId:      string
    storagePath: string
    mimeType:    string
  }

  const { documentId, homeId, storagePath, mimeType } = body

  try {
    // 1. Download file from Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('policy-documents')
      .download(storagePath)

    if (dlErr || !fileData) {
      throw new Error(dlErr?.message ?? 'Download failed')
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer())

    // 2. Extract text
    const text = extractText(bytes, mimeType).trim()
    if (!text || text.length < 20) {
      throw new Error('Could not extract readable text from document')
    }

    // 3. Chunk
    const chunks = chunkText(text)

    // 4. Delete existing chunks for this document (in case of re-index)
    await supabase.from('rag_chunks').delete().eq('home_id', homeId).eq('source_id', documentId)

    // 5. Upsert chunks with stub embeddings
    const rows = chunks.map((content, i) => ({
      tenant_id:   homeId,
      home_id:     homeId,
      content,
      embedding:   JSON.stringify(stubEmbedding()),
      source_type: 'policy_document',
      source_id:   documentId,
      chunk_index: i,
      token_count: Math.round(content.split(/\s+/).length * 1.3),
      created_by_user_id: null,
    }))

    const { error: insertErr } = await supabase.from('rag_chunks').insert(rows)
    if (insertErr) throw new Error(insertErr.message)

    // 6. Mark as indexed
    await supabase.from('policy_documents').update({
      status:      'indexed',
      chunk_count: chunks.length,
    }).eq('id', documentId)

    return new Response(JSON.stringify({ ok: true, chunks: chunks.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('index-policy-document failed', { documentId, err })

    await supabase.from('policy_documents').update({
      status:     'error',
      error_text: err instanceof Error ? err.message : String(err),
    }).eq('id', documentId)

    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

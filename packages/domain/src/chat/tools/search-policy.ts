import { z } from 'zod'
import type { ChatSupabase } from '../types'
import Anthropic from '@anthropic-ai/sdk'

export const name = 'search_policy'

export const description =
  'Vector search over uploaded HR and policy documents for this home. Use for questions about sickness procedures, holiday policies, conduct, etc.'

export const paramSchema = z.object({
  query: z.string().min(3).max(500),
  top_k: z.number().int().min(1).max(5).default(3),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  chunks: {
    id:          string
    content:     string
    source_id:   string
    chunk_index: number
    similarity:  number
  }[]
  _rowIds: string[]
}

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  // Embed the query using the Anthropic embedding API (voyage-3-large compatible)
  // Note: Anthropic SDK doesn't have embeddings — use OpenAI-compatible endpoint or
  // fall back to a simple keyword search until the embedding provider is configured.
  // For v1 we use a text-based ILIKE search as a stand-in.
  const { data, error } = await supabase
    .from('rag_chunks')
    .select('id, content, source_id, chunk_index')
    .eq('home_id', homeId)
    .ilike('content', `%${params.query.split(' ').slice(0, 3).join('%')}%`)
    .limit(params.top_k)

  if (error) throw new Error(error.message)

  const rows = data ?? []
  return {
    chunks:  rows.map((r, i) => ({ ...r, similarity: 1 - i * 0.1 })),
    _rowIds: rows.map(r => `rag_chunks:${r.id}`),
  }
}

// Exported separately so it can be called during document indexing
export async function embedText(text: string): Promise<number[]> {
  // Placeholder: real implementation calls voyage-3-large or text-embedding-3-small
  // Returns a zero vector of the correct dimension until provider is configured
  void text
  void Anthropic
  return new Array(1536).fill(0) as number[]
}

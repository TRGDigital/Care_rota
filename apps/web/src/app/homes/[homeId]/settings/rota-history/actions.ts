'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ParsedRow = {
  staff_name: string
  shift_date: string
  start_time_local: string
  end_time_local: string
  role_code: string | undefined
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0]!.split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'))

  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('staff'))
  const dateIdx = headers.findIndex(h => h.includes('date'))
  const startIdx = headers.findIndex(h => h.includes('start'))
  const endIdx = headers.findIndex(h => h.includes('end') || h.includes('finish'))
  const roleIdx = headers.findIndex(h => h.includes('role'))

  if (nameIdx === -1 || dateIdx === -1 || startIdx === -1 || endIdx === -1) {
    return []
  }

  const rows: ParsedRow[] = []
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''))
    const staffName = cols[nameIdx]
    const shiftDate = cols[dateIdx]
    const startTime = cols[startIdx]
    const endTime = cols[endIdx]

    if (!staffName || !shiftDate || !startTime || !endTime) continue

    // Normalise date to YYYY-MM-DD
    let date = shiftDate
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(shiftDate)) {
      const [d, m, y] = shiftDate.split('/')
      date = `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(shiftDate)) {
      const [d, m, y] = shiftDate.split('/')
      date = `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
    }

    // Normalise times to HH:MM
    const normaliseTime = (t: string) => {
      const cleaned = t.replace(/[^0-9:]/g, '')
      if (/^\d{4}$/.test(cleaned)) return `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`
      return cleaned.slice(0, 5)
    }

    rows.push({
      staff_name: staffName,
      shift_date: date,
      start_time_local: normaliseTime(startTime),
      end_time_local: normaliseTime(endTime),
      role_code: roleIdx !== -1 ? cols[roleIdx] : undefined,
    })
  }
  return rows
}

export async function importHistoricalRota(homeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised', count: 0 }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided', count: 0 }
  if (file.size > 5 * 1024 * 1024) return { error: 'File too large (max 5MB)', count: 0 }

  const text = await file.text()
  const rows = parseCSV(text)

  if (rows.length === 0) {
    return {
      error: 'Could not parse file. Expected CSV with columns: Staff Name, Date, Start Time, End Time',
      count: 0,
    }
  }

  const batchId = crypto.randomUUID()

  // Fetch active staff for name matching
  const { data: staffList } = await supabase
    .from('staff')
    .select('id, first_name, last_name')
    .eq('home_id', homeId)

  const staffByName = new Map(
    (staffList ?? []).map(s => [`${s.first_name} ${s.last_name}`.toLowerCase(), s.id])
  )

  const inserts = rows.map(row => ({
    home_id: homeId,
    tenant_id: homeId,
    import_batch_id: batchId,
    staff_name: row.staff_name,
    staff_id: staffByName.get(row.staff_name.toLowerCase()) ?? null,
    shift_date: row.shift_date,
    start_time_local: row.start_time_local,
    end_time_local: row.end_time_local,
    role_code: row.role_code ?? null,
    source_file: file.name,
    created_by_user_id: user.id,
  }))

  const { error } = await supabase.from('rota_history').insert(inserts)
  if (error) return { error: error.message, count: 0 }

  revalidatePath(`/homes/${homeId}/settings/rota-history`)
  return { success: true, count: inserts.length }
}

import type { CsvFile, PayRunExportInput, ExportFormat } from './types'
import { exportGeneric } from './generic'
import { exportBrightPay } from './brightpay'
import { exportSage } from './sage'
import { exportXero } from './xero'
import { exportMoneysoft } from './moneysoft'
import { exportIris } from './iris'

export function exportPayRun(input: PayRunExportInput, formatOverride?: ExportFormat): CsvFile {
  const fmt = formatOverride ?? input.format
  switch (fmt) {
    case 'brightpay':   return exportBrightPay({ ...input, format: fmt })
    case 'sage':        return exportSage({ ...input, format: fmt })
    case 'xero':        return exportXero({ ...input, format: fmt })
    case 'moneysoft':   return exportMoneysoft({ ...input, format: fmt })
    case 'iris':        return exportIris({ ...input, format: fmt })
    default:            return exportGeneric({ ...input, format: fmt })
  }
}

export type { CsvFile, PayRunExportInput, ExportFormat }
export type { PayRunExportRow } from './types'

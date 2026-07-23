import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CareRota',
  description: 'Dynamic rota, time & attendance, and payroll for care homes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}

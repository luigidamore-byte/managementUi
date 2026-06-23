import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import ClientWrapper from '@/components/ClientWrapper'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        <AuthProvider>
          <ClientWrapper>
            {children}
          </ClientWrapper>
        </AuthProvider>
      </body>
    </html>
  )
}
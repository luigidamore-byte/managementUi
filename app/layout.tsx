import './globals.css'
import Header from '@/components/Header'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        <Header />
        <main className="container mx-auto p-4 mt-6">
          {children}
        </main>
      </body>
    </html>
  )
}
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CRM System',
  description: 'Insurance CRM System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
          }

          a {
            color: #0070f3;
            text-decoration: none;
          }

          a:hover {
            text-decoration: underline;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string } | null>(null)

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('authToken')
    const userData = localStorage.getItem('user')

    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      try {
        setUser(JSON.parse(userData))
      } catch (e) {
        console.error('Failed to parse user data:', e)
      }
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.logo}>CRM System</h1>
          <div style={styles.userSection}>
            <span style={styles.userEmail}>{user.email || 'User'}</span>
            <button onClick={handleLogout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.welcome}>
          <h2 style={styles.welcomeTitle}>Welcome to CRM</h2>
          <p style={styles.welcomeText}>
            Your dashboard is ready. Start managing your clients, deals, and policies.
          </p>
        </div>

        <div style={styles.grid}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Clients</h3>
            <p style={styles.cardDescription}>
              Manage your client database
            </p>
            <div style={styles.cardStat}>0</div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Deals</h3>
            <p style={styles.cardDescription}>
              Track active deals
            </p>
            <div style={styles.cardStat}>0</div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Policies</h3>
            <p style={styles.cardDescription}>
              Monitor insurance policies
            </p>
            <div style={styles.cardStat}>0</div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Tasks</h3>
            <p style={styles.cardDescription}>
              Manage your tasks
            </p>
            <div style={styles.cardStat}>0</div>
          </div>
        </div>
      </main>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    padding: '0 20px',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '64px',
  },
  logo: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#0070f3',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userEmail: {
    fontSize: '14px',
    color: '#666',
  },
  logoutButton: {
    padding: '8px 16px',
    fontSize: '14px',
    color: '#666',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  welcome: {
    marginBottom: '40px',
  },
  welcomeTitle: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  welcomeText: {
    fontSize: '16px',
    color: '#666',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  },
  card: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  cardDescription: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '16px',
  },
  cardStat: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#0070f3',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666',
  },
}

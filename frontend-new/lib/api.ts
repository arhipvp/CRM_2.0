/**
 * API Client for communicating with Gateway
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1'
const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true'

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Add auth token if available
    if (token && !AUTH_DISABLED) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    if (!response.ok) {
      const errorData = isJson ? await response.json() : { message: response.statusText }
      return {
        success: false,
        error: errorData.message || `HTTP ${response.status}`,
      }
    }

    const data = isJson ? await response.json() : null

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('API fetch error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Login user
 */
export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
  // Mock mode for development
  if (AUTH_DISABLED) {
    return {
      success: true,
      token: 'mock-token',
      user: {
        id: '1',
        email: email,
        name: 'Demo User',
      },
    }
  }

  const result = await apiFetch<{ token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (result.success && result.data) {
    return {
      success: true,
      token: result.data.token,
      user: result.data.user,
    }
  }

  return {
    success: false,
    error: result.error,
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
  }

  if (!AUTH_DISABLED) {
    await apiFetch('/auth/logout', { method: 'POST' })
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<ApiResponse<any>> {
  if (AUTH_DISABLED) {
    const userJson = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (userJson) {
      return {
        success: true,
        data: JSON.parse(userJson),
      }
    }
  }

  return apiFetch('/auth/me')
}

/**
 * Health check
 */
export async function healthCheck(): Promise<ApiResponse<{ status: string }>> {
  return apiFetch('/health')
}

// Export API utilities
export { apiFetch, API_BASE_URL }

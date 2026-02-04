/**
 * Mock auth module - Login functionality removed
 * Provides mock user data for the application
 */

import { currentUser } from '../../store/mockData'

// Storage key for user data
const USER_STORAGE_KEY = 'minute_user'

/**
 * Get the currently stored user
 * Falls back to mock user if no stored user
 */
export function getStoredUser() {
    try {
        const stored = localStorage.getItem(USER_STORAGE_KEY)
        if (stored) {
            return JSON.parse(stored)
        }
    } catch (e) {
        console.error('Failed to parse stored user:', e)
    }
    return currentUser
}

/**
 * Store user data (for mock purposes)
 */
export function setStoredUser(user: typeof currentUser) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

/**
 * Mock logout - clears stored user and returns
 */
export async function logout(): Promise<void> {
    localStorage.removeItem(USER_STORAGE_KEY)
    // Clear any other session data
    localStorage.removeItem('minute_settings')
}

export default {
    getStoredUser,
    setStoredUser,
    logout,
}

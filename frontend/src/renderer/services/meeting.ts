/**
 * MeetingService - Unified service layer for meeting data
 * Connects Dashboard, Calendar, and Meeting pages with consistent data
 * 
 * Features:
 * - Fetches from backend API when available
 * - Graceful fallback to mock data
 * - Field normalization for UI consistency
 * - Centralized transformation logic
 */

import { meetingsApi } from '../lib/api/meetings'
import { 
  meetings as mockMeetings, 
  actionItems as mockActionItems,
  decisions as mockDecisions,
  risks as mockRisks,
  type Meeting as MockMeeting,
} from '../store/mockData'
import type { Meeting, MeetingListResponse } from '../shared/dto/meeting'

// ============================================
// NORMALIZED TYPES
// ============================================

export type MeetingStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled'

export interface NormalizedMeeting {
  id: string
  title: string
  description?: string
  date: string  // YYYY-MM-DD format
  start: string // HH:mm format
  end: string   // HH:mm format
  startTime: Date
  endTime: Date
  participants: number
  status: MeetingStatus
  phase: 'pre' | 'in' | 'post'
  meetingType: string
  location?: string
  teamsLink?: string
  project?: string
}

export interface MeetingStats {
  totalMeetings: number
  upcoming: number
  inProgress: number
  completed: number
  todayMeetings: number
}

export interface DashboardStats extends MeetingStats {
  totalActions: number
  actionsCompleted: number
  actionsOverdue: number
  actionsInProgress: number
  totalDecisions: number
  decisionsConfirmed: number
  totalRisks: number
  risksHigh: number
  risksMitigated: number
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatTimeString(date: Date): string {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function parseDateTime(dateStr: string | undefined, fallback: Date): Date {
  if (!dateStr) return fallback
  try {
    return new Date(dateStr)
  } catch {
    return fallback
  }
}

function determineMeetingStatus(meeting: { phase: string, startTime: Date, endTime: Date }): MeetingStatus {
  const now = new Date()
  
  // Check if meeting is currently live based on time
  const isLiveByTime = now >= meeting.startTime && now <= meeting.endTime
  
  // Priority: time-based detection first, then phase
  if (isLiveByTime) return 'in_progress'
  if (meeting.phase === 'post' || meeting.endTime < now) return 'completed'
  if (meeting.phase === 'in') return 'in_progress'
  if (meeting.startTime > now) return 'upcoming'
  
  return 'upcoming'
}

// ============================================
// TRANSFORM FUNCTIONS
// ============================================

/**
 * Transform API Meeting to NormalizedMeeting
 */
function transformApiMeeting(meeting: Meeting): NormalizedMeeting {
  const now = new Date()
  const startTime = parseDateTime(meeting.start_time, now)
  const endTime = parseDateTime(meeting.end_time, new Date(now.getTime() + 60 * 60 * 1000))
  
  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    date: formatDateString(startTime),
    start: formatTimeString(startTime),
    end: formatTimeString(endTime),
    startTime,
    endTime,
    participants: 0, // API doesn't return this yet, fallback to 0
    status: determineMeetingStatus({ phase: meeting.phase, startTime, endTime }),
    phase: meeting.phase,
    meetingType: meeting.meeting_type,
    location: meeting.location,
    teamsLink: meeting.teams_link,
    project: meeting.project_id,
  }
}

/**
 * Transform Mock Meeting to NormalizedMeeting
 */
function transformMockMeeting(meeting: MockMeeting): NormalizedMeeting {
  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    date: formatDateString(meeting.startTime),
    start: formatTimeString(meeting.startTime),
    end: formatTimeString(meeting.endTime),
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    participants: meeting.participants.length,
    status: determineMeetingStatus({ phase: meeting.phase, startTime: meeting.startTime, endTime: meeting.endTime }),
    phase: meeting.phase,
    meetingType: meeting.meetingType,
    location: meeting.location,
    teamsLink: meeting.teamsLink,
    project: meeting.project,
  }
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get all meetings with optional fallback to mock data
 */
export async function getMeetings(): Promise<NormalizedMeeting[]> {
  try {
    const response: MeetingListResponse = await meetingsApi.list()
    
    if (response.meetings && response.meetings.length > 0) {
      return response.meetings.map(transformApiMeeting)
    }
    
    // API returned empty, use mock data
    console.log('[MeetingService] API returned empty, using mock data')
    return mockMeetings.map(transformMockMeeting)
  } catch (error) {
    console.warn('[MeetingService] API error, falling back to mock data:', error)
    return mockMeetings.map(transformMockMeeting)
  }
}

/**
 * Get upcoming meetings (not completed)
 */
export async function getUpcomingMeetings(limit?: number): Promise<NormalizedMeeting[]> {
  const meetings = await getMeetings()
  
  const upcoming = meetings
    .filter(m => m.status === 'upcoming' || m.status === 'in_progress')
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  
  return limit ? upcoming.slice(0, limit) : upcoming
}

/**
 * Get meetings for calendar within date range
 */
export async function getCalendarMeetings(startDate: Date, endDate: Date): Promise<NormalizedMeeting[]> {
  const meetings = await getMeetings()
  
  return meetings.filter(m => {
    const meetingDate = m.startTime
    return meetingDate >= startDate && meetingDate <= endDate
  })
}

/**
 * Get today's meetings
 */
export async function getTodayMeetings(): Promise<NormalizedMeeting[]> {
  const meetings = await getMeetings()
  const today = new Date()
  const todayStr = formatDateString(today)
  
  return meetings
    .filter(m => m.date === todayStr)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

/**
 * Get live meeting (currently in progress)
 */
export async function getLiveMeeting(): Promise<NormalizedMeeting | null> {
  const meetings = await getMeetings()
  return meetings.find(m => m.status === 'in_progress') || null
}

/**
 * Get meeting stats
 */
export async function getMeetingStats(): Promise<MeetingStats> {
  const meetings = await getMeetings()
  const today = new Date()
  const todayStr = formatDateString(today)
  
  const todayMeetings = meetings.filter(m => m.date === todayStr)
  
  return {
    totalMeetings: meetings.length,
    upcoming: meetings.filter(m => m.status === 'upcoming').length,
    inProgress: meetings.filter(m => m.status === 'in_progress').length,
    completed: meetings.filter(m => m.status === 'completed').length,
    todayMeetings: todayMeetings.length,
  }
}

/**
 * Get full dashboard stats (meetings + actions + decisions + risks)
 * Uses mock data for non-meeting stats until backend supports them
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const meetingStats = await getMeetingStats()
  const now = new Date()
  
  // Actions stats from mock data (backend not ready)
  const actionsCompleted = mockActionItems.filter(a => a.status === 'completed').length
  const actionsOverdue = mockActionItems.filter(a => a.deadline < now && a.status !== 'completed').length
  const actionsInProgress = mockActionItems.filter(a => a.status === 'in_progress').length
  
  // Decisions stats from mock data
  const decisionsConfirmed = mockDecisions.filter(d => d.status === 'confirmed').length
  
  // Risks stats from mock data
  const risksHigh = mockRisks.filter(r => r.severity === 'high' || r.severity === 'critical').length
  const risksMitigated = mockRisks.filter(r => r.status === 'mitigated').length
  
  return {
    ...meetingStats,
    totalActions: mockActionItems.length,
    actionsCompleted,
    actionsOverdue,
    actionsInProgress,
    totalDecisions: mockDecisions.length,
    decisionsConfirmed,
    totalRisks: mockRisks.length,
    risksHigh,
    risksMitigated,
  }
}

/**
 * Get a single meeting by ID
 */
export async function getMeetingById(id: string): Promise<NormalizedMeeting | null> {
  try {
    const response = await meetingsApi.get(id)
    return transformApiMeeting(response)
  } catch {
    // Fallback to mock data
    const mockMeeting = mockMeetings.find(m => m.id === id)
    return mockMeeting ? transformMockMeeting(mockMeeting) : null
  }
}

// ============================================
// REACT HOOKS (for convenience)
// ============================================

import { useState, useEffect, useCallback } from 'react'

export interface UseAsyncDataResult<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook for fetching upcoming meetings
 */
export function useUpcomingMeetings(limit?: number): UseAsyncDataResult<NormalizedMeeting[]> {
  const [data, setData] = useState<NormalizedMeeting[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getUpcomingMeetings(limit)
      setData(result)
    } catch (err) {
      setError('Không thể tải danh sách cuộc họp')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

/**
 * Hook for fetching today's meetings
 */
export function useTodayMeetings(): UseAsyncDataResult<NormalizedMeeting[]> {
  const [data, setData] = useState<NormalizedMeeting[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getTodayMeetings()
      setData(result)
    } catch (err) {
      setError('Không thể tải cuộc họp hôm nay')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

/**
 * Hook for fetching dashboard stats
 */
export function useDashboardStats(): UseAsyncDataResult<DashboardStats> {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getDashboardStats()
      setData(result)
    } catch (err) {
      setError('Không thể tải thống kê')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

/**
 * Hook for fetching live meeting
 */
export function useLiveMeeting(): UseAsyncDataResult<NormalizedMeeting | null> {
  const [data, setData] = useState<NormalizedMeeting | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getLiveMeeting()
      setData(result)
    } catch (err) {
      setError('Không thể kiểm tra cuộc họp đang diễn ra')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

/**
 * Hook for fetching calendar meetings
 */
export function useCalendarMeetings(startDate: Date, endDate: Date): UseAsyncDataResult<NormalizedMeeting[]> {
  const [data, setData] = useState<NormalizedMeeting[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getCalendarMeetings(startDate, endDate)
      setData(result)
    } catch (err) {
      setError('Không thể tải lịch họp')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [startDate.getTime(), endDate.getTime()])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

// ============================================
// EXPORT
// ============================================

export const MeetingService = {
  getMeetings,
  getUpcomingMeetings,
  getCalendarMeetings,
  getTodayMeetings,
  getLiveMeeting,
  getMeetingStats,
  getDashboardStats,
  getMeetingById,
}

export default MeetingService


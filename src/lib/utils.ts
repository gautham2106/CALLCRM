import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

// Returns today's date as YYYY-MM-DD in IST (works on both server and browser).
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export function getWhatsAppLink(phone: string, message?: string): string {
  const cleaned = phone.replace(/\D/g, '')
  const number = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
  const encodedMessage = message ? encodeURIComponent(message) : ''
  return `https://wa.me/${number}${encodedMessage ? `?text=${encodedMessage}` : ''}`
}

export function getCallLink(phone: string): string {
  return `tel:${phone}`
}

export const LEAD_STAGES = [
  'New Enquiry',
  'Contacted',
  'Visit Scheduled',
  'Visit Done',
  'Application Started',
  'Enrolled',
  'Cold Lead',
  'Wrong Lead',
] as const

export const CALL_STAGES = [
  'Call Picked',
  'Interested',
  'Not Interested',
  'Call Not Picked',
  'Call Later',
] as const

export const LEAD_STAGE_COLORS: Record<string, string> = {
  'New Enquiry': 'bg-blue-100 text-blue-800',
  'Contacted': 'bg-yellow-100 text-yellow-800',
  'Visit Scheduled': 'bg-purple-100 text-purple-800',
  'Visit Done': 'bg-indigo-100 text-indigo-800',
  'Application Started': 'bg-orange-100 text-orange-800',
  'Enrolled': 'bg-green-100 text-green-800',
  'Cold Lead': 'bg-gray-100 text-gray-800',
  'Wrong Lead': 'bg-red-100 text-red-800',
}

export const CALL_STAGE_COLORS: Record<string, string> = {
  'Call Picked': 'bg-green-100 text-green-800',
  'Interested': 'bg-blue-100 text-blue-800',
  'Not Interested': 'bg-red-100 text-red-800',
  'Call Not Picked': 'bg-yellow-100 text-yellow-800',
  'Call Later': 'bg-orange-100 text-orange-800',
}


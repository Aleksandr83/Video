import { describe, it, expect, beforeEach } from 'vitest'
import {
    RESUME_MIN_REMAINING,
    loadPosition,
    savePosition,
    clearPosition,
} from '../../src/utils/resume'

/**
 * Task 8: a track that has essentially finished must not come back at (near) its end.
 * The user's rule (2026-11-18 13:39 MSK): "if less than 30 seconds are left — play from
 * the beginning". So a position closer to the end than RESUME_MIN_REMAINING counts as
 * watched through: it is never stored, and a value that is already there is dropped.
 *
 * Measured in stage 36 on the user's real MP4 (163.79 s long): the 5-second timeupdate
 * throttle left 161.768503 behind, and reopening resumed at 162.078 — 1.72 s before the end.
 */
const KEY = 'Movies/a.mp4'
const STORAGE_KEY = 'video-resume:' + KEY
const DURATION = 163.79

function raw() {
    return localStorage.getItem(STORAGE_KEY)
}

describe('src/utils/resume.js — a finished track starts from the beginning', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('threshold of "watched through" is the 30 seconds the user asked for', () => {
        expect(RESUME_MIN_REMAINING).toBe(30)
    })

    it('stores a position when at least 30 seconds are still left', () => {
        savePosition(KEY, 100, DURATION) // 63.79 s left

        expect(raw()).toBe('100')
        expect(loadPosition(KEY, DURATION)).toBe(100)
    })

    it('does not store a position that is closer to the end than 30 seconds', () => {
        savePosition(KEY, 140, DURATION) // 23.79 s left

        expect(raw()).toBeNull()
        expect(loadPosition(KEY, DURATION)).toBe(0)
    })

    it('drops the stored position as soon as the track gets that close to its end', () => {
        savePosition(KEY, 100, DURATION)
        expect(raw()).toBe('100')

        savePosition(KEY, 150, DURATION) // 13.79 s left: watched through now

        expect(raw()).toBeNull()
    })

    it('exactly 30 seconds left still counts as worth resuming (boundary)', () => {
        savePosition(KEY, DURATION - 30, DURATION)

        expect(raw()).toBe(String(DURATION - 30))
        expect(loadPosition(KEY, DURATION)).toBe(DURATION - 30)
    })

    it('a value at the very end (what a finished track leaves behind) is not resumable', () => {
        savePosition(KEY, DURATION, DURATION)

        expect(raw()).toBeNull()
        expect(loadPosition(KEY, DURATION)).toBe(0)
    })

    it('drops and removes a leftover near-end value once the duration is known', () => {
        // Written by the version before task 8 — exactly what stage 36 measured.
        localStorage.setItem(STORAGE_KEY, '161.768503')

        expect(loadPosition(KEY, DURATION)).toBe(0)
        expect(raw()).toBeNull()
    })

    it('without a duration the remaining time cannot be judged: the value is kept', () => {
        savePosition(KEY, 150) // duration unknown (a stream without metadata)

        expect(raw()).toBe('150')
        expect(loadPosition(KEY, NaN)).toBe(150)
        expect(loadPosition(KEY, Infinity)).toBe(150)
        expect(loadPosition(KEY)).toBe(150)
    })

    it('a position of 0 means "start from the beginning" and clears the entry', () => {
        savePosition(KEY, 100, DURATION)

        savePosition(KEY, 0, DURATION)

        expect(raw()).toBeNull()
        expect(loadPosition(KEY, DURATION)).toBe(0)
    })

    it('clearPosition forgets the track entirely', () => {
        savePosition(KEY, 100, DURATION)

        clearPosition(KEY)

        expect(raw()).toBeNull()
        expect(loadPosition(KEY, DURATION)).toBe(0)
    })
})

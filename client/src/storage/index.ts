import { INITIAL_ATTRIBUTES, RULES_VERSION, SCHEMA_VERSION, TOTAL_DAYS } from '../api/script'
import type { Attributes, Effects, GameEvent, Grade, HistoryEntry, Phase, Snapshot } from '../state/types'

export const STORAGE_KEY = 'campusmock:snapshot'

export type LoadResult =
  | { kind: 'none' }
  | { kind: 'ok'; snapshot: Snapshot }
  | { kind: 'invalid'; raw: string }
  | { kind: 'unsupported'; raw: string }
  | { kind: 'unavailable'; raw: null }

const PHASES: Phase[] = ['pendingEvent', 'pendingChoice', 'showResult', 'pendingEnding', 'ended']
const GRADES: Grade[] = ['A', 'B', 'C', 'D']
const ATTRIBUTE_KEYS = ['academics', 'social', 'energy', 'money'] as const
const EFFECT_RANGES: Record<keyof Effects, readonly [number, number]> = {
  academics: [-2, 3],
  social: [-2, 3],
  energy: [-2, 2],
  money: [-300, 300],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isAttributes(value: unknown): value is Attributes {
  return (
    isRecord(value) &&
    ATTRIBUTE_KEYS.every(key => Number.isSafeInteger(value[key]))
  )
}

function isEffects(value: unknown): value is Effects {
  if (!isAttributes(value)) return false
  return ATTRIBUTE_KEYS.every(key => {
    const [min, max] = EFFECT_RANGES[key]
    return value[key] >= min && value[key] <= max
  })
}

function isGameEvent(value: unknown): value is GameEvent {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !Number.isInteger(value.day)) return false
  if (!isNonEmptyString(value.title) || !isNonEmptyString(value.description) || !Array.isArray(value.options)) return false
  if (value.options.length < 2) return false

  const optionIds = new Set<string>()
  return value.options.every(option => {
    if (!isRecord(option) || !isNonEmptyString(option.id) || optionIds.has(option.id)) return false
    optionIds.add(option.id)
    return isNonEmptyString(option.text) && isEffects(option.effects) && isNonEmptyString(option.resultText)
  })
}

function isHistoryEntry(value: unknown, expectedDay: number): value is HistoryEntry {
  return (
    isRecord(value) &&
    value.day === expectedDay &&
    isNonEmptyString(value.eventId) &&
    isNonEmptyString(value.optionId) &&
    isNonEmptyString(value.eventTitle) &&
    isNonEmptyString(value.chosenText) &&
    isNonEmptyString(value.resultText) &&
    isEffects(value.effects)
  )
}

function attributesFromHistory(history: HistoryEntry[]): Attributes {
  return history.reduce<Attributes>(
    (attributes, entry) => ({
      academics: attributes.academics + entry.effects.academics,
      social: attributes.social + entry.effects.social,
      energy: attributes.energy + entry.effects.energy,
      money: attributes.money + entry.effects.money,
    }),
    { ...INITIAL_ATTRIBUTES },
  )
}

function sameAttributes(left: Attributes, right: Attributes): boolean {
  return ATTRIBUTE_KEYS.every(key => left[key] === right[key])
}

function eventMatchesEntry(event: GameEvent, entry: HistoryEntry): boolean {
  const selected = event.options.find(option => option.id === entry.optionId)
  return (
    event.id === entry.eventId &&
    event.day === entry.day &&
    selected !== undefined &&
    sameAttributes(selected.effects, entry.effects) &&
    selected.resultText === entry.resultText
  )
}

function isEnding(value: unknown, attributes: Attributes): boolean {
  if (!isRecord(value) || !isAttributes(value.finalAttributes) || !isRecord(value.grades)) return false
  const grades = value.grades
  if (!sameAttributes(value.finalAttributes, attributes)) return false
  if (!ATTRIBUTE_KEYS.every(key => GRADES.includes(grades[key] as Grade))) return false
  return (
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.evaluation) &&
    isNonEmptyString(value.advice)
  )
}

function hasValidPhaseState(snapshot: Snapshot): boolean {
  const completed = snapshot.history.length
  if (snapshot.phase === 'pendingEvent') {
    return completed < TOTAL_DAYS && snapshot.currentEvent === null && snapshot.ending === null
  }
  if (snapshot.phase === 'pendingChoice') {
    return (
      completed < TOTAL_DAYS &&
      snapshot.ending === null &&
      snapshot.currentEvent !== null &&
      snapshot.currentEvent.day === completed + 1 &&
      !snapshot.history.some(entry => entry.eventId === snapshot.currentEvent?.id)
    )
  }
  if (snapshot.phase === 'showResult') {
    const latest = snapshot.history.at(-1)
    return (
      completed > 0 &&
      completed < TOTAL_DAYS &&
      snapshot.ending === null &&
      snapshot.currentEvent !== null &&
      latest !== undefined &&
      eventMatchesEntry(snapshot.currentEvent, latest)
    )
  }
  if (snapshot.phase === 'pendingEnding') {
    const latest = snapshot.history.at(-1)
    return (
      completed === TOTAL_DAYS &&
      snapshot.ending === null &&
      (snapshot.currentEvent === null || (latest !== undefined && eventMatchesEntry(snapshot.currentEvent, latest)))
    )
  }
  return completed === TOTAL_DAYS && snapshot.currentEvent === null && isEnding(snapshot.ending, snapshot.attributes)
}

export function isSnapshot(value: unknown): value is Snapshot {
  if (!isRecord(value)) return false
  if (value.schemaVersion !== SCHEMA_VERSION || value.rulesVersion !== RULES_VERSION) return false
  if (!isNonEmptyString(value.gameId) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0) return false
  if (!PHASES.includes(value.phase as Phase) || !isAttributes(value.attributes) || !Array.isArray(value.history)) return false
  if (value.history.length > TOTAL_DAYS) return false

  const history = value.history
  const eventIds = new Set<string>()
  if (
    !history.every((entry, index) => {
      if (!isHistoryEntry(entry, index + 1) || eventIds.has(entry.eventId)) return false
      eventIds.add(entry.eventId)
      return true
    })
  ) {
    return false
  }
  if (!sameAttributes(attributesFromHistory(history), value.attributes)) return false
  if (value.currentEvent !== null && !isGameEvent(value.currentEvent)) return false
  if (value.ending !== null && !isEnding(value.ending, value.attributes)) return false

  return hasValidPhaseState(value as unknown as Snapshot)
}

export function loadSnapshot(): LoadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { kind: 'unavailable', raw: null }
  }
  if (!raw) return { kind: 'none' }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { kind: 'invalid', raw }
    if (parsed.schemaVersion !== SCHEMA_VERSION || parsed.rulesVersion !== RULES_VERSION) {
      return { kind: 'unsupported', raw }
    }
    return isSnapshot(parsed) ? { kind: 'ok', snapshot: parsed } : { kind: 'invalid', raw }
  } catch {
    return { kind: 'invalid', raw }
  }
}

export function saveSnapshot(snapshot: Snapshot): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    return false
  }
}

export function clearSnapshot(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

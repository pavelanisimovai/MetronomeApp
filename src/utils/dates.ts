export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function yesterdayKey(date = new Date()): string {
  const previous = new Date(date)
  previous.setDate(previous.getDate() - 1)
  return localDateKey(previous)
}
export function currentStreak(
  last: string | null,
  days: number,
  date = new Date(),
): number {
  return last === localDateKey(date) || last === yesterdayKey(date) ? days : 0
}

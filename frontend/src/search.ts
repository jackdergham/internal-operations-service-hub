import type { TabKey } from './types'

const REQUEST_LIST_TABS: readonly TabKey[] = ['myrequests', 'teamqueue', 'approvals']

export function isRequestListTab(tab: TabKey): boolean {
  return REQUEST_LIST_TABS.includes(tab)
}

export function searchPlaceholder(tab: TabKey, approverView: boolean): string {
  if (tab === 'myrequests') return 'Search my requests…'
  if (tab === 'approvals' || (tab === 'teamqueue' && approverView)) return 'Search approvals…'
  return 'Search the fulfillment queue…'
}

function tokensOf(term: string): string[] {
  return term
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/^#/, ''))
    .filter(Boolean)
}

export function isSearching(term: string): boolean {
  return tokensOf(term).length > 0
}

export function matchesSearch(term: string, fields: ReadonlyArray<string | null | undefined>): boolean {
  const tokens = tokensOf(term)
  if (tokens.length === 0) return true
  const haystack = fields.filter((field): field is string => Boolean(field)).join(' ').toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

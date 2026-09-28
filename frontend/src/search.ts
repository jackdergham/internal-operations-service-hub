import type { TabKey } from './types'

// Search is for tabs whose main content is a list of requests. Catalog lists
// request *types*, Reports is aggregate metrics and Config is settings, so
// the search box is hidden there.
const REQUEST_LIST_TABS: readonly TabKey[] = ['myrequests', 'teamqueue', 'approvals']

export function isRequestListTab(tab: TabKey): boolean {
  return REQUEST_LIST_TABS.includes(tab)
}

// The placeholder tells the user what they are searching. Scope follows the
// docs: a requester searches their own requests; a fulfiller or approver
// searches what is in their queue.
export function searchPlaceholder(tab: TabKey, approverView: boolean): string {
  if (tab === 'myrequests') return 'Search my requests…'
  if (tab === 'approvals' || (tab === 'teamqueue' && approverView)) return 'Search approvals…'
  return 'Search the fulfillment queue…'
}

function tokensOf(term: string): string[] {
  return term
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/^#/, '')) // ticket ids are displayed as "#REQ-…"
    .filter(Boolean)
}

export function isSearching(term: string): boolean {
  return tokensOf(term).length > 0
}

// Case-insensitive; every word in the term must appear somewhere in the
// row's searchable text, in any order ("laptop pending" finds a pending laptop
// request). An empty term matches everything.
export function matchesSearch(term: string, fields: ReadonlyArray<string | null | undefined>): boolean {
  const tokens = tokensOf(term)
  if (tokens.length === 0) return true
  const haystack = fields.filter((field): field is string => Boolean(field)).join(' ').toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

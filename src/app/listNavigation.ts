export interface ListNavigationState {
  listPath: string;
}

const listPathPattern = /^(?:\/(?:\?.*)?|\/categories\/(?:[^/?#]+)(?:\?.*)?|\/ledgers\/(?:active|retired|sold)(?:\?.*)?)$/;

export function readListPath(state: unknown): string {
  if (!state || typeof state !== 'object' || !('listPath' in state)) return '/';
  const value = (state as { listPath?: unknown }).listPath;
  return typeof value === 'string' && listPathPattern.test(value) ? value : '/';
}

export function listNavigationState(pathname: string, search: string): ListNavigationState {
  const candidate = `${pathname}${search}`;
  return { listPath: listPathPattern.test(candidate) ? candidate : '/' };
}

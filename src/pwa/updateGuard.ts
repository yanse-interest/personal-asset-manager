// A pristine, permanent form (for example category creation in Settings) can opt out.
// All reload entry points must use the same check, including SW controller changes.
export function hasPendingWork(root: Pick<Document, 'querySelector'> = document): boolean {
  return Boolean(root.querySelector('form:not([data-pwa-dirty="false"]),[data-pwa-dirty="true"],[data-pwa-busy="true"],[role="dialog"]'));
}

export const UPDATE_BLOCKED_MESSAGE = '请先保存或取消正在进行的编辑，再更新应用。';

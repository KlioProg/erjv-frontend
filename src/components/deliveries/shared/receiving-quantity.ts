/** Keep every quantity column equally sized, including long decimal drafts. */
export function receivingQuantityWidth(values: (string | undefined)[]) {
  return Math.max(104, ...values.map((value) => Math.min(value?.length ?? 0, 18) * 9 + 24))
}

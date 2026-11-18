export function friendshipDocumentId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("__");
}

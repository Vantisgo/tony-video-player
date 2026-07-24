// Convert a live list (AudioTrackList, TextTrackList, NodeList, …) to an array,
// tolerating hosts where the list isn't directly iterable.
export function listToArray<T>(list: ArrayLike<T> | null | undefined): T[] {
  if (!list) return [];
  try {
    return Array.from(list);
  } catch {
    const out: T[] = [];
    for (let i = 0; i < (list.length || 0); i++) out.push(list[i]);
    return out;
  }
}

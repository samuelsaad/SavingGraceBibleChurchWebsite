/** Single-record identities only. Broadcaster/library and arbitrary embed HTML
 * are never usable as an individual sermon player. */
export const sermonAudioIdPattern = /^[0-9]{1,24}$/u;
const hosts = new Set(['sermonaudio.com', 'www.sermonaudio.com', 'embed.sermonaudio.com']);
export function canonicalSermonAudioUrl(id: string): string | null {
  return sermonAudioIdPattern.test(id) ? `https://www.sermonaudio.com/sermons/${id}` : null;
}
export function sermonAudioPlayerUrl(id: string): string | null {
  return sermonAudioIdPattern.test(id) ? `https://embed.sermonaudio.com/player/a/${id}/` : null;
}
export function sermonAudioIdFromUrl(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || !hosts.has(url.hostname.toLowerCase()) || url.username || url.password || url.port || url.hash) return null;
  const pathId = /^\/sermons\/([0-9]{1,24})\/?$/u.exec(url.pathname)?.[1]
    ?? (url.hostname === 'embed.sermonaudio.com' ? /^\/player\/(?:a\/)?([0-9]{1,24})\/?$/u.exec(url.pathname)?.[1] : null);
  const queryIds = ['SID','sid','sermon'].flatMap(key => url.searchParams.getAll(key));
  if (queryIds.some(id => !sermonAudioIdPattern.test(id)) || new Set(queryIds).size > 1) return null;
  const legacy = /^\/(?:sermoninfo|player_audio)\.asp$/iu.test(url.pathname) && queryIds.length ? queryIds[0] : null;
  const id = pathId ?? legacy;
  if (!id || queryIds.some(other => other !== id)) return null;
  return id;
}
export function resolveSermonAudioIdentity(item: {externalId?: string | null; canonicalUrl?: string | null}): string | null {
  const id = item.externalId ?? null;
  if (id !== null && !sermonAudioIdPattern.test(id)) return null;
  const fromUrl = item.canonicalUrl ? sermonAudioIdFromUrl(item.canonicalUrl) : null;
  if (item.canonicalUrl && !fromUrl) return null;
  if (id && fromUrl && id !== fromUrl) return null;
  return id ?? fromUrl;
}

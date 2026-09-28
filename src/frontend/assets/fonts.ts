/**
 * Original Bitstream Vera Sans files supplied by the installed ReportLab bundle.
 * Fonts and their complete license are embedded so every runtime serves the
 * same allowlisted bytes without a filesystem lookup or external request.
 */
import { embeddedFontAssets, type FontAssetId } from "./font-bytes";

export const siteFontAssets = Object.freeze(
  (Object.keys(embeddedFontAssets) as FontAssetId[]).map((id) => {
    const asset = embeddedFontAssets[id];
    return Object.freeze({ id, file: asset.file, path: `/brand/fonts/${asset.file}`, type: asset.type, sha256: asset.sha256 });
  })
);

export function siteFontAssetBytes(id: FontAssetId): Uint8Array<ArrayBuffer> {
  const binary = atob(embeddedFontAssets[id].base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

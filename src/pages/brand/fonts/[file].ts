// Static output shares the font and license bytes used by every server runtime.
import type { APIRoute } from "astro";
import { siteFontAssetBytes, siteFontAssets } from "../../../frontend/assets/fonts";

export function getStaticPaths() {
  return siteFontAssets.map((asset) => ({ params: { file: asset.file } }));
}

export const GET: APIRoute = ({ params }) => {
  const asset = siteFontAssets.find((candidate) => candidate.file === params.file);
  if (!asset) return new Response(null, { status: 404 });
  return new Response(siteFontAssetBytes(asset.id), {
    headers: { "Content-Type": asset.type, "X-Content-Type-Options": "nosniff" }
  });
};

// The church website's images for the static build, emitted from the same
// embedded bytes the server runtimes serve, so every runtime delivers the
// identical file at the identical /media/{file} path.
import type { APIRoute } from "astro";
import { siteImageBytes, siteImages } from "../../frontend/assets/media";

const published = siteImages.filter((image) => image.path.startsWith("/media/"));

export function getStaticPaths() {
  return published.map((image) => ({ params: { file: image.file } }));
}

export const GET: APIRoute = ({ params }) => {
  const image = published.find((candidate) => candidate.file === params.file);
  if (!image) return new Response(null, { status: 404 });
  return new Response(siteImageBytes(image.id), { headers: { "Content-Type": image.type } });
};

// The church's favicon for the static build, from the embedded media bytes.
import { siteImageBytes } from "../../frontend/assets/media";

export function GET(): Response {
  return new Response(siteImageBytes("favicon-32"), { headers: { "Content-Type": "image/png" } });
}

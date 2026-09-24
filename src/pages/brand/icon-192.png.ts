// The church's touch icon for the static build, from the embedded media bytes.
import { siteImageBytes } from "../../frontend/assets/media";

export function GET(): Response {
  return new Response(siteImageBytes("icon-192"), { headers: { "Content-Type": "image/png" } });
}

// The church logo for the static build, emitted from the same embedded bytes
// the server runtimes serve, so the production output and every preview
// deliver the identical file at the identical path.
import { logoBytes } from "../../frontend/assets/logo";

export function GET(): Response {
  return new Response(logoBytes(), { headers: { "Content-Type": "image/png" } });
}

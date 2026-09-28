/**
 * Registry of the bounded client-side enhancements.
 *
 * Each script is a readable source string. The page shell embeds the scripts
 * a page asks for, and the server response builder derives the Content-
 * Security-Policy hashes from the script and style bodies that were actually
 * embedded, so the header and the document can never disagree.
 */
import { canonScript } from "./canon";
import { sermonScript } from "./sermon";
import { navigationScript } from "./navigation";
import { churchScript } from "./church";
import { mobileNavigationScript } from "./mobile-navigation";

export const enhancementScripts = {
  canon: canonScript,
  sermon: sermonScript,
  navigation: navigationScript,
  church: churchScript,
  mobileNavigation: mobileNavigationScript
} as const;

export type EnhancementScriptName = keyof typeof enhancementScripts;

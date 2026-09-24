/**
 * The church website's image registry: every photograph, graphic and icon
 * the pages use, selected from the church's own WordPress media archive
 * (supplied with the redesign brief on 24 September 2026), optimised for
 * its display size and embedded as bytes so every runtime and the static
 * build serve byte-identical files.
 *
 * The optimised files also live in src/frontend/assets/media/ for human
 * inspection, with README.md mapping each one back to its original archive
 * filename. Alt text describes what an image shows; images that only
 * decorate a band carry an empty alt.
 */
import { embeddedImages, type EmbeddedImage } from "./media-bytes";

export const mediaPathPrefix = "/media/";

export interface SiteImage {
  id: MediaId;
  path: string;
  file: string;
  type: EmbeddedImage["type"];
  width: number;
  height: number;
  alt: string;
  /** Original path inside the church's media archive (YYYY/MM/filename). */
  source: string;
}

const catalogue = {
  entrance: { source: "2024/05/Saving-Grace-Bible-Church-Entrance.png", alt: "The entrance to Saving Grace Bible Church at Unit 5/217-219 Mickleham Road, Westmeadows, with the church sign above the glass doors." },
  congregation: { source: "2023/11/viber_image_2023-11-27_14-15-27-337.jpg", alt: "The congregation seated for a Lord's Day service, seen from the back of the hall." },
  fellowship: { source: "2023/12/Saving-Grace-Bible-Church-fellowship-1.jpg", alt: "A collage of church life at Saving Grace Bible Church: fellowship, meals, Bible study and worship." },
  "lords-day": { source: "2024/01/Saving-Grace-Bible-Church-Lords-Day-Service.jpg", alt: "Lord's Day Services: the congregation gathered under the church hall's roof beams." },
  merge: { source: "2023/11/SGBC-Merge.jpg", alt: "The merged congregation of Saving Grace Bible Church and East Keilor Evangelical Christian Church photographed together outside the church." },
  "early-church": { source: "2017/01/IMG20170730103903.png", alt: "The early congregation of Saving Grace Bible Church gathered in a hall in 2017." },
  wesam: { source: "2021/02/WesProfile.jpg", alt: "Pastor Wesam Saad." },
  ralph: { source: "2021/02/Ralph.jpg", alt: "Elder Ralph Gambardella." },
  "ralph-music": { source: "2023/12/Ralph-Music-Ministry-Profile-Photo.png", alt: "Ralph Gambardella, Music Ministry leader." },
  elders: { source: "2023/09/2.png", alt: "Pastor Wesam Saad and Elder Ralph Gambardella standing together." },
  tulips: { source: "2023/09/pexels-photo-10874313-removebg-preview.png", alt: "A bunch of white tulips, a reminder of the TULIP summary of Reformed doctrine." },
  books: { source: "2023/12/luaakcuanvi.jpg", alt: "" },
  "cross-sunset": { source: "2023/09/The-Gospel-2-1.jpg", alt: "" },
  "bible-rose": { source: "2023/11/1xwvmneiyky.jpg", alt: "An open Bible with a white rose resting on its pages." },
  "baptism-water": { source: "2023/11/WaterBaptism-1.png", alt: "Water, the element of believer's baptism." },
  "open-bible": { source: "2023/09/pcfjkub5bes.jpg", alt: "An open Bible resting on stones." },
  "cross-field": { source: "2023/09/Statement-of-faith-2-1.jpg", alt: "" },
  pen: { source: "2023/12/y3tl-cbu-cu.jpg", alt: "A fountain pen resting on handwritten pages." },
  "bible-shelf": { source: "2023/10/Bible-1.jpg", alt: "" },
  "bible-study-invitation": { source: "2025/08/Bible-Study-Invitation-by-Candlelight-e1754443070823.png", alt: "Saving Grace Bible Church Bible Study, Tuesdays at 7:00 PM: an open Bible beside a lantern." },
  "end-times": { source: "2025/08/SGBC-End-Times-Bible-Study-1.png", alt: "Biblical End Times: join us at Saving Grace Bible Church every Tuesday at 7:00 p.m." },
  "child-reading": { source: "2023/09/4k2lip0zc_k.jpg", alt: "A laughing child sitting on a bench with a book." },
  "good-news": { source: "2023/11/xmmsdtigsfo-e1701128615369.jpg", alt: "A poster on a wall reading Good News Is Coming." },
  "mens-ministry": { source: "2023/12/mo9vkbg5csg.jpg", alt: "A man walking with a Bible and a leather bag." },
  "womens-ministry": { source: "2023/12/u5e1kqw6e3m.jpg", alt: "Two women walking arm in arm carrying flowers." },
  "mens-bible-study": { source: "2023/12/Mens-Bible-Study.jpg", alt: "Men studying open Bibles together around a wooden table." },
  "womens-prayer": { source: "2023/12/womens-prayer-group.jpg", alt: "Women praying together with joined hands around a table." },
  teaching: { source: "2024/06/claa-z0x52w.jpg", alt: "A man in a suit holding an open Bible." },
  "worship-team": { source: "2023/12/Music-Ministry-SGBC.jpg", alt: "The Saving Grace Bible Church worship team singing and playing guitar during a service." },
  "music-sheet": { source: "2023/12/vnlzft8kcg.jpg", alt: "Sheet music." },
  "membership-roll": { source: "2023/12/yiftar2fjve.jpg", alt: "An old church membership roll book." },
  hands: { source: "2023/09/g1-kch8gzna.jpg", alt: "Several hands joined together in the centre." },
  "evening-blossom": { source: "2023/12/1ngigjt7klq.jpg", alt: "Blossom on a branch against an evening sky." },
  sunset: { source: "2023/09/Sunset-1.jpg", alt: "" },
  "old-book": { source: "2023/12/d9sarvjfhm.jpg", alt: "A well-worn old book." },
  grace: { source: "2024/01/wb_eymllxve.jpg", alt: "Wooden letter tiles spelling the word GRACE beside a bouquet of dried flowers." },
  "lit-cross": { source: "2023/11/Lordship-Salvation-1.jpg", alt: "A cross lit against a blue wall." },
  "welcome-door": { source: "2023/11/viber_image_2023-11-27_14-18-21-471-1.jpg", alt: "Members of the congregation greeting one another at the church door." },
  "fight-like-a-man": { source: "2025/01/Fight-Like-A-Man.jpg", alt: "Book cover: Fight Like a Man, a bold, biblical battle plan for personal purity, by Emeal Zwayne." },
  "blessing-of-humility": { source: "2025/01/Blessing-of-Humility-The-Bridges-Jerry.jpg", alt: "Book cover: The Blessing of Humility by Jerry Bridges." },
  "preaching-and-preachers": { source: "2024/12/PP-Martin-Loyd-Jones.png", alt: "Book cover: Preaching and Preachers by Dr Martyn Lloyd-Jones." },
  "called-to-preach": { source: "2024/06/Called-To-Preach-SGBC-e1718157549928.jpg", alt: "Book cover: Called to Preach, fulfilling the high calling of expository preaching, by Steven J. Lawson." },
  "logo-white": { source: "2023/12/SGBC-Logo-White-1.png", alt: "Saving Grace Bible Church" },
  "favicon-32": { source: "2023/11/favicon-32x32-1.png", alt: "" },
  "icon-192": { source: "2023/11/cropped-SGBC-Logo-new-no-flick-favicon-small-1-1.jpg", alt: "" }
} as const;

export type MediaId = keyof typeof catalogue;

function build(id: MediaId): SiteImage {
  const embedded = embeddedImages[id];
  if (!embedded) throw new Error(`missing embedded image ${id}`);
  const entry = catalogue[id];
  return Object.freeze({ id, path: `${mediaPathPrefix}${embedded.file}`, file: embedded.file, type: embedded.type, width: embedded.width, height: embedded.height, alt: entry.alt, source: entry.source });
}

const images = Object.fromEntries((Object.keys(catalogue) as MediaId[]).map((id) => [id, build(id)])) as Record<MediaId, SiteImage>;

export function siteImage(id: MediaId): SiteImage {
  return images[id];
}

export const siteImages: readonly SiteImage[] = Object.freeze(Object.values(images));

/** Decodes an embedded image once per request; the base64 source stays the single copy in memory. */
export function siteImageBytes(id: MediaId): Uint8Array<ArrayBuffer> {
  const binary = atob(embeddedImages[id]!.base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function siteImageByPath(path: string): SiteImage | null {
  return siteImages.find((image) => image.path === path) ?? null;
}

/** The church's own favicon and touch icon, served beside the logo. */
export const faviconPath = "/brand/favicon-32.png";
export const touchIconPath = "/brand/icon-192.png";

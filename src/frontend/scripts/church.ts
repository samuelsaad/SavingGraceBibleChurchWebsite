/** Church page enhancement: the click-to-load YouTube video and playlist plates. */
import { videoLoaderSource } from "./video-loader";

export const churchScript = `(function () {${videoLoaderSource}})();`;

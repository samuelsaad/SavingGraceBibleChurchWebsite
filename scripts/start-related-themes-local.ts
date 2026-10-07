/** Existing truthful loopback development identity; no indexing or data setup. */
import {resolve} from 'node:path';
process.env.RELATED_THEMES_EVALUATION_ENABLED='1';
process.env.RELATED_THEMES_VISITOR_ENABLED='0';
process.env.RELATED_THEMES_EVALUATION_FILE=resolve('private/related-themes/evaluation.private.json');
process.env.API_PORT??='4412';
await import('./start-sermonaudio-completed-local');
export {};

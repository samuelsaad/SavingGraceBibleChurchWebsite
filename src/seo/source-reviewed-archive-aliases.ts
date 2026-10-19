import type {ObservedSourceAlias} from './source-observed-aliases';
/** D-183: the empty WordPress taxonomy query renders the same three-post blog
 * archive. Its inherited single-post title/homepage canonical are demonstrably
 * broken. Move this exact query to the existing blog archive, never the homepage.
 */
const evidence={"reason":"equivalent_original_blog_archive","sourceResponseSha256":"96d4ab032281066f35446f97058bffe92f8a4db465b78a41959f2972d8713f3d","sourceRecordSha256":"cf75beac5564d06df2da223d6c2bdf264d212f2102fa7ed477e24ebbe0f4c387","memberPaths":["/2024/01/making-a-difference-how-churches-in-australia-influence-melbournes-community/","/2024/01/saving-grace-meaning-what-does-it-mean-to-be-saved-by-grace/","/2024/01/understanding-dispensationalism-unveiling-gods-plan-through-the-ages/"]};
export const reviewedArchiveAliases:readonly ObservedSourceAlias[]=['/?taxonomy=&term=','/?term=&taxonomy='].map(alias=>({alias,target:'/blogs/',sourceId:274,kind:'page',responseSha256:"79620e16977b5c1810ca873790fda946d89238df33feb3841e3830a05bae49c8",chain:[{urlSha256:"6a0b9cd64992e4d430b6353951c4776be2304c746456fa7421f32d092ad6acdc",recordSha256:evidence.sourceRecordSha256,status:200}],dispositionEvidence:evidence}));

import type {SourceNode} from '../domain/source-content';
/** Only captured single-term sermon archives with real primary result links. */
export function valuableOriginalTaxonomyQuery(path:string,nodes:readonly SourceNode[]):boolean{
 const url=new URL(path,'https://www.savinggrace.org.au');
 if(!/^\/sermons\/(?:page\/(?:[2-9]|[1-9][0-9]+)\/)?$/u.test(url.pathname)||[...url.searchParams].length!==1||![...url.searchParams.keys()].every(key=>['sermon_series','sermon_speaker','sermon_topics','sermon_book'].includes(key)))return false;
 const contains=(items:readonly SourceNode[]):boolean=>items.some(node=>{if(node.tag==='a'&&node.href){try{const target=new URL(node.href,url);if(['www.savinggrace.org.au','savinggrace.org.au'].includes(target.hostname)&&/^\/sermons\/(?!page\/)[^/]+\/$/u.test(target.pathname))return true;}catch{}}return contains(node.children??[]);});
 return contains(nodes);
}

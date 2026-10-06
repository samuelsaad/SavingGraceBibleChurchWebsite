/** Authenticated local display only. It makes no source/approval decision and
 * never feeds a public or restricted visitor selector. */
interface CompletedSermon {
 title:string;serviceDate:string;speaker:{name:string}|null;summary:string|null;
 transcript:{bodyText:string}|null;
 questionAnswers:Array<{question:string;answer:string;displayOrder:number}>;
 media:Array<{provider:string;canonicalUrl:string}>;
}
const escape=(x:unknown)=>String(x??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const paragraphs=(s:string)=>s.split(/\n\s*\n/gu).filter(Boolean).map(p=>'<p>'+escape(p)+'</p>').join('');
function mediaLink(provider:string,url:string){
 try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return '';
 if(provider==='youtube'&&u.hostname==='www.youtube.com'&&u.pathname==='/watch'&&/^[A-Za-z0-9_-]{11}$/u.test(u.searchParams.get('v')??''))return `<a class="button" href="${escape(u.href)}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>`;
 if(provider==='sermonaudio'&&['www.sermonaudio.com','sermonaudio.com'].includes(u.hostname)&&/^\/sermons\/[0-9]+\/?$/u.test(u.pathname)&&!u.search&&!u.hash)return `<a class="button" href="${escape(u.href)}" target="_blank" rel="noopener noreferrer">Listen on SermonAudio</a>`;
 }catch{/* omit invalid reference */}return '';
}
export function renderCompletedSermon(s:CompletedSermon){
 const links=s.media.map(m=>mediaLink(m.provider,m.canonicalUrl)).filter(Boolean);
 const date=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s.serviceDate));
 return `<header class="review-record-header"><div><a href="/admin?view=complete" data-route>Back to completed sermons</a><h1>${escape(s.title)}</h1><p>${escape(date)}${s.speaker?' · '+escape(s.speaker.name):''}</p></div><div class="review-record-status"><strong>Complete</strong></div></header>
 <article class="stack" data-completed-sermon><section class="panel"><h2>Sermon description</h2>${paragraphs(s.summary??'')}</section>
 ${links.length?`<section class="panel"><h2>Watch or listen</h2><div class="action-row">${links.join('')}</div></section>`:''}
 <section class="panel"><details><summary><strong>Transcript</strong></summary><div class="disclosure-body">${paragraphs((s.transcript?.bodyText??'').replace(/\[\s*__\s*\]/gu,'').replace(/[\t ]{2,}/gu,' '))}</div></details></section>
 <section class="panel"><h2>Questions &amp; answers</h2>${[...s.questionAnswers].sort((a,b)=>a.displayOrder-b.displayOrder).map(q=>`<section class="review-qa-card"><h3>${escape(q.question)}</h3>${paragraphs(q.answer)}</section>`).join('')}</section></article>`;
}

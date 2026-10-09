"""Capture only a frozen, already observed frontier; never expand its request set."""
from __future__ import annotations
import argparse, concurrent.futures, copy, importlib.util, json, os, re, shutil, threading, time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, parse_qsl
from urllib.request import Request, build_opener
from urllib.robotparser import RobotFileParser

SPEC=importlib.util.spec_from_file_location('source_capture',Path(__file__).with_name('seo-source-capture.py'))
CAP=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(CAP)
REASONS={'observed_only_on_nonexpanding_response_unverified':0,'source_declared_feed_variant_unverified':1,'duplicate_host_alias_unverified':2,'source_declared_shortlink_unverified':3,'generated_calendar_navigation_or_export_unverified':4}

class RateLimiter:
    def __init__(self,interval=1):self.interval=max(1,interval);self.lock=threading.Lock();self.last=0.
    def acquire(self):
        with self.lock:
            time.sleep(max(0,self.interval-(time.monotonic()-self.last)));self.last=time.monotonic()

def safe_target(url):
    parsed=urlsplit(url)
    return CAP.allowed(url) and not CAP.MEDIA_EXT.search(url) and not CAP.ASSET_EXT.search(url) and not CAP.ADMIN.search(parsed.path) and not any(k.lower() in ('action','preview','_wpnonce','add-to-cart','doing_wp_cron','replytocom') for k,v in parse_qsl(parsed.query))

def frontier(source):
    result={u:copy.deepcopy(v) for u,v in source.get('deferred',{}).items() if u not in source['pages'] and u not in source.get('excluded',{})}
    if any(not safe_target(u) for u in result):raise ValueError('fixed_frontier_contains_forbidden_target')
    if len(result)>10000:raise ValueError('fixed_frontier_exceeds_10000')
    return dict(sorted(result.items(),key=lambda kv:(REASONS.get(kv[1].get('reason'),5),kv[0])))

def verified_record(folder,summary):
    record=json.loads((folder/summary['recordPath']).read_text(encoding='utf-8'))
    body=(folder/record['responsePath']).read_bytes() if record.get('responsePath') else b''
    if body and CAP.digest(body)!=record.get('bodySha256'):raise ValueError('parent_response_hash_mismatch')
    return record,body

class FixedCapture(CAP.Capture):
    def __init__(self,output,limiter):super().__init__(output,10000,1,2);self.limiter=limiter;self.state={'pages':{},'discovered':{},'assets':{},'excluded':{},'deferred':{}}
    def get(self,url):
        if not safe_target(url):raise ValueError('fixed_request_target_refused')
        for attempt in range(3):
            self.limiter.acquire();started=time.monotonic();response=None
            try:
                try:response=self.opener.open(Request(url,headers={'User-Agent':CAP.USER_AGENT,'Accept':'text/html,application/xhtml+xml,application/xml,text/xml,text/calendar,text/plain;q=0.8','Accept-Encoding':'identity'}),timeout=25)
                except HTTPError as failure:response=failure
                status=response.status;headers={k.lower():v for k,v in response.headers.items() if k.lower() in ('content-type','location','x-robots-tag','last-modified','etag','cache-control','content-length','link','retry-after')}
                mime=headers.get('content-type','').split(';')[0].strip().lower()
                allowed=not mime or mime in ('text/html','application/xhtml+xml','application/xml','text/xml','application/rss+xml','application/atom+xml','text/calendar','text/plain')
                body=response.read(4_000_001) if allowed else b''
                result={'url':url,'status':status,'headers':headers,'capturedAt':CAP.stamp(),'attempts':attempt+1,'elapsedMs':round((time.monotonic()-started)*1000),'bodyBytes':len(body),'bodySha256':CAP.digest(body),'bodyLimitExceeded':len(body)>4_000_000,'unsupportedContentType':not allowed}
                if status in (429,502,503,504) and attempt<2:
                    pause=headers.get('retry-after','');time.sleep(min(120,max(2,int(pause))) if pause.isdigit() else 3*(attempt+1));continue
                return result,body
            except (URLError,TimeoutError,OSError):
                if attempt==2:return {'url':url,'status':None,'capturedAt':CAP.stamp(),'attempts':3,'error':'request_failed'},b''
            finally:
                if response is not None:response.close()
        raise RuntimeError('unreachable')

def create_state(source,source_file,output):
    state=copy.deepcopy(source);parent=source_file.parent.resolve()
    requests=frontier(source)
    state.update({'tool':'scripts/seo-source-frontier.py','parentLedgerSha256':CAP.digest(source_file.read_bytes()),'parentLedgerPath':os.path.relpath(source_file,output),'startedAt':CAP.stamp(),'updatedAt':CAP.stamp(),'fixedFrontier':requests,'fixedFrontierSha256':CAP.digest(json.dumps(list(requests),separators=(',',':'))),'frontierComplete':False,'completed':False,'htmlPhaseFrozen':False,'htmlPhaseComplete':False,'pendingUrls':list(requests),'fixedFrontierOutcomes':{},'newObservedUrls':{},'requestIntervalSeconds':1,'maxRetries':2,'maxConcurrency':2,'discoveryPolicy':{'coverageClaim':'all_prior_deferred_urls_requested_without_new_expansion','newUrls':'retained_as_new_observed_unrequested'}})
    return state

def run(source_file,output):
    source_file=source_file.resolve();output=output.resolve()
    if 'private' not in output.parts or output==source_file.parent:raise ValueError('new_private_output_required')
    source=json.loads(source_file.read_text(encoding='utf-8'))
    if not source.get('htmlPhaseFrozen'):raise ValueError('parent_not_frozen')
    primary_hash=CAP.digest(source_file.read_bytes());output.mkdir(parents=True,exist_ok=True)
    state_file=output/'ledger.private.json'
    if not state_file.exists():
        for name in ('pages','responses','asset-responses'):
            if (source_file.parent/name).exists():shutil.copytree(source_file.parent/name,output/name,dirs_exist_ok=True)
        if (source_file.parent/'assets-capture.private.json').exists():shutil.copy2(source_file.parent/'assets-capture.private.json',output/'parent-assets-capture.private.json')
    state=json.loads(state_file.read_text(encoding='utf-8')) if state_file.exists() else create_state(source,source_file,output)
    if state.get('parentLedgerSha256')!=primary_hash or state.get('fixedFrontierSha256')!=CAP.digest(json.dumps(list(frontier(source)),separators=(',',':'))):raise ValueError('resume_parent_or_frontier_changed')
    robots={};interval=1
    for origin in CAP.ORIGINS:
        summary=source['pages'].get(origin+'/robots.txt')
        if not summary:raise ValueError('parent_robots_missing')
        record,body=verified_record(source_file.parent,summary);rules=RobotFileParser()
        if record.get('status')==200:rules.parse(body.decode('utf-8','replace').splitlines())
        elif record.get('status') in (401,403):rules.disallow_all=True
        elif record.get('status') is None or record.get('status',0)>=500:raise ValueError('parent_robots_unavailable')
        else:rules.allow_all=True
        robots[origin]=rules;interval=max(interval,rules.crawl_delay(CAP.USER_AGENT) or rules.crawl_delay('*') or 1)
    limiter=RateLimiter(interval);local=threading.local()
    def request(url):
        if not hasattr(local,'job'):local.job=FixedCapture(output,limiter)
        job=local.job;job.state['discovered'][url]=copy.deepcopy(source['discovered'].get(url,{'sources':[]}))
        metadata,body=job.capture(url)
        return metadata,copy.deepcopy(job.state['pages'][url]),copy.deepcopy(job.state['discovered']),copy.deepcopy(job.state['assets'])
    def checkpoint(done=False):
        pending=[u for u in state['fixedFrontier'] if u not in state['fixedFrontierOutcomes']]
        state.update({'updatedAt':CAP.stamp(),'pendingUrls':pending,'frontierComplete':done and not pending,'htmlPhaseComplete':done and not pending,'htmlPhaseFrozen':done,'completed':False,'requestIntervalSeconds':interval})
        CAP.save(state_file,state)
    checkpoint()
    with CAP.network_lease(source_file.parent),CAP.network_lease(output),concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        urls=iter([u for u in state['fixedFrontier'] if u not in state['fixedFrontierOutcomes']]);active={}
        def submit():
            while len(active)<2:
                try:url=next(urls)
                except StopIteration:return
                parsed=urlsplit(url);rules=robots.get(parsed.scheme+'://'+parsed.netloc)
                if rules and not rules.can_fetch(CAP.USER_AGENT,url):
                    state['fixedFrontierOutcomes'][url]={'status':None,'outcome':'robots_disallow'};state['excluded'][url]='robots_disallow';continue
                active[executor.submit(request,url)]=url
        submit()
        while active:
            done,_=concurrent.futures.wait(active,return_when=concurrent.futures.FIRST_COMPLETED)
            for task in done:
                url=active.pop(task);metadata,summary,observed,assets=task.result();state['pages'][url]=summary
                state['fixedFrontierOutcomes'][url]={'status':metadata.get('status'),'outcome':'captured' if metadata.get('status') else 'request_failed','attempts':metadata.get('attempts')}
                state['deferred'].pop(url,None)
                for found,item in observed.items():
                    if found not in state['discovered']:
                        state['discovered'][found]=item;state['newObservedUrls'][found]={'reason':'fixed_frontier_no_new_expansion'}
                        if found not in state['pages']:state['deferred'][found]={'reason':'new_observed_fixed_frontier_no_expansion'}
                for found,item in assets.items():state['assets'].setdefault(found,item)
                if len(state['fixedFrontierOutcomes'])%25==0:print(json.dumps({'fixedRequested':len(state['fixedFrontierOutcomes']),'fixedTotal':len(state['fixedFrontier']),'newObserved':len(state['newObservedUrls'])}),flush=True)
            checkpoint();submit()
        checkpoint(done=True)
    if CAP.digest(source_file.read_bytes())!=primary_hash:raise ValueError('parent_changed_during_extension')
    print(json.dumps({'frontierComplete':state['frontierComplete'],'fixedTotal':len(state['fixedFrontier']),'fixedOutcomes':len(state['fixedFrontierOutcomes']),'newObserved':len(state['newObservedUrls']),'parentUnchanged':True}),flush=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',required=True);parser.add_argument('--output',required=True);args=parser.parse_args();run(Path(args.source),Path(args.output))
if __name__=='__main__':main()

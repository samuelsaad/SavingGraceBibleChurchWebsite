"""Freeze only new observations and later captures from a completed finite queue.

No network, database writes, URL generation or source content approval. The earlier
ledger remains immutable; this delta is additional evidence, not full coverage.
"""
from __future__ import annotations
import argparse, copy, hashlib, importlib.util, json, shutil
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('seo_verify', Path(__file__).with_name('seo-verify-candidate.py'))
V = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(V)

def load(path): return json.loads(path.read_text(encoding='utf8'))
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1048576), b''): h.update(b)
    return h.hexdigest()

def selected_urls(previous, current, assets):
    before=V.inventory(previous, assets); after=V.inventory(current, assets)
    new=set(after)-set(before)
    later={url for url,item in current.get('pages',{}).items()
           if url in before and item != previous.get('pages',{}).get(url)}
    later |= {url for url in set(after) & set(before) if after[url] != before[url]}
    return new | later, new, later

def freeze(previous_path, continuation_path, assets_path, bundle_path, output):
    paths=[Path(p).resolve() for p in (previous_path,continuation_path,assets_path,bundle_path)]
    previous_path,continuation_path,assets_path,bundle_path=paths
    if any('private' not in [x.lower() for x in p.parts] for p in paths): raise ValueError('private_source_required')
    output=Path(output).resolve()
    if 'private' not in [x.lower() for x in output.parts] or output.exists(): raise ValueError('fresh_private_output_required')
    if any(output==p.parent or output.is_relative_to(p.parent) for p in paths): raise ValueError('independent_output_required')
    witnesses={str(p):sha(p) for p in paths}
    old,current,assets,bundle=map(load,paths)
    if old.get('htmlPhaseFrozen') is not True: raise ValueError('previous_baseline_not_frozen')
    if (current.get('frontierComplete') is not True or current.get('htmlPhaseFrozen') is not True
            or current.get('pendingUrls') or set(current.get('fixedFrontier',{})) != set(current.get('fixedFrontierOutcomes',{}))):
        raise ValueError('finite_queue_not_complete')
    selected,new,later=selected_urls(old,current,assets)
    output.mkdir(parents=True,exist_ok=False)
    ledger={'tool':'scripts/seo-frontier-delta.py','updatedAt':current.get('updatedAt'),
            'completed':False,'htmlPhaseFrozen':True,'htmlPhaseComplete':True,'pendingUrls':[],
            'pages':{},'discovered':{},'assets':{},'excluded':{},'deferred':{},
            'coverageClaim':'finite_queue_delta_only_not_authoritative_whole_site_inventory'}
    files={}
    for url in sorted(selected):
        for field in ('discovered','assets','excluded','deferred'):
            if url in current.get(field,{}): ledger[field][url]=copy.deepcopy(current[field][url])
        if url not in current.get('pages',{}): continue
        summary=copy.deepcopy(current['pages'][url])
        record_path=V.confined_file(continuation_path.parent,summary['recordPath'])
        record=load(record_path)
        if record.get('url')!=url or record.get('bodySha256')!=summary.get('bodySha256'): raise ValueError('source_record_binding_invalid')
        relative='pages/'+V.digest(url)+'.json'
        if record.get('responsePath'):
            body=V.confined_file(continuation_path.parent,record['responsePath'])
            if sha(body)!=summary['bodySha256']: raise ValueError('source_body_binding_invalid')
            dest='responses/'+summary['bodySha256']+'.body'
            (output/'responses').mkdir(exist_ok=True)
            if not (output/dest).exists(): shutil.copyfile(body,output/dest)
            files[dest]=summary['bodySha256'];record['responsePath']=dest
        elif summary.get('bodySha256') not in (None,V.digest(b'')): raise ValueError('source_body_missing')
        (output/'pages').mkdir(exist_ok=True)
        V.save(output/relative,record);files[relative]=sha(output/relative)
        summary['recordPath']=relative;ledger['pages'][url]=summary
    V.save(output/'ledger.private.json',ledger);ledger_hash=sha(output/'ledger.private.json')
    delta_assets={'sourceLedgerSha256':ledger_hash,'assets':{},'remainingDependencies':{},'excludedResources':{}}
    for field in ('assets','remainingDependencies','excludedResources'):
        delta_assets[field]={u:copy.deepcopy(v) for u,v in assets.get(field,{}).items() if u in selected}
    # Newly observed asset references have no captured-byte witness. They remain
    # unresolved instead of being given an invented asset identity.
    for u in ledger['assets']:
        if u not in delta_assets['assets']: delta_assets['remainingDependencies'].setdefault(u,{'reason':'later_observed_asset_uncaptured'})
    for u,item in delta_assets['assets'].items():
        asset=V.confined_file(assets_path.parent,item['relativePath'])
        if sha(asset)!=item['sha256'] or asset.stat().st_size!=item['byteCount']: raise ValueError('retained_asset_binding_invalid')
        dest='asset-responses/'+item['sha256']+'.body'
        (output/'asset-responses').mkdir(exist_ok=True)
        if not (output/dest).exists(): shutil.copyfile(asset,output/dest)
        item['relativePath']=dest;files[dest]=item['sha256']
    V.save(output/'assets.private.json',delta_assets)
    delta_bundle=copy.deepcopy(bundle)
    delta_bundle['inventorySha256']=ledger_hash
    delta_bundle['pages']=[p for p in bundle['pages'] if p.get('sourceUrl') in selected]
    delta_bundle['expectedVersions']={p['path']:bundle.get('expectedVersions',{}).get(p['path']) for p in delta_bundle['pages']}
    V.save(output/'bundle.private.json',delta_bundle)
    if any(sha(Path(p))!=h for p,h in witnesses.items()): raise ValueError('input_changed_while_freezing')
    proof={'format':'sgbc-seo-finite-frontier-delta-v1','frozenAt':V.stamp(),
           'inputHashes':dict(zip(('previous','continuation','assets','bundle'),witnesses.values())),
           'previousBaselineSha256':witnesses[str(previous_path)],'continuationSha256':witnesses[str(continuation_path)],
           'ledgerSha256':ledger_hash,'assetsSha256':sha(output/'assets.private.json'),'bundleSha256':sha(output/'bundle.private.json'),
           'fixedQueueCount':len(current['fixedFrontier']),'fixedOutcomeCount':len(current['fixedFrontierOutcomes']),
           'totalContinuationObservedUrls':len(V.inventory(current,assets)), 'deltaRows':len(selected),
           'newObservedUrls':len(new),'laterEvidencePreviouslyObservedUrls':len(later),'deltaCapturedResponses':len(ledger['pages']),
           'uncapturedDeltaUrls':len(selected)-len(ledger['pages']),
           'copiedFiles':files,'previousReportUnchanged':True,'sourceRequests':0,'candidateChecksPerformed':False,
           'authoritativeSourceCoverageProven':False}
    V.save(output/'proof.private.json',proof)
    print(json.dumps({k:v for k,v in proof.items() if k not in ('inputHashes','copiedFiles')}))
    return proof

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for field in ('previous-baseline','continuation','assets','bundle','output'): p.add_argument('--'+field,required=True)
    a=p.parse_args();freeze(a.previous_baseline,a.continuation,a.assets,a.bundle,a.output)

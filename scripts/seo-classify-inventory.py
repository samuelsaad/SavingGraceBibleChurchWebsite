"""Classify, never delete or approve, the original acceptance denominator."""
import argparse,csv,json,hashlib,collections,re
from pathlib import Path
from urllib.parse import urlsplit,parse_qsl,urlencode,urlunsplit
def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def classify(row):
    url=row['source_url'];parts=urlsplit(url);query=parse_qsl(parts.query,keep_blank_values=True);path=parts.path
    if row['source_state'].startswith('excluded:administrative'):category='protected_control';basis='explicit_private_source_exclusion'
    elif row['source_route_family']=='external_or_withheld_reference':category='external_resource';basis='retained_resource_dependency'
    elif row['source_type']=='non_html' and row['source_status'] in ('301','302'):category='observed_redirect_alias';basis='observed_source_location'
    elif '/wp-content/' in path or row['source_state'].startswith('excluded:asset') or row['source_state']=='asset_dependency_unverified':category='owned_resource';basis='observed_resource_reference'
    elif parts.hostname=='savinggrace.org.au':category='alternate_hostname';basis='observed_alias_not_automatically_equivalent'
    elif any(k in ('p','page_id','attachment_id') for k,v in query):category='source_identity_query';basis='observed_id_query_requires_target_identity'
    elif any(k.startswith('utm_') for k,v in query):category='tracking_variant';basis='observed_campaign_variant_preserve_attribution'
    elif path.startswith(('/events/','/event/','/venue/','/organiser/','/series/')):
        category='calendar_projection' if path.startswith('/events/') or query or '/all/' in path or re.search(r'/\d{4}-\d{2}-\d{2}/',path) else 'authored_event_or_taxonomy'
        basis='observed_calendar_url_not_arbitrary_generated_date'
    elif query:category='query_or_filter';basis='observed_parameters_require_behavior_reconciliation'
    elif re.search(r'/page/\d+/',path):category='pagination';basis='observed_crawlable_pagination'
    elif row['source_status'] in ('404','429'):category='source_error';basis='observed_source_status'
    elif row['source_type']=='unverified':category='uncaptured_page';basis='no_response_witness_completeness_unproven'
    else:category='captured_public_content';basis='captured_response_content_and_metadata'
    stable=row['source_wordpress_id'] or row['retained_published_source_id']
    if stable:identity='wordpress:'+stable;identity_basis='explicit_source_identity'
    else:
        canonical=json.loads(row.get('source_canonical_urls') or '[]')
        identity='canonical-observation:'+digest(canonical[0]) if len(canonical)==1 else 'url:'+row['source_url_sha256'];identity_basis='observed_canonical_group_not_content_equivalence' if len(canonical)==1 else 'url_only'
    return {'source_url':url,'source_url_sha256':row['source_url_sha256'],'original_disposition':row['disposition'],'original_state':row['source_state'],'category':category,'classification_basis':basis,'content_group':identity,'content_group_basis':identity_basis,'source_wordpress_id':stable,'acceptance_outcome_changed':'false','remaining_issue_codes':row['unreviewed_issue_codes']}
def run(input,output):
    rows=list(csv.DictReader(input.open(encoding='utf8',newline='')));classified=[classify(r) for r in rows]
    if len({r['source_url_sha256'] for r in classified})!=len(rows):raise ValueError('original_inventory_duplicate_identity')
    with output.open('x',encoding='utf8',newline='') as file:
        writer=csv.DictWriter(file,fieldnames=list(classified[0]));writer.writeheader();writer.writerows(classified)
    unresolved=[r for r in classified if r['original_disposition']=='unresolved']
    summary={'format':'sgbc-seo-inventory-classification-v1','sourceLedgerFileSha256':hashlib.sha256(input.read_bytes()).hexdigest(),'originalRows':len(rows),'distinctUrls':len(rows),'originalDispositions':dict(collections.Counter(r['original_disposition'] for r in classified)),'unresolvedCategories':dict(collections.Counter(r['category'] for r in unresolved)),'unresolvedExplicitWordPressIdentities':len({r['source_wordpress_id'] for r in unresolved if r['source_wordpress_id']}),'unresolvedObservedGroups':len({r['content_group'] for r in unresolved}),'groupingProvesContentEquivalence':False,'outcomesChanged':0}
    output.with_suffix('.summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf8');print(json.dumps(summary))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();run(args.input,args.output)

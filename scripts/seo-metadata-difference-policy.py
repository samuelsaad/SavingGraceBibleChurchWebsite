"""Narrow mechanical metadata explanations; content/identity checks stay separate."""
import re
from urllib.parse import urlsplit, parse_qsl

FACETS = {'sermon_book', 'sermon_series', 'sermon_speaker', 'sermon_topics'}

def facet_identity(url):
    value = urlsplit(url)
    pairs = parse_qsl(value.query, keep_blank_values=True)
    if not re.fullmatch(r'/sermons/(?:page/(?:[2-9]|[1-9][0-9]+)/)?', value.path) or len(pairs) != 1:
        return None
    key, term = pairs[0]
    if key not in FACETS or not re.fullmatch(r'/?[a-z0-9-]+/?', term):
        return None
    return value.path, key, term.strip('/')

def additive_archive_signal(source, candidate, field):
    """Accept only absent optional social defaults agreeing with unchanged title."""
    old = source.get('meta', {}).get(field, [])
    new = candidate.get('meta', {}).get(field, [])
    if old or source.get('template') != 'archive' or source.get('title') != candidate.get('title'):
        return False
    if field in ('og:title', 'twitter:title'):
        return new == [source.get('title')]
    if field in ('og:description','twitter:description'):
        description=source.get('meta',{}).get('description',[])
        return len(description)==1 and bool(description[0]) and candidate.get('meta',{}).get('description',[])==description and new==description
    if field == 'og:type':
        return new == ['website']
    if field == 'twitter:card':
        return new == ['summary']
    return False

def corrected_facet_social_url(source, candidate, origin):
    old = source.get('meta', {}).get('og:url', [])
    new = candidate.get('meta', {}).get('og:url', [])
    if len(old) != 1 or len(new) != 1 or not new[0].startswith(origin + '/'):
        return False
    if source.get('template') != 'archive' or source.get('title') != candidate.get('title') or source.get('primaryHeading') and source.get('primaryHeading') != candidate.get('primaryHeading'):
        return False
    if urlsplit(old[0]).hostname not in ('www.savinggrace.org.au', 'savinggrace.org.au'):
        return False
    identity = facet_identity(source.get('url', ''))
    old_identity=facet_identity(old[0]);new_identity=facet_identity(new[0])
    return bool(identity and old_identity and new_identity==identity and old_identity[1:]==identity[1:]
                and old_identity[0] in (identity[0],'/sermons/') and candidate.get('canonicalUrls') == new)


def calendar_scope(path):
    match=re.fullmatch(r'(/events/(?:(?:category|tag)/[a-z0-9-]+/)?)(?:(?:list|month|week|day|today|summary)(?:/(?:page/[1-9][0-9]*|20[0-9]{2}-[0-9]{2}(?:-[0-9]{2})?))?/|(?:page/[1-9][0-9]*|20[0-9]{2}-[0-9]{2}(?:-[0-9]{2})?)/)?',path)
    return match[1]if match else None

def corrected_calendar_social_url(source,candidate,origin):
    old=source.get('meta',{}).get('og:url',[]);new=candidate.get('meta',{}).get('og:url',[])
    if source.get('template')!='archive' or len(old)!=1 or len(new)!=1 or source.get('title')!=candidate.get('title') or source.get('primaryHeading') and source.get('primaryHeading')!=candidate.get('primaryHeading'):
        return False
    original=urlsplit(source.get('url',''));previous=urlsplit(old[0]);current=urlsplit(new[0]);scope=calendar_scope(original.path)
    if not scope or previous.hostname not in ('www.savinggrace.org.au','savinggrace.org.au') or current.scheme+'://'+current.netloc!=origin or current.path!=original.path or current.query!=original.query or current.fragment or candidate.get('canonicalUrls')!=new:
        return False
    # The plugin used the corresponding blog taxonomy URL or calendar base.
    # Correct that conflicting signal only for this same witnessed event scope.
    equivalent_taxonomy=scope.removeprefix('/events')if scope!='/events/'else None
    return bool(not previous.query and previous.path in (scope,equivalent_taxonomy) or old==[source.get('url')])

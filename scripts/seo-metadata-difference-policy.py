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
    if source.get('template') != 'archive' or source.get('title') != candidate.get('title') or source.get('primaryHeading') != candidate.get('primaryHeading'):
        return False
    if urlsplit(old[0]).hostname not in ('www.savinggrace.org.au', 'savinggrace.org.au'):
        return False
    identity = facet_identity(source.get('url', ''))
    return bool(identity and identity == facet_identity(old[0]) == facet_identity(new[0])
                and candidate.get('canonicalUrls') == new)

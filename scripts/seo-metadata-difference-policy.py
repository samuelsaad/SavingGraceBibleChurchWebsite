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
    if field == 'og:url':
        address=urlsplit(source.get('url',''));expected='https://www.savinggrace.org.au'+address.path+('?' +address.query if address.query else '')
        return address.scheme in ('http','https')and address.hostname in ('savinggrace.org.au','www.savinggrace.org.au')and not(address.username or address.password or address.port or address.fragment)and new==[expected]and candidate.get('canonicalUrls')==new
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
    if not scope:
        venue=re.fullmatch(r'(/(?:venue|organiser)/[a-z0-9-]+/)(?:page/[1-9][0-9]*/)?',original.path)
        if venue:scope=venue[1]
        elif original.path=='/'and dict(parse_qsl(original.query)).get('post_type')=='tribe_events':
            pairs=parse_qsl(original.query,keep_blank_values=True);query=dict(pairs);allowed={'post_type','eventDisplay','eventDate','tribe-bar-date','paged','page','related_series','tag','tribe_events_cat','tribe_venue','tribe_organizer','tribe-bar-search','tribe-bar-location'}
            if len(query)!=len(pairs)or any(k not in allowed for k in query):return False
            filters=[('category',query['tribe_events_cat'])]if query.get('tribe_events_cat')else[('tag',query['tag'])]if query.get('tag')else[]
            if any(not re.fullmatch('[a-z0-9-]+',v)for _,v in filters):return False
            scope='/events/'+('/'.join(filters[0])+'/'if filters else'')
    if not scope or previous.hostname not in ('www.savinggrace.org.au','savinggrace.org.au') or current.scheme+'://'+current.netloc!=origin or current.path!=original.path or current.query!=original.query or current.fragment or candidate.get('canonicalUrls')!=new:
        return False
    # The plugin used the corresponding blog taxonomy URL or calendar base.
    # Correct that conflicting signal only for this same witnessed event scope.
    equivalent_taxonomy=scope.removeprefix('/events')if scope!='/events/'else None
    same_scope = not previous.query and previous.path in (scope,equivalent_taxonomy,original.path if original.path.startswith('/events/')else scope)
    # Captured event-tag month views used AIOSEO's empty blog-taxonomy URL.
    # Admit only that exact broken value and actual same-scope navigation links.
    links = []
    def visit(nodes):
        for node in nodes:
            if node.get('tag') == 'a' and isinstance(node.get('href'), str):
                links.append(urlsplit(node['href']))
            visit(node.get('children', []))
    visit(source.get('contentTree', []))
    empty_blog_taxonomy = bool(scope.startswith('/events/tag/') and previous.path == '/' and previous.query == 'taxonomy=&term='
        and any(link.hostname in ('www.savinggrace.org.au','savinggrace.org.au') and calendar_scope(link.path) == scope for link in links))
    return bool(same_scope or empty_blog_taxonomy or old==[source.get('url')])

def same_original_origin_variant(source, canonical_source, expected_response_sha256):
    """Extend an existing exact-source disposition only to its same-content host variant."""
    origins={'savinggrace.org.au','www.savinggrace.org.au'}
    a=urlsplit(source.get('url',''));b=urlsplit(canonical_source.get('url',''))
    if a.scheme not in ('http','https')or b.scheme!='https'or a.hostname not in origins or b.hostname!='www.savinggrace.org.au'or a.username or a.password or a.port or b.username or b.password or b.port or (a.path,a.query,a.fragment)!=(b.path,b.query,b.fragment):return False
    if not isinstance(expected_response_sha256,str)or not re.fullmatch('[a-f0-9]{64}',expected_response_sha256)or canonical_source.get('bodySha256')!=expected_response_sha256 or source.get('status')!=200 or canonical_source.get('status')!=200 or not isinstance(source.get('sourcePostId'),int)or isinstance(source.get('sourcePostId'),bool)or source['sourcePostId']<=0 or not(source.get('mainText')or source.get('mainFound')is True and source.get('contentTree')and source.get('primaryMediaReferences')):return False
    fields=('sourcePostId','template','title','primaryHeading','mainFound','semanticBlocks','mainText','headings','language','serviceDate','publishedAt','modifiedAt')
    if any(source.get(k)!=canonical_source.get(k)for k in fields):return False
    def normalized(value):
        if isinstance(value,str):
            try:parsed=urlsplit(value)
            except ValueError:return value
            if parsed.scheme in ('http','https')and parsed.hostname in origins and not(parsed.username or parsed.password or parsed.port):return 'https://www.savinggrace.org.au'+parsed.path+('?' +parsed.query if parsed.query else '')+('#'+parsed.fragment if parsed.fragment else '')
            # Jetpack embeds the requested church hostname in its path. Keep
            # the same CDN, image path and transform bytes; normalize only that
            # already verified www/apex origin variant.
            image=re.fullmatch(r'/(?:www\.)?savinggrace\.org\.au(/wp-content/uploads/[^?#]+)',parsed.path)
            if parsed.scheme=='https'and parsed.hostname in ('i0.wp.com','i1.wp.com','i2.wp.com')and image and not(parsed.username or parsed.password or parsed.port or parsed.fragment)and all(k in ('resize','fit','crop','ssl','w','h','quality','strip')for k,_ in parse_qsl(parsed.query)):
                return 'https://'+parsed.hostname+'/www.savinggrace.org.au'+image[1]+('?' +parsed.query if parsed.query else '')
            return value
        if isinstance(value,list):return [normalized(v)for v in value]
        if isinstance(value,dict):return {k:normalized(v)for k,v in value.items()}
        return value
    return all(normalized(source.get(k))==normalized(canonical_source.get(k))for k in ('meta','canonicalUrls','primaryMediaReferences','contentTree','eventMetadataTree'))


def corrected_reviewed_redirect_social_url(source,candidate,chain,origin):
    """Only the social URL consequence of an actual one-hop permanent page move.

    The acceptance caller must independently prove equivalent page identity/content.
    This helper never accepts another metadata field or invents the redirect.
    """
    def owned(value):
        u=urlsplit(value)
        return 'https://www.savinggrace.org.au'+u.path+('?' +u.query if u.query else '')if u.scheme in('http','https')and u.hostname in('savinggrace.org.au','www.savinggrace.org.au')and not(u.username or u.password or u.port or u.fragment)else None
    old=source.get('meta',{}).get('og:url',[]);new=candidate.get('meta',{}).get('og:url',[]);a=owned(source.get('url',''));b=owned(candidate.get('url',''))
    return bool(a and b and a!=b and len(chain)==2 and owned(chain[0].get('url',''))==a and chain[0].get('status')==301 and owned(chain[1].get('url',''))==b and chain[1].get('status')==200 and len(old)==1 and owned(old[0])==a and source.get('canonicalUrls')==old and new==[origin+urlsplit(b).path+('?' +urlsplit(b).query if urlsplit(b).query else '')]and candidate.get('canonicalUrls')==new)


def corrected_all_occurrences_social_url(source,candidate,origin):
    """An actual multi-occurrence collection must identify itself, not its first date."""
    old=source.get('meta',{}).get('og:url',[]);new=candidate.get('meta',{}).get('og:url',[]);address=urlsplit(source.get('url',''));current=urlsplit(candidate.get('url',''));match=re.fullmatch(r'(/event/[a-z0-9-]+/)all/',address.path)
    if not match or len(old)!=1 or len(new)!=1 or source.get('title')!=candidate.get('title')or source.get('primaryHeading')and source.get('primaryHeading')!=candidate.get('primaryHeading')or current.scheme+'://'+current.netloc!=origin or(address.path,address.query)!=(current.path,current.query)or new!=[candidate.get('url')]or candidate.get('canonicalUrls')!=new:return False
    previous=urlsplit(old[0]);parent=match[1]
    if previous.hostname not in('www.savinggrace.org.au','savinggrace.org.au')or previous.query or previous.fragment or not re.fullmatch(re.escape(parent)+r'20[0-9]{2}-[0-9]{2}-[0-9]{2}/',previous.path):return False
    dates=set()
    def visit(nodes):
        for node in nodes:
            if node.get('tag')=='a'and isinstance(node.get('href'),str):
                target=urlsplit(node['href'])
                if target.hostname in('www.savinggrace.org.au','savinggrace.org.au')and not target.query and re.fullmatch(re.escape(parent)+r'20[0-9]{2}-[0-9]{2}-[0-9]{2}/',target.path):dates.add(target.path)
            visit(node.get('children',[]))
    visit(source.get('contentTree',[]))
    if len(dates)>=2:return True
    # An empty collection still has its own previous/current collection controls
    # and scoped subscription. Those observed URLs prove collection identity;
    # a single unrelated dated link or a guessed family does not.
    controls=set()
    def collections(nodes):
        for node in nodes:
            if node.get('tag')=='a'and isinstance(node.get('href'),str):
                target=urlsplit(node['href'])
                if target.hostname in('www.savinggrace.org.au','savinggrace.org.au')and target.path==address.path and not target.fragment:
                    controls.add(target.query)
            collections(node.get('children',[]))
    collections(source.get('contentTree',[]))
    future = 'eventDisplay=past'in controls and bool({'ical=1','outlook-ical=1'}&controls)
    scoped_past_export = False
    for query in controls:
        pairs=parse_qsl(query,keep_blank_values=True);values=dict(pairs)
        if len(values)==len(pairs)==2 and values.get('eventDisplay')=='past'and (values.get('ical')=='1'or values.get('outlook-ical')=='1'):
            scoped_past_export=True
    return ''in controls and (future or address.query=='eventDisplay=past'and scoped_past_export)

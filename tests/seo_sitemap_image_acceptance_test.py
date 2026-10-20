import unittest,importlib.util,xml.etree.ElementTree as E
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'scripts/seo-verify-candidate.py';s=importlib.util.spec_from_file_location('V',p);V=importlib.util.module_from_spec(s);s.loader.exec_module(V)
class SitemapImageAcceptanceTests(unittest.TestCase):
 def test_images_are_resources_and_never_html_members(self):
  root=E.fromstring('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>https://www.savinggrace.org.au/anonymous/</loc><image:image><image:loc>https://www.savinggrace.org.au/wp-content/uploads/photo.jpg</image:loc></image:image></url></urlset>');self.assertEqual(list(V.sitemap_locations(root)),[('https://www.savinggrace.org.au/anonymous/',['https://www.savinggrace.org.au/wp-content/uploads/photo.jpg'])])
 def test_duplicate_or_missing_page_locations_fail(self):
  for body in ['<urlset><url><loc>a</loc><loc>b</loc></url></urlset>','<urlset><url/></urlset>']:
   with self.assertRaises(ValueError):list(V.sitemap_locations(E.fromstring(body)))
 def test_index_locations_do_not_expand_image_locations(self):
  root=E.fromstring('<sitemapindex><sitemap><loc>https://www.savinggrace.org.au/sitemap.xml</loc></sitemap></sitemapindex>');self.assertEqual(list(V.sitemap_locations(root)),[('https://www.savinggrace.org.au/sitemap.xml',[])])
if __name__=='__main__':unittest.main()

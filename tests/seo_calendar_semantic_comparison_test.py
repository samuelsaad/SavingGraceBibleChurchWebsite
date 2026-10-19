import importlib.util,unittest
from pathlib import Path
s=importlib.util.spec_from_file_location('calendar_compare',Path(__file__).resolve().parents[1]/'scripts/seo-calendar-semantic-comparison.py');M=importlib.util.module_from_spec(s);s.loader.exec_module(M)
def calendar(body):return 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:example\r\nDTSTART;TZID=Australia/Melbourne:20261027T180000\r\n'+body+'\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
class CalendarSemanticComparisonTest(unittest.TestCase):
 def test_wrapping_and_rfc_text_keep_all_words(self):
  a=calendar('DESCRIPTION:Example’s text\\nSecond line\r\nDTSTAMP:20261001T000000Z');b=calendar("DESCRIPTION:Example's text\r\n  Second line\r\nDTSTAMP:20261020T000000Z");self.assertTrue(M.compare(a,b)['fullyEquivalent'])
 def test_missing_uid_or_text_never_passes(self):
  a=calendar('DESCRIPTION:Every original word');self.assertFalse(M.compare(a,a.replace('original ',''))['fullyEquivalent']);self.assertFalse(M.compare(a,a.replace('UID:example','UID:different'))['fullyEquivalent'])
 def test_sequence_and_status_require_exact_published_facts(self):
  a=calendar('DESCRIPTION:Example');b=calendar('DESCRIPTION:Example\r\nSEQUENCE:3\r\nSTATUS:CONFIRMED');self.assertFalse(M.compare(a,b)['fullyEquivalent']);self.assertTrue(M.compare(a,b,{'example':{'sequence':3,'cancelled':False}})['fullyEquivalent']);self.assertFalse(M.compare(a,b,{'example':{'sequence':2,'cancelled':False}})['fullyEquivalent'])
 def test_modification_requires_actual_audit_binding(self):
  a=calendar('LAST-MODIFIED:20261001T000000Z');b=calendar('LAST-MODIFIED:20261020T000000Z');fact={'example':{'modifiedUtc':'20261020T000000Z','auditBound':False}};self.assertFalse(M.compare(a,b,fact)['fullyEquivalent']);fact['example']['auditBound']=True;self.assertTrue(M.compare(a,b,fact)['fullyEquivalent'])
 def test_location_dates_parameters_and_links_cannot_be_waived(self):
  a=calendar('LOCATION:Example, Australia\r\nURL:https://www.savinggrace.org.au/event/example/');
  for b in(a.replace(', Australia',''),a.replace('20261027T180000','20261028T180000'),a.replace('/event/example/','/'),a.replace('TZID=Australia/Melbourne','TZID=UTC')):self.assertFalse(M.compare(a,b)['fullyEquivalent'])
 def test_duplicates_and_invalid_timestamps_are_failures(self):
  a=calendar('DTSTAMP:20261001T000000Z');self.assertFalse(M.compare(a,a.replace('20261001T000000Z','20269999T999999Z'))['fullyEquivalent']);part=a.split('BEGIN:VEVENT')[1].split('END:VEVENT')[0];b=a.replace('END:VCALENDAR','BEGIN:VEVENT'+part+'END:VEVENT\r\nEND:VCALENDAR');self.assertFalse(M.compare(a,b)['fullyEquivalent'])

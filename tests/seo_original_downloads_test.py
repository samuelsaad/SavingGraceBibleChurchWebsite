"""Original resource inspection never installs, extracts or executes input."""
import importlib.util,io,pathlib,struct,unittest,zipfile
spec=importlib.util.spec_from_file_location('downloads',pathlib.Path(__file__).parents[1]/'scripts/seo-original-downloads.py');D=importlib.util.module_from_spec(spec);spec.loader.exec_module(D)
def package(name):
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w') as archive:archive.writestr(name,b'Anonymous fixture')
    # Windows ZipInfo normalizes backslashes during fixture creation. Restore
    # both raw directory/local names to exercise the actual hostile input.
    return output.getvalue().replace(name.replace(chr(92),'/').encode(),name.encode())
class OriginalDownloads(unittest.TestCase):
    def test_safe_opaque_archive_is_verified_without_extraction_or_execution(self):
        result=D.validate(package('fonts/anonymous.txt'),'application/zip');self.assertTrue(result['valid']);self.assertFalse(result['extracted']);self.assertFalse(result['executed'])
    def test_traversal_private_and_executable_archive_members_are_rejected(self):
        for name in ['../outside.txt','/outside.txt','folder\\outside.txt','C:/outside.txt','wp-config.php','.env','example.php','run.ps1']:
            with self.subTest(name=name),self.assertRaises(ValueError):D.validate(package(name),'application/zip')
    def test_an_html_error_body_is_not_accepted_as_a_font_or_archive(self):
        for mime in ['application/x-font-otf','application/zip']:
            with self.subTest(mime=mime),self.assertRaises(ValueError):D.validate(b'<html>Not found</html>',mime)
    def test_otf_directory_requires_real_bounded_named_tables(self):
        data=b'OTTO'+struct.pack('>4H',3,0,0,0)+b''.join(struct.pack('>4sIII',tag,0,60,0) for tag in [b'head',b'cmap',b'name'])
        self.assertTrue(D.validate(data,'application/x-font-otf')['valid'])
        with self.assertRaises(ValueError):D.validate(data[:-1],'application/x-font-otf')
if __name__=='__main__':unittest.main()

import hashlib,importlib.util,io,json,pathlib,tarfile,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('restore_assets',ROOT/'scripts/seo-restore-composite-assets.py');M=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(M)
class CompositeAssetRestoreTests(unittest.TestCase):
 def fixture(self,root):
  recordings=root/'recordings';recordings.mkdir();external={};expected={}
  for n in range(118):
   data=('anonymous recording '+str(n)).encode();key=hashlib.sha256(data).hexdigest()+('.mp4'if n==117 else'.mp3');(recordings/key).write_bytes(data);external['source-public/'+key]={'sha256':key.split('.')[0],'bytes':len(data)};expected['source-public/'+key]=len(data)
  data=b'anonymous ordinary file';key=hashlib.sha256(data).hexdigest()+'.pdf';expected[key]=len(data);archive=root/'ordinary.tar'
  with tarfile.open(archive,'w')as output:
   info=tarfile.TarInfo(key);info.size=len(data);output.addfile(info,io.BytesIO(data))
  coverage={'format':'sgbc-composite-asset-backup-v1','completeCoverage':True,'restoreRequiresBothParts':True,'recordingBackupManifestSha256':'10833a17ef8adb0acde739b765340a1b677463ec6b3ec5fcf4c82e945e1b46db','externalRecordings':external,'files':len(expected),'ordinaryArchiveSha256':M.digest(archive)}
  (root/'coverage.json').write_text(json.dumps(coverage));(root/'manifest.json').write_text(json.dumps(expected))
  return [archive,root/'coverage.json',root/'manifest.json',recordings,root/'private'/'restore']
 def test_restores_both_components_with_exact_identity(self):
  with tempfile.TemporaryDirectory()as d:
   args=self.fixture(pathlib.Path(d));proof=M.restore(*args);self.assertEqual((proof['files'],proof['ordinaryFiles'],proof['recordingFiles']),(119,1,118));self.assertTrue(proof['everyFileHashAndLengthMatched'])
 def test_requires_the_unchanged_recording_component_before_any_write(self):
  with tempfile.TemporaryDirectory()as d:
   args=self.fixture(pathlib.Path(d));next(args[3].iterdir()).write_bytes(b'corrupted')
   with self.assertRaisesRegex(ValueError,'asset_restore_recording_integrity'):M.restore(*args)
   self.assertFalse(args[4].exists())
 def test_refuses_archive_traversal_even_with_a_matching_archive_digest(self):
  with tempfile.TemporaryDirectory()as d:
   args=self.fixture(pathlib.Path(d))
   with tarfile.open(args[0],'w')as output:
    info=tarfile.TarInfo('../escape');info.size=1;output.addfile(info,io.BytesIO(b'x'))
   coverage=json.loads(args[1].read_text());coverage['ordinaryArchiveSha256']=M.digest(args[0]);args[1].write_text(json.dumps(coverage))
   with self.assertRaisesRegex(ValueError,'asset_restore_archive_scope'):M.restore(*args)
   self.assertFalse(args[4].exists());self.assertFalse(pathlib.Path(d,'escape').exists())
 def test_never_overwrites_an_existing_environment(self):
  with tempfile.TemporaryDirectory()as d:
   args=self.fixture(pathlib.Path(d));args[4].mkdir(parents=True);original=args[4]/'existing';original.write_bytes(b'preserve')
   with self.assertRaisesRegex(ValueError,'asset_restore_new_private_target_required'):M.restore(*args)
   self.assertEqual(original.read_bytes(),b'preserve')
if __name__=='__main__':unittest.main()

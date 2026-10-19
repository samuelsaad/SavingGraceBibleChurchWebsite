"""Restore the exact two-part D-183 asset backup into a new private directory."""
import argparse,hashlib,json,pathlib,re,shutil,tarfile
KEY=re.compile(r'(?:source-public/)?([a-f0-9]{64})\.[a-z0-9]+')

def digest(path):
 with pathlib.Path(path).open('rb')as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

def regular(path):
 path=pathlib.Path(path)
 if path.is_symlink()or not path.is_file()or any(p.is_symlink()for p in path.parents):raise ValueError('asset_restore_nonregular_source')
 return path

def restore(archive,coverage_file,manifest_file,recordings,destination):
 archive,coverage_file,manifest_file=map(regular,(archive,coverage_file,manifest_file));recordings=pathlib.Path(recordings).resolve();destination=pathlib.Path(destination).absolute()
 if 'private'not in destination.parts or destination.exists()or any(p.is_symlink()for p in destination.parents):raise ValueError('asset_restore_new_private_target_required')
 coverage=json.loads(coverage_file.read_text());expected=json.loads(manifest_file.read_text());external=coverage.get('externalRecordings',{})
 if coverage.get('format')!='sgbc-composite-asset-backup-v1'or coverage.get('completeCoverage')is not True or coverage.get('restoreRequiresBothParts')is not True or coverage.get('recordingBackupManifestSha256')!='10833a17ef8adb0acde739b765340a1b677463ec6b3ec5fcf4c82e945e1b46db'or len(external)!=118 or len(expected)!=coverage.get('files')or digest(archive)!=coverage.get('ordinaryArchiveSha256'):raise ValueError('asset_restore_binding_refused')
 if any(not KEY.fullmatch(name)or type(size)is not int or size<0 for name,size in expected.items()):raise ValueError('asset_restore_manifest_path')
 for name,value in external.items():
  if not re.fullmatch(r'source-public/[a-f0-9]{64}\.mp[34]',name)or name not in expected or expected[name]!=value['bytes']or pathlib.PurePosixPath(name).stem!=value['sha256']:raise ValueError('asset_restore_recording_scope')
  path=regular(recordings/pathlib.PurePosixPath(name).name)
  if path.stat().st_size!=value['bytes']or digest(path)!=value['sha256']:raise ValueError('asset_restore_recording_integrity')
 ordinary=set(expected)-set(external)
 with tarfile.open(archive)as source:
  members=source.getmembers()
  if len(members)!=len(ordinary)or {m.name for m in members}!=ordinary or any(not m.isfile()or m.size!=expected[m.name]for m in members):raise ValueError('asset_restore_archive_scope')
  # Validate every member before creating any destination or extracting bytes.
  for member in members:
   if hashlib.file_digest(source.extractfile(member),'sha256').hexdigest()!=pathlib.PurePosixPath(member.name).stem:raise ValueError('asset_restore_archive_integrity')
  destination.mkdir(parents=True,mode=0o700)
  for member in members:
   target=destination/pathlib.PurePosixPath(member.name);target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
   with target.open('xb')as output:shutil.copyfileobj(source.extractfile(member),output)
 for name,value in external.items():
  target=destination/pathlib.PurePosixPath(name);target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
  with regular(recordings/pathlib.PurePosixPath(name).name).open('rb')as source,target.open('xb')as output:shutil.copyfileobj(source,output)
 actual={p.relative_to(destination).as_posix():p.stat().st_size for p in destination.rglob('*')if p.is_file()}
 if actual!=expected or any(digest(destination/name)!=pathlib.PurePosixPath(name).stem for name in expected):raise ValueError('asset_restore_final_integrity')
 return {'format':'sgbc-composite-asset-restoration-v1','completeCoverage':True,'files':len(expected),'ordinaryFiles':len(ordinary),'recordingFiles':len(external),'bytes':sum(expected.values()),'archiveSha256':digest(archive),'coverageSha256':digest(coverage_file),'manifestSha256':digest(manifest_file),'everyFileHashAndLengthMatched':True,'destinationPreviouslyAbsent':True}

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 for name in ['archive','coverage','manifest','recordings','destination','output']:parser.add_argument('--'+name,required=True)
 a=parser.parse_args();result=restore(a.archive,a.coverage,a.manifest,a.recordings,a.destination)
 out=pathlib.Path(a.output)
 if 'private'not in out.absolute().parts or out.exists():raise ValueError('asset_restore_private_result_required')
 out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':main()

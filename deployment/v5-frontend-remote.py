"""Code-only V5 delivery to the existing public staging runtime.

No imports, migrations, selector changes or database writes. Protected runtime
and existing public socket are preserved. Diagnostics contain fixed codes only.
"""
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import subprocess
import sys
import tarfile

PREVIOUS = 'c919ae038d0bbcefff31eb10e3013d61cc27ca82'
PREVIOUS_IMAGE = 'sha256:df751abeb61bf162bac2bc0d898faae2d57b02a2db4f52b77480281052d0247d'
PUBLIC = 'savinggrace-staging-app-1'
PROTECTED = 'savinggrace-d167-protected-app-1'
HELPER_SHA = '43dd96fc79b98944f5aed7089c5e520e5c4c025c3522a985d359dd8162b00b14'

def fail(code):
    raise RuntimeError(code)

def run(args, output=None):
    result = subprocess.run(args, stdout=output or subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        fail('guarded_command_failed')
    return result.stdout

def save(path, value):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, sort_keys=True)
    path.chmod(0o600)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def candidate_config(original, commit, image):
    result = json.loads(json.dumps(original))
    if set(result['services']) != {'app'}:
        fail('service_scope_changed')
    app = result['services']['app']
    if app['environment'].get('RELEASE_COMMIT') != PREVIOUS:
        fail('previous_release_changed')
    if app['environment'].get('ENABLE_LOCAL_TEST_IDENTITIES') or app['environment'].get('ENABLE_LOCAL_DASHBOARD'):
        fail('remote_identity_refused')
    app['image'] = image
    app['environment']['RELEASE_COMMIT'] = commit
    return result

def retained_helper():
    path = pathlib.Path('/home/ec2-user/.d175-transfer') / PREVIOUS / 'operator.py'
    if path.is_symlink() or sha(path) != HELPER_SHA:
        fail('verified_helper_changed')
    spec = importlib.util.spec_from_file_location('retained_operator', path)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    helper.verify_host()
    return helper

def probe(container, commit):
    script = """(async()=>{const assert=require('node:assert/strict');const get=async p=>{const r=await fetch('http://127.0.0.1:8080'+p,{headers:{connection:'close'},signal:AbortSignal.timeout(60000)});return r;};const h=await get('/health/ready');assert.equal(h.status,200);assert((await h.text()).includes(process.argv[1]));const list=await get('/api/v1/sermons?pageSize=1');assert.equal(list.status,200);assert.equal((await list.json()).pagination.totalItems,398);const page=await get('/sermons-v5/');assert.equal(page.status,200);assert.match(page.headers.get('cache-control'),/no-store/);assert.match(page.headers.get('x-robots-tag'),/noindex/);const html=await page.text();assert(html.includes('id=\"v5-shelf\"'));assert(!html.includes('id=\"v5-shelf\" data-fold open'));assert.equal((html.match(/<article class=\"journal__entry/g)||[]).length,9);assert(!/<iframe[^>]*\\ssrc=/.test(html));for(const p of ['/admin','/frontend-preview/','/draft-preview/'])assert([401,403,404].includes((await get(p)).status));console.log(JSON.stringify({outcome:'verified',eligible:398,v5:true,privateRoutesDenied:true,noStoreNoindex:true}));})().catch(()=>{console.log(JSON.stringify({outcome:'failed',code:'runtime_probe_failed'}));process.exitCode=1;});"""
    value = json.loads(run(['docker', 'exec', container, 'node', '-e', script, commit]))
    if value.get('outcome') != 'verified':
        fail('runtime_probe_failed')
    return value

def main():
    if os.geteuid() != 0 or len(sys.argv) < 3:
        fail('operator_arguments_refused')
    operation, commit = sys.argv[1:3]
    if not re.fullmatch(r'[a-f0-9]{40}', commit):
        fail('commit_refused')
    helper = retained_helper()
    root = pathlib.Path('/opt/savinggrace-v5') / commit
    incoming = pathlib.Path('/home/ec2-user/.v5-transfer') / commit
    protected = helper.inspect(PROTECTED)
    if protected['Image'] != PREVIOUS_IMAGE or protected['State']['Health']['Status'] != 'healthy':
        fail('protected_runtime_changed')
    if operation == 'prepare':
        if len(sys.argv) != 4 or root.exists():
            fail('existing_release_or_arguments')
        expected = sys.argv[3]
        if not re.fullmatch(r'[a-f0-9]{64}', expected) or sha(incoming / 'release.tar') != expected:
            fail('release_hash_mismatch')
        info = helper.inspect(PUBLIC)
        if info['Image'] != PREVIOUS_IMAGE or info['State']['Health']['Status'] != 'healthy':
            fail('public_runtime_changed')
        original = json.loads(pathlib.Path(info['Config']['Labels']['com.docker.compose.project.config_files']).read_text())
        image = 'savinggrace-impeccable:' + commit
        candidate = candidate_config(original, commit, image)
        before = helper.database_hash()
        root.mkdir(mode=0o700, parents=True)
        with (root / 'release.tar').open('xb') as stream:
            stream.write((incoming / 'release.tar').read_bytes())
        source = root / 'release'
        source.mkdir(mode=0o700)
        with tarfile.open(root / 'release.tar') as archive:
            helper.safe_archive(archive)
            archive.extractall(source)
        digests = [v for v in helper.inspect('node:24-bookworm-slim')['RepoDigests'] if v.startswith('node@sha256:')]
        if len(digests) != 1:
            fail('immutable_base_unavailable')
        with (root / 'build.log').open('xb') as log:
            run(['docker', 'build', '--build-arg', 'NODE_IMAGE=' + digests[0], '--build-arg', 'RELEASE_COMMIT=' + commit, '-t', image, str(source)], log)
        if helper.database_hash() != before:
            fail('database_changed_during_build')
        save(root / 'public-previous.json', original)
        save(root / 'public-candidate.json', candidate)
        canary = json.loads(json.dumps(candidate))
        canary['name'] = 'savinggrace-v5-canary-' + commit[:12]
        app = canary['services']['app']
        for key in ['ports', 'container_name']:
            app.pop(key, None)
        if run(['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=' + canary['name']]).strip():
            fail('canary_project_occupied')
        save(root / 'canary.json', canary)
        save(root / 'recovery.json', {'commit': commit, 'previousCommit': PREVIOUS, 'previousImage': PREVIOUS_IMAGE, 'newImage': helper.inspect(image)['Id'], 'packageSha256': expected, 'databaseFingerprint': before, 'protectedImage': protected['Image'], 'dataWrites': 0})
        print(json.dumps({'outcome': 'prepared', 'commit': commit, 'image': helper.inspect(image)['Id'], 'databaseUnchanged': True, 'dataWrites': 0}))
    elif operation == 'canary':
        recovery = json.loads((root / 'recovery.json').read_text())
        before = helper.database_hash()
        run(['docker', 'compose', '-f', str(root / 'canary.json'), 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'app'])
        container = run(['docker', 'compose', '-f', str(root / 'canary.json'), 'ps', '-q', 'app']).decode().strip()
        try:
            if helper.inspect(container)['HostConfig']['PortBindings']:
                fail('canary_exposed_port')
            result = probe(container, commit)
            if helper.database_hash() != before or before != recovery['databaseFingerprint']:
                fail('canary_database_changed')
            save(root / 'canary-verified.json', result)
        finally:
            run(['docker', 'compose', '-f', str(root / 'canary.json'), 'down'])
        print(json.dumps({'outcome': 'canary_verified', 'eligible': 398, 'publicUntouched': True, 'databaseUnchanged': True}))
    elif operation in ['activate', 'rollback', 'reactivate']:
        if operation != 'rollback' and not (root / 'canary-verified.json').is_file():
            fail('canary_verification_required')
        recovery = json.loads((root / 'recovery.json').read_text())
        before = helper.database_hash()
        suffix, expected = ('previous', PREVIOUS) if operation == 'rollback' else ('candidate', commit)
        helper.compose(root / ('public-' + suffix + '.json'))
        helper.ready(8080, expected)
        if operation != 'rollback':
            probe(PUBLIC, commit)
        current = helper.inspect(PUBLIC)
        wanted_image = recovery['previousImage'] if operation == 'rollback' else recovery['newImage']
        if current['Image'] != wanted_image or helper.database_hash() != before or before != recovery['databaseFingerprint']:
            fail('release_or_database_changed')
        if helper.inspect(PROTECTED)['Image'] != recovery['protectedImage']:
            fail('protected_runtime_changed')
        print(json.dumps({'outcome': operation, 'commit': expected, 'image': current['Image'], 'databaseUnchanged': True, 'protectedUnchanged': True, 'dataWrites': 0}))
    else:
        fail('operation_refused')

if __name__ == '__main__':
    try:
        os.umask(0o077)
        main()
    except Exception as error:
        code = str(error) if isinstance(error, RuntimeError) and re.fullmatch(r'[a-z_]+', str(error)) else 'operator_failed_safely'
        print(json.dumps({'outcome': 'stopped_safely', 'code': code}))
        sys.exit(1)

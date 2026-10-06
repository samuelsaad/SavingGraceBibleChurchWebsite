"""Bounded D-175 operator. Exact existing runtimes; append-only scoped data.

Run only through the pinned SSH identity on the authorized staging host. Never
emit environment values, row bodies, secrets or raw command errors. Rollback
restores both prior application selectors/images and retains new audited rows.
"""
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tarfile
import time
import urllib.request

PUBLIC = 'savinggrace-staging-app-1'
PROTECTED = 'savinggrace-d167-protected-app-1'
DB = 'savinggrace-d167-protected-db-1'
NETWORK = 'savinggrace-d167-protected_private'
PRIOR_COMMIT = 'd5b772f3dacb3678d73478abdf72bbf70030c72d'
PRIOR_IMAGE = 'sha256:f7c5889b417ffcb5894e18808334fae71a1c595ff729e8bf1d326393aa29de68'
MANIFEST = 'a4fa3627682043c4b06aa65ddbebdab75f1fc29aec93e2d250bda537d9b0cd2b'
MEMBERSHIP = '4e3455c92d604f4e44999e56922e15359dc7bfa8a6d912c6d36e2a39a9f048c3'

def fail(code):
    raise RuntimeError(code)

def run(args, output=None):
    result = subprocess.run(args, stdout=output or subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        fail('command_failed_' + pathlib.Path(args[0]).name)
    return result.stdout

def inspect(name):
    return json.loads(run(['docker', 'inspect', name]))[0]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def save(path, value):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, sort_keys=True)
    path.chmod(0o600)

def cohort_bytes(path):
    if path.is_symlink() or not path.is_file():
        fail('previous_cohort_refused')
    data = path.read_bytes()
    value = json.loads(data)
    ids = value.get('ids', [])
    if set(value) != {'decision', 'ids'} or value['decision'] != 'D-171' or len(ids) != 279 or len(set(ids)) != 279:
        fail('previous_cohort_refused')
    if any(not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', identity) for identity in ids):
        fail('previous_cohort_refused')
    if hashlib.sha256(('\n'.join(sorted(ids)) + '\n').encode()).hexdigest() != MEMBERSHIP:
        fail('previous_cohort_refused')
    return data

def verify_host():
    request = urllib.request.Request('http://169.254.169.254/latest/api/token', data=b'', method='PUT', headers={'X-aws-ec2-metadata-token-ttl-seconds': '60'})
    token = urllib.request.urlopen(request, timeout=5).read().decode()
    request = urllib.request.Request('http://169.254.169.254/latest/meta-data/instance-id', headers={'X-aws-ec2-metadata-token': token})
    if urllib.request.urlopen(request, timeout=5).read().decode() != 'i-0f7abc9421733e79c':
        fail('instance_identity_changed')

def database_hash():
    names = run(['docker', 'exec', DB, 'psql', '-U', 'postgres', '-d', 'savinggrace_staging', '-At', '-c', "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"]).decode().splitlines()
    if any(not re.fullmatch(r'[a-z_][a-z0-9_]*', name) for name in names):
        fail('table_name_refused')
    sql = "SET timezone='UTC';" + ''.join("SELECT '%s',count(*),encode(digest(COALESCE(string_agg(h,'' ORDER BY h COLLATE \"C\"),''),'sha256'),'hex') FROM (SELECT encode(digest(to_jsonb(t)::text,'sha256'),'hex') h FROM \"%s\" t) hashes;" % (name, name) for name in names)
    return hashlib.sha256(run(['docker', 'exec', DB, 'psql', '-U', 'postgres', '-d', 'savinggrace_staging', '-At', '-c', sql])).hexdigest()

def ready(port, commit):
    for _ in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:%d/health/ready' % port, timeout=5) as response:
                if commit in json.dumps(json.loads(response.read())):
                    return
        except Exception:
            pass
        time.sleep(2)
    fail('readiness_failed')

def compose(path):
    run(['docker', 'compose', '-f', str(path), 'up', '-d', '--no-deps', 'app'])

def safe_archive(archive):
    for item in archive.getmembers():
        path = pathlib.PurePosixPath(item.name)
        if path.is_absolute() or '..' in path.parts or not (item.isfile() or item.isdir()):
            fail('unsafe_archive_member')
        if any(part in path.parts for part in ['private', 'development-data', '.git', 'youtube-oath']):
            fail('private_archive_member')

def main():
    if os.geteuid() != 0 or len(sys.argv) < 3:
        fail('operator_arguments_refused')
    operation, commit = sys.argv[1:3]
    if not re.fullmatch(r'[a-f0-9]{40}', commit):
        fail('commit_refused')
    verify_host()
    root = pathlib.Path('/opt/savinggrace-d175') / commit
    incoming = pathlib.Path('/home/ec2-user/.d175-transfer') / commit
    if operation == 'prepare':
        if root.exists() or len(sys.argv) != 5:
            fail('existing_release_or_hash_arguments')
        for name, expected in zip(['release.tar', 'source.private.json'], sys.argv[3:]):
            path = incoming / name
            if not re.fullmatch(r'[a-f0-9]{64}', expected) or path.is_symlink() or not path.is_file() or sha(path) != expected:
                fail('transfer_hash_mismatch')
        packet = json.loads((incoming / 'source.private.json').read_text())
        if packet.get('manifestSha256') != MANIFEST or len(packet.get('ids', [])) != 119:
            fail('packet_scope_refused')
        db = inspect(DB)
        if db['HostConfig']['PortBindings'] or list(db['NetworkSettings']['Networks']) != [NETWORK]:
            fail('database_network_refused')
        if not json.loads(run(['docker', 'network', 'inspect', NETWORK]))[0]['Internal']:
            fail('database_network_not_private')
        configs = {}
        retained_cohort = None
        for name, container in [('public', PUBLIC), ('protected', PROTECTED)]:
            info = inspect(container)
            if info['Image'] != PRIOR_IMAGE or info['State'].get('Health', {}).get('Status') != 'healthy':
                fail('unexpected_running_image')
            config = json.loads(pathlib.Path(info['Config']['Labels']['com.docker.compose.project.config_files']).read_text())
            if set(config['services']) != {'app'} or config['services']['app']['environment'].get('RELEASE_COMMIT') != PRIOR_COMMIT:
                fail('configuration_scope_refused')
            env = config['services']['app']['environment']
            if env.get('ENABLE_LOCAL_TEST_IDENTITIES') or env.get('ENABLE_LOCAL_DASHBOARD') or env.get('D175_COMPLETED_ENABLED'):
                fail('unexpected_identity_or_selector')
            configs[name] = config
            mounts = [mount for mount in info['Mounts'] if mount['Destination'] == env.get('D171_COHORT_FILE')]
            if len(mounts) != 1 or mounts[0]['RW']:
                fail('previous_cohort_mount_refused')
            data = cohort_bytes(pathlib.Path(mounts[0]['Source']))
            if retained_cohort is not None and data != retained_cohort:
                fail('previous_cohort_runtime_conflict')
            retained_cohort = data
        root.mkdir(mode=0o700, parents=True)
        for name in ['release.tar', 'source.private.json']:
            with (root / name).open('xb') as stream:
                stream.write((incoming / name).read_bytes())
            (root / name).chmod(0o600)
        with (root / 'cohort.private.json').open('xb') as stream:
            stream.write(retained_cohort)
        for name, config in configs.items():
            save(root / (name + '-previous.json'), config)
        before = database_hash()
        source_dir = root / 'release'
        source_dir.mkdir(mode=0o700)
        with tarfile.open(root / 'release.tar') as archive:
            safe_archive(archive)
            archive.extractall(source_dir)
        digests = [value for value in inspect('node:24-bookworm-slim')['RepoDigests'] if value.startswith('node@sha256:')]
        if len(digests) != 1:
            fail('immutable_node_base_unavailable')
        image = 'savinggrace-impeccable:' + commit
        with (root / 'build.log').open('xb') as log:
            run(['docker', 'build', '--build-arg', 'NODE_IMAGE=' + digests[0], '--build-arg', 'RELEASE_COMMIT=' + commit, '-t', image, str(source_dir)], log)
        if database_hash() != before:
            fail('concurrent_staging_change')
        output = root / 'output'
        output.mkdir(mode=0o700)
        maintenance = {'name': 'savinggrace-d175-maintenance', 'services': {'maintenance': {
            'image': image, 'user': '0:0', 'entrypoint': ['node', 'sermonaudio-completion-sync.cjs'], 'read_only': True,
            'environment': {'NODE_ENV': 'production', 'STAGING_SEALED': '1', 'DB_HOST': 'db', 'DB_PORT': '5432', 'DB_NAME': 'savinggrace_staging', 'RELEASE_COMMIT': commit, 'ALLOW_STAGING_D175_SYNC': '1', 'D175_TARGET': 'existing-protected'},
            'secrets': ['db_owner_password'], 'networks': ['completed'], 'cap_drop': ['ALL'], 'security_opt': ['no-new-privileges:true'],
            'volumes': [str(root / 'source.private.json') + ':/verification/source.private.json:ro', str(root / 'cohort.private.json') + ':/verification/cohort.private.json:ro', str(output) + ':/verification/output:rw']}},
            'networks': {'completed': {'external': True, 'name': NETWORK}}, 'secrets': {'db_owner_password': configs['protected']['secrets']['db_owner_password']}}
        save(root / 'maintenance.json', maintenance)
        for name, original in configs.items():
            candidate = json.loads(json.dumps(original))
            app = candidate['services']['app']
            app['image'] = image
            app['environment'].update({'RELEASE_COMMIT': commit, 'D175_COMPLETED_ENABLED': '1'})
            save(root / (name + '-candidate.json'), candidate)
        save(root / 'recovery.json', {'commit': commit, 'previousCommit': PRIOR_COMMIT, 'previousImage': PRIOR_IMAGE, 'newImage': inspect(image)['Id'], 'beforeDatabaseHash': before, 'packetFileSha256': sha(root / 'source.private.json'), 'packetSha256': packet['sha256'], 'releaseSha256': sha(root / 'release.tar'), 'cohortSha256': sha(root / 'cohort.private.json'), 'rollback': 'prior_application_images_and_selectors_retain_all_audited_rows'})
        print(json.dumps({'outcome': 'prepared', 'image': inspect(image)['Id'], 'databaseUnchanged': True, 'packetTargets': 119}))
    elif operation in ['baseline', 'plan', 'import', 'verify']:
        output = run(['docker', 'compose', '-f', str(root / 'maintenance.json'), 'run', '--rm', '--no-deps', 'maintenance', operation])
        values = []
        for line in output.decode().splitlines():
            value = json.loads(line)
            if not isinstance(value, dict) or 'outcome' not in value:
                fail('maintenance_output_refused')
            values.append(value)
        if operation == 'verify' and (values[-1].get('outcome') != 'verified' or values[-1].get('ready') != 119 or values[-1].get('failed') or values[-1].get('conflicted')):
            fail('complete_verification_required')
        save(root / 'output' / (operation + '-' + str(time.time_ns()) + '.receipt.json'), values)
        for value in values:
            print(json.dumps(value))
    elif operation in ['activate', 'rollback', 'reactivate']:
        recovery = json.loads((root / 'recovery.json').read_text())
        if operation != 'rollback' and not list((root / 'output').glob('verify-*.receipt.json')):
            fail('verified_data_required')
        before = database_hash()
        suffix, expected = ('previous', PRIOR_COMMIT) if operation == 'rollback' else ('candidate', commit)
        compose(root / ('protected-' + suffix + '.json'))
        ready(8082, expected)
        compose(root / ('public-' + suffix + '.json'))
        ready(8080, expected)
        if database_hash() != before:
            fail('application_restart_changed_database')
        print(json.dumps({'outcome': operation, 'commit': expected, 'bothHealthy': True, 'databaseUnchanged': True, 'image': recovery['previousImage'] if operation == 'rollback' else recovery['newImage']}))
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

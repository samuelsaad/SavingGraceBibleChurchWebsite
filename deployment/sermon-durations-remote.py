"""Guarded duration-only maintenance and existing staging application delivery.

The caller must use the pinned SSH host. This operator independently checks the
instance and exact incumbent releases. Private duration evidence is mounted only
into maintenance, never the visitor app or image. It emits aggregate diagnostics.
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
import time

PUBLIC = 'savinggrace-staging-app-1'
PROTECTED = 'savinggrace-d167-protected-app-1'
DB = 'savinggrace-d167-protected-db-1'
NETWORK = 'savinggrace-d167-protected_private'
PREVIOUS = {
    'public': {'commit': 'fc34ae2ca722ac046b0523c76e19fa85882fae66',
               'image': 'sha256:544f56f6c0c1fa696a4a858623b357d4862a75ac1108f877dbc05a8445d3fc88'},
    'protected': {'commit': 'c919ae038d0bbcefff31eb10e3013d61cc27ca82',
                  'image': 'sha256:df751abeb61bf162bac2bc0d898faae2d57b02a2db4f52b77480281052d0247d'},
}
HELPER_SHA = '43dd96fc79b98944f5aed7089c5e520e5c4c025c3522a985d359dd8162b00b14'
COUNT_FIELDS = {'total', 'matched', 'updated', 'unchanged', 'unavailable', 'conflicting',
                'failed', 'eligibleBefore', 'eligibleAfter', 'skipped', 'targets', 'checked',
                'alreadyCorrect', 'refreshedAcceptances', 'pending', 'sermons', 'eligible', 'ready', 'rolled_back'}
BOOL_FIELDS = {'inventoryUnchanged', 'idempotent', 'verified', 'recoverySaved', 'dataUnchanged',
               'preservationVerified', 'contentPreserved', 'eligibilityPreserved', 'detailsSuppressed'}
HASH_FIELDS = {'sha256', 'beforeSha256', 'afterSha256', 'packetSha256', 'receiptHash',
               'baselineHash', 'packetHash', 'beforeFingerprint', 'afterFingerprint',
               'baselineSha256', 'receiptSha256'}
STATUS_FIELDS = {'outcome', 'code'}


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


def protected_file(path):
    if path.is_symlink() or not path.is_file():
        fail('protected_file_refused')
    return path


def checked_json(path):
    return json.loads(protected_file(path).read_text())


def retained_helper():
    path = pathlib.Path('/home/ec2-user/.d175-transfer') / PREVIOUS['protected']['commit'] / 'operator.py'
    if path.is_symlink() or not path.is_file() or sha(path) != HELPER_SHA:
        fail('verified_helper_changed')
    spec = importlib.util.spec_from_file_location('retained_duration_helper', path)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    helper.verify_host()
    return helper


def candidate_config(original, runtime, commit, image):
    if runtime not in PREVIOUS:
        fail('runtime_refused')
    result = json.loads(json.dumps(original))
    if set(result.get('services', {})) != {'app'}:
        fail('service_scope_changed')
    app = result['services']['app']
    env = app.get('environment', {})
    if env.get('RELEASE_COMMIT') != PREVIOUS[runtime]['commit']:
        fail('previous_release_changed')
    if env.get('ENABLE_LOCAL_TEST_IDENTITIES') or env.get('ENABLE_LOCAL_DASHBOARD'):
        fail('remote_identity_refused')
    if env.get('DB_NAME') != 'savinggrace_staging' or str(env.get('DB_PORT')) != '5432':
        fail('database_scope_changed')
    if env.get('STAGING_SEALED') != '1' or env.get('D175_COMPLETED_ENABLED') != '1':
        fail('selector_or_sealed_guard_changed')
    app['image'] = image
    env['RELEASE_COMMIT'] = commit
    return result


def canary_config(candidate, runtime, commit):
    result = json.loads(json.dumps(candidate))
    result['name'] = 'savinggrace-duration-canary-' + runtime + '-' + commit[:12]
    app = result['services']['app']
    for key in ['ports', 'container_name']:
        app.pop(key, None)
    for value in app.get('networks', {}).values():
        if isinstance(value, dict):
            value.pop('ipv4_address', None)
            value.pop('ipv6_address', None)
    return result


def safe_summary(value):
    """A maintenance error cannot disclose raw provider messages or row values."""
    if not isinstance(value, dict) or 'outcome' not in value:
        fail('maintenance_output_refused')
    if not set(value) <= COUNT_FIELDS | BOOL_FIELDS | HASH_FIELDS | STATUS_FIELDS | {'counts'}:
        fail('maintenance_output_refused')
    for key, item in value.items():
        if key in COUNT_FIELDS and (type(item) is not int or item < 0):
            fail('maintenance_output_refused')
        if key in BOOL_FIELDS and type(item) is not bool:
            fail('maintenance_output_refused')
        if key in HASH_FIELDS and (not isinstance(item, str) or not re.fullmatch(r'[a-f0-9]{64}', item)):
            fail('maintenance_output_refused')
        if key in STATUS_FIELDS and (not isinstance(item, str) or not re.fullmatch(r'[a-z][a-z_]{0,79}', item)):
            fail('maintenance_output_refused')
        if key == 'counts' and (not isinstance(item, dict) or not set(item) <= COUNT_FIELDS
                                or any(type(number) is not int or number < 0 for number in item.values())):
            fail('maintenance_output_refused')
    return value


def maintenance_result(args):
    # A partial, checkpointed operation deliberately exits 1. Preserve only its
    # validated counts/status instead of replacing them with a generic error.
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode not in [0, 1]:
        fail('guarded_command_failed')
    values = [safe_summary(json.loads(line)) for line in result.stdout.decode().splitlines() if line.strip()]
    if not values or result.returncode and values[-1]['outcome'] not in ['partial', 'stopped_safely']:
        fail('maintenance_output_refused')
    return values, result.returncode


def membership_state():
    # Publication and identity are independent of any duration/receipt changes.
    sql = """BEGIN READ ONLY; SET LOCAL timezone='UTC';
      SELECT json_build_object('stored',count(*),'membershipSha256',
        encode(digest(COALESCE(string_agg(jsonb_build_array(id,status,published_at)::text,
        E'\\n' ORDER BY id),''),'sha256'),'hex')) FROM sermons; COMMIT;"""
    output = run(['docker', 'exec', DB, 'psql', '-X', '-q', '-U', 'postgres', '-d',
                  'savinggrace_staging', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql])
    value = json.loads(output)
    if (set(value) != {'stored', 'membershipSha256'} or type(value['stored']) is not int
            or not re.fullmatch(r'[a-f0-9]{64}', value['membershipSha256'])):
        fail('membership_result_refused')
    return value


def probe(container, commit, expected_count):
    script = """(async()=>{const assert=require('node:assert/strict');const get=async p=>fetch('http://127.0.0.1:8080'+p,{headers:{connection:'close'},signal:AbortSignal.timeout(60000)});const health=await get('/health/ready');assert.equal(health.status,200);assert((await health.text()).includes(process.argv[1]));const listing=await get('/api/v1/sermons?pageSize=1');assert.equal(listing.status,200);const count=(await listing.json()).pagination.totalItems;assert.equal(count,Number(process.argv[2]));const page=await get('/sermons-v5/');assert.equal(page.status,200);assert.match(page.headers.get('cache-control'),/no-store/);assert.match(page.headers.get('x-robots-tag'),/noindex/);const html=await page.text();assert(html.includes('id=\"v5-shelf\"'));assert(!/<iframe[^>]*\\ssrc=/.test(html));for(const p of ['/admin','/frontend-preview/','/draft-preview/'])assert([401,403,404].includes((await get(p)).status));console.log(JSON.stringify({outcome:'verified',eligible:count}));})().catch(()=>{console.log(JSON.stringify({outcome:'failed',code:'runtime_probe_failed'}));process.exitCode=1;});"""
    value = json.loads(run(['docker', 'exec', container, 'node', '-e', script, commit, str(expected_count)]))
    if value != {'outcome': 'verified', 'eligible': expected_count}:
        fail('runtime_probe_failed')
    return value


def eligible_count(container):
    script = """(async()=>{const r=await fetch('http://127.0.0.1:8080/api/v1/sermons?pageSize=1',{signal:AbortSignal.timeout(60000),headers:{connection:'close'}});if(r.status!==200)throw Error();const n=(await r.json()).pagination.totalItems;if(!Number.isInteger(n)||n<1)throw Error();process.stdout.write(JSON.stringify({eligible:n}));})().catch(()=>{process.exitCode=1;});"""
    value = json.loads(run(['docker', 'exec', container, 'node', '-e', script]))
    if set(value) != {'eligible'} or type(value['eligible']) is not int:
        fail('eligible_count_refused')
    return value['eligible']


def maintenance_config(root, image, original, commit):
    owner = original.get('secrets', {}).get('db_owner_password')
    if not isinstance(owner, dict) or set(owner) != {'file'} or not pathlib.PurePosixPath(owner['file']).is_absolute():
        fail('owner_secret_reference_refused')
    return {'name': 'savinggrace-duration-maintenance', 'services': {'maintenance': {
        'image': image, 'user': '0:0', 'entrypoint': ['node', 'sermon-durations-sync.cjs'],
        'read_only': True, 'environment': {'NODE_ENV': 'production', 'STAGING_SEALED': '1', 'RELEASE_COMMIT': commit,
            'DB_HOST': 'db', 'DB_PORT': '5432', 'DB_NAME': 'savinggrace_staging',
            'ALLOW_STAGING_DURATION_SYNC': '1', 'ALLOW_STAGING_SERMON_DURATION_SYNC': '1',
            'DURATION_TARGET': 'existing-protected', 'D171_COHORT_FILE': '/verification/cohort.private.json'},
        'secrets': ['db_owner_password'], 'networks': ['existing'], 'cap_drop': ['ALL'],
        'security_opt': ['no-new-privileges:true'], 'volumes': [
            str(root / 'durations.private.json') + ':/verification/durations.private.json:ro',
            str(root / 'cohort.private.json') + ':/verification/cohort.private.json:ro',
            str(root / 'output') + ':/verification/output:rw']}},
        'networks': {'existing': {'external': True, 'name': NETWORK}},
        'secrets': {'db_owner_password': owner}}


def verify_database_network(helper):
    info = helper.inspect(DB)
    if info['HostConfig']['PortBindings'] or list(info['NetworkSettings']['Networks']) != [NETWORK]:
        fail('database_network_refused')
    if not json.loads(run(['docker', 'network', 'inspect', NETWORK]))[0]['Internal']:
        fail('database_network_not_private')


def main():
    if os.geteuid() != 0 or len(sys.argv) < 3:
        fail('operator_arguments_refused')
    operation, commit = sys.argv[1:3]
    if not re.fullmatch(r'[a-f0-9]{40}', commit):
        fail('commit_refused')
    helper = retained_helper()
    verify_database_network(helper)
    root = pathlib.Path('/opt/savinggrace-durations') / commit
    incoming = pathlib.Path('/home/ec2-user/.duration-transfer') / commit
    if operation == 'prepare':
        if len(sys.argv) != 5 or root.exists():
            fail('existing_release_or_arguments')
        for name, expected in zip(['release.tar', 'durations.private.json'], sys.argv[3:]):
            path = protected_file(incoming / name)
            if not re.fullmatch(r'[a-f0-9]{64}', expected) or sha(path) != expected:
                fail('transfer_hash_mismatch')
        configurations, eligible = {}, {}
        retained_cohort = None
        for runtime, container in [('public', PUBLIC), ('protected', PROTECTED)]:
            info = helper.inspect(container)
            if info['Image'] != PREVIOUS[runtime]['image'] or info['State'].get('Health', {}).get('Status') != 'healthy':
                fail('incumbent_runtime_changed')
            original = checked_json(pathlib.Path(info['Config']['Labels']['com.docker.compose.project.config_files']))
            candidate_config(original, runtime, commit, 'validation-only')
            cohort_destination = original['services']['app']['environment'].get('D171_COHORT_FILE')
            cohort_mounts = [mount for mount in info['Mounts'] if mount['Destination'] == cohort_destination]
            if len(cohort_mounts) != 1 or cohort_mounts[0]['RW']:
                fail('existing_cohort_mount_refused')
            cohort = helper.cohort_bytes(pathlib.Path(cohort_mounts[0]['Source']))
            if retained_cohort is not None and retained_cohort != cohort:
                fail('existing_runtime_cohorts_differ')
            retained_cohort = cohort
            configurations[runtime] = original
            eligible[runtime] = eligible_count(container)
        before, membership = helper.database_hash(), membership_state()
        root.mkdir(mode=0o700, parents=True)
        for name in ['release.tar', 'durations.private.json']:
            with (root / name).open('xb') as stream:
                stream.write((incoming / name).read_bytes())
            (root / name).chmod(0o600)
        with (root / 'cohort.private.json').open('xb') as stream:
            stream.write(retained_cohort)
        (root / 'cohort.private.json').chmod(0o600)
        source = root / 'release'
        source.mkdir(mode=0o700)
        with tarfile.open(root / 'release.tar') as archive:
            helper.safe_archive(archive)
            archive.extractall(source)
        digests = [value for value in helper.inspect('node:24-bookworm-slim')['RepoDigests'] if value.startswith('node@sha256:')]
        if len(digests) != 1:
            fail('immutable_base_unavailable')
        image = 'savinggrace-impeccable:' + commit
        with (root / 'build.log').open('xb') as log:
            run(['docker', 'build', '--build-arg', 'NODE_IMAGE=' + digests[0], '--build-arg',
                 'RELEASE_COMMIT=' + commit, '-t', image, str(source)], log)
        if helper.database_hash() != before or membership_state() != membership:
            fail('database_changed_during_build')
        (root / 'output').mkdir(mode=0o700)
        for runtime, original in configurations.items():
            candidate = candidate_config(original, runtime, commit, image)
            save(root / (runtime + '-previous.json'), original)
            save(root / (runtime + '-candidate.json'), candidate)
            canary = canary_config(candidate, runtime, commit)
            if run(['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=' + canary['name']]).strip():
                fail('canary_project_occupied')
            save(root / (runtime + '-canary.json'), canary)
        save(root / 'maintenance.json', maintenance_config(root, image, configurations['protected'], commit))
        save(root / 'recovery.json', {'commit': commit, 'previous': PREVIOUS,
             'newImage': helper.inspect(image)['Id'], 'packageSha256': sys.argv[3],
             'packetFileSha256': sys.argv[4], 'cohortSha256': sha(root / 'cohort.private.json'), 'databaseFingerprint': before,
             'membership': membership, 'eligible': eligible,
             'rollback': 'prior_images_before_data_changes_else_scoped_duration_recovery_required'})
        print(json.dumps({'outcome': 'prepared', 'commit': commit, 'image': helper.inspect(image)['Id'],
                          'databaseUnchanged': True, 'stored': membership['stored'], 'eligible': eligible}))
        return

    recovery = checked_json(root / 'recovery.json')
    if recovery.get('commit') != commit or sha(protected_file(root / 'durations.private.json')) != recovery['packetFileSha256']:
        fail('recovery_or_packet_changed')
    if sha(protected_file(root / 'cohort.private.json')) != recovery['cohortSha256']:
        fail('existing_cohort_changed')
    if membership_state() != recovery['membership']:
        fail('membership_or_publication_changed')
    if operation == 'canary':
        before = helper.database_hash()
        results = {}
        for runtime in ['public', 'protected']:
            config = root / (runtime + '-canary.json')
            try:
                run(['docker', 'compose', '-f', str(config), 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'app'])
                container = run(['docker', 'compose', '-f', str(config), 'ps', '-q', 'app']).decode().strip()
                if helper.inspect(container)['HostConfig']['PortBindings']:
                    fail('canary_exposed_port')
                results[runtime] = probe(container, commit, recovery['eligible'][runtime])
            finally:
                run(['docker', 'compose', '-f', str(config), 'down'])
        if helper.database_hash() != before:
            fail('canary_database_changed')
        save(root / 'canary-verified.json', results)
        print(json.dumps({'outcome': 'canary_verified', 'databaseUnchanged': True, 'eligible': recovery['eligible']}))
    elif operation in ['baseline', 'plan', 'apply', 'verify', 'rollback-data']:
        before = helper.database_hash()
        if operation in ['apply', 'rollback-data'] and not list((root / 'output').glob('baseline-*.receipt.json')):
            fail('scoped_recovery_required')
        if operation == 'apply' and not list((root / 'output').glob('plan-*.receipt.json')):
            fail('reviewable_plan_required')
        values, result_code = maintenance_result(['docker', 'compose', '-f', str(root / 'maintenance.json'), 'run', '--rm', '--no-deps', 'maintenance', operation])
        if membership_state() != recovery['membership']:
            fail('membership_or_publication_changed')
        after = helper.database_hash()
        if operation in ['baseline', 'plan', 'verify'] and after != before:
            fail('read_only_operation_changed_database')
        prefix = 'failure-' + operation if values[-1]['outcome'] == 'stopped_safely' else operation
        save(root / 'output' / (prefix + '-' + str(time.time_ns()) + '.receipt.json'), values)
        for value in values:
            print(json.dumps(value))
        if result_code:
            sys.exit(result_code)
    elif operation in ['activate', 'rollback', 'reactivate']:
        if operation != 'rollback' and not (root / 'canary-verified.json').is_file():
            fail('canary_verification_required')
        before = helper.database_hash()
        # A prior image may not recognize the fresh audited duration receipts.
        # Never restore it merely because its container can start successfully.
        if operation == 'rollback' and before != recovery['databaseFingerprint']:
            fail('rollback_requires_duration_recovery')
        suffix = 'previous' if operation == 'rollback' else 'candidate'
        for runtime, container, port in [('protected', PROTECTED, 8082), ('public', PUBLIC, 8080)]:
            expected = PREVIOUS[runtime]['commit'] if operation == 'rollback' else commit
            wanted_image = PREVIOUS[runtime]['image'] if operation == 'rollback' else recovery['newImage']
            helper.compose(root / (runtime + '-' + suffix + '.json'))
            helper.ready(port, expected)
            if helper.inspect(container)['Image'] != wanted_image:
                fail('running_image_changed')
            if operation != 'rollback':
                probe(container, commit, recovery['eligible'][runtime])
            elif eligible_count(container) != recovery['eligible'][runtime]:
                fail('rollback_eligibility_changed')
        if helper.database_hash() != before or membership_state() != recovery['membership']:
            fail('application_restart_changed_database')
        print(json.dumps({'outcome': operation, 'commit': commit if operation != 'rollback' else None,
                          'bothHealthy': True, 'databaseUnchanged': True, 'eligible': recovery['eligible']}))
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

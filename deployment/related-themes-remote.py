"""Existing staging only: compatible code, additive schema and private indexes.

Invoke through the pinned SSH connection. Ordinary Related themes stays disabled;
only the existing protected tunnel runtime receives evaluation material. Never
print a row, vector, description, credential, configuration value or raw error.
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
PREVIOUS_COMMIT = 'e12c28196179c155aca98a73b2fcd2daed6ee116'
PREVIOUS_IMAGE = 'sha256:c1ee9ee3cab01e159d7889b7f009e8332c4f0ad1e5130b08db85935b4a748f6b'
CONFIG_HASHES = {
    'public': '07749b6650ec631fee1b278c4db263efeabb71f1ff4a76a40eea18fb92b18d49',
    'protected': '28e701d2683803ddef497eaf8c7a7fd676fc8885418a7cc2ebcd3f401f62f2ac',
}
HELPER_COMMIT = 'c919ae038d0bbcefff31eb10e3013d61cc27ca82'
HELPER_SHA = '43dd96fc79b98944f5aed7089c5e520e5c4c025c3522a985d359dd8162b00b14'
TABLES = ('accepted_description_semantic_vectors', 'accepted_description_semantic_builds',
          'accepted_description_semantic_members', 'accepted_description_semantic_active')
INPUTS = ('release.tar', 'public-index.private.json', 'protected-index.private.json')
COUNT_FIELDS = {'stored', 'eligible', 'sources', 'indexed', 'excluded', 'vectors', 'relationships',
                'created', 'unchanged', 'matched', 'skipped', 'conflicting', 'failed', 'checked',
                'schemaReceipts', 'previous', 'current', 'restored', 'removed', 'total', 'anchors'}
HASH_FIELDS = {'sha256', 'beforeSha256', 'afterSha256', 'packetSha256', 'baselineSha256',
               'buildFingerprint', 'corpusSha256', 'pipelineFingerprint', 'preservationSha256', 'evaluationFingerprint'}
BOOL_FIELDS = {'verified', 'idempotent', 'contentPreserved', 'eligibilityPreserved',
               'inventoryUnchanged', 'recoverySaved', 'visitorEnabled', 'evaluationEnabled'}


def fail(code):
    raise RuntimeError(code)


def run(args, output=None, timeout=180):
    result = subprocess.run(args, stdout=output or subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        fail('guarded_command_failed')
    return result.stdout


def protected_file(path):
    if path.is_symlink() or not path.is_file():
        fail('protected_file_refused')
    return path


def sha(path):
    return hashlib.sha256(protected_file(path).read_bytes()).hexdigest()


def checked_json(path):
    return json.loads(protected_file(path).read_text())


def save(path, value):
    with path.open('x', encoding='utf8') as stream:
        json.dump(value, stream, sort_keys=True)
    path.chmod(0o600)


def save_unchanged(path, value):
    if path.exists():
        if checked_json(path) != value:
            fail('existing_receipt_changed')
        return
    save(path, value)


def helper():
    path = pathlib.Path('/home/ec2-user/.d175-transfer') / HELPER_COMMIT / 'operator.py'
    if sha(path) != HELPER_SHA:
        fail('verified_helper_changed')
    spec = importlib.util.spec_from_file_location('retained_related_themes_helper', path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    value.verify_host()
    return value


def sql_read(sql):
    wrapped = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL statement_timeout='30s';" + sql + ';COMMIT;'
    return run(['docker', 'exec', DB, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'savinggrace_staging',
                '-At', '-v', 'ON_ERROR_STOP=1', '-c', wrapped])


def identity_and_network(retained):
    info = retained.inspect(DB)
    if info['HostConfig']['PortBindings'] or sorted(info['NetworkSettings']['Networks']) != [NETWORK]:
        fail('database_network_refused')
    if not json.loads(run(['docker', 'network', 'inspect', NETWORK]))[0]['Internal']:
        fail('database_network_not_private')
    value = json.loads(sql_read("SELECT json_build_object('database',current_database(),'version',current_setting('server_version_num')::integer,'port',inet_server_port())"))
    # psql's local socket has no inet_server_port; the existing container/network
    # identity is verified independently above, and all maintenance uses TCP.
    if value['database'] != 'savinggrace_staging' or not 160000 <= value['version'] < 170000:
        fail('database_identity_refused')


def preservation_state():
    names = sql_read("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").decode().splitlines()
    if any(not re.fullmatch(r'[a-z_][a-z0-9_]*', name) for name in names):
        fail('table_identity_refused')
    names = [name for name in names if name not in TABLES and name != 'schema_migrations']
    statements = []
    for name in names:
        statements.append("SELECT '%s',count(*),encode(digest(COALESCE(string_agg(h,'' ORDER BY h COLLATE \"C\"),''),'sha256'),'hex') FROM (SELECT encode(digest(to_jsonb(t)::text,'sha256'),'hex') h FROM \"%s\" t) hashes" % (name, name))
    result = sql_read(';'.join(statements))
    membership = json.loads(sql_read("SELECT json_build_object('stored',count(*),'sha256',encode(digest(COALESCE(string_agg(jsonb_build_array(id,source_wordpress_id,status,published_at)::text,E'\\n' ORDER BY id),''),'sha256'),'hex')) FROM sermons"))
    return {'sha256': hashlib.sha256(result).hexdigest(), 'tables': len(names), 'membership': membership}


def semantic_state():
    present = sql_read("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('" + "','".join(TABLES) + "') ORDER BY tablename").decode().splitlines()
    if present and set(present) != set(TABLES):
        fail('partial_semantic_schema_refused')
    result = {}
    for name in present:
        result[name] = json.loads(sql_read("SELECT json_build_object('count',count(*),'sha256',encode(digest(COALESCE(string_agg(h,'' ORDER BY h COLLATE \"C\"),''),'sha256'),'hex')) FROM (SELECT encode(digest(to_jsonb(t)::text,'sha256'),'hex') h FROM \"%s\" t) hashes" % name))
    return result


def scoped_backup(root):
    state = semantic_state()
    if state:
        path = root / 'semantic-before.dump'
        with path.open('xb') as stream:
            run(['docker', 'exec', DB, 'pg_dump', '-U', 'postgres', '-d', 'savinggrace_staging',
                 '--format=custom', '--data-only', '--no-owner', '--no-acl',
                 *[argument for name in TABLES for argument in ['--table', 'public.' + name]]], stream)
        path.chmod(0o600)
        dump_sha = sha(path)
    else:
        dump_sha = None
    save(root / 'semantic-before.private.json', {'tables': state, 'dumpSha256': dump_sha,
         'recovery': 'restore_exact_previous_active_pointers_without_deleting_immutable_history'})
    return state


def safe_summary(value):
    allowed = COUNT_FIELDS | HASH_FIELDS | BOOL_FIELDS | {'outcome', 'code', 'environment', 'counts'}
    if not isinstance(value, dict) or 'outcome' not in value or not set(value) <= allowed:
        fail('maintenance_output_refused')
    for key, item in value.items():
        if key in COUNT_FIELDS and (type(item) is not int or item < 0):
            fail('maintenance_output_refused')
        if key in HASH_FIELDS and (not isinstance(item, str) or not re.fullmatch(r'[a-f0-9]{64}', item)):
            fail('maintenance_output_refused')
        if key in BOOL_FIELDS and type(item) is not bool:
            fail('maintenance_output_refused')
        if key in {'outcome', 'code'} and (not isinstance(item, str) or not re.fullmatch(r'[a-z][a-z_]{0,79}', item)):
            fail('maintenance_output_refused')
        if key == 'environment' and item not in ['staging_public', 'staging_protected']:
            fail('maintenance_output_refused')
        if key == 'counts' and (not isinstance(item, dict) or not set(item) <= COUNT_FIELDS or any(type(n) is not int or n < 0 for n in item.values())):
            fail('maintenance_output_refused')
    return value


def maintenance_result(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
    if result.returncode not in [0, 1]:
        fail('guarded_command_failed')
    values = [safe_summary(json.loads(line)) for line in result.stdout.decode().splitlines() if line.strip()]
    if not values or result.returncode and values[-1]['outcome'] not in ['partial', 'stopped_safely']:
        fail('maintenance_output_refused')
    return values, result.returncode


def candidate_config(original, runtime, commit, image, root, evaluation=False):
    if runtime not in ['public', 'protected'] or not re.fullmatch(r'[a-f0-9]{40}', commit):
        fail('runtime_or_commit_refused')
    result = json.loads(json.dumps(original))
    if set(result.get('services', {})) != {'app'}:
        fail('service_scope_changed')
    app = result['services']['app']
    env = app.get('environment', {})
    if env.get('RELEASE_COMMIT') != PREVIOUS_COMMIT:
        fail('previous_release_changed')
    if env.get('ENABLE_LOCAL_TEST_IDENTITIES') or env.get('ENABLE_LOCAL_DASHBOARD'):
        fail('remote_identity_refused')
    if env.get('DB_NAME') != 'savinggrace_staging' or str(env.get('DB_PORT')) != '5432':
        fail('database_scope_changed')
    if env.get('STAGING_SEALED') != '1' or env.get('D175_COMPLETED_ENABLED') != '1':
        fail('selector_or_sealed_guard_changed')
    if runtime == 'public' and evaluation:
        fail('public_evaluation_refused')
    app['image'] = image
    env['RELEASE_COMMIT'] = commit
    env['RELATED_THEMES_VISITOR_ENABLED'] = '0'
    env['RELATED_THEMES_EVALUATION_ENABLED'] = '1' if evaluation else '0'
    env['RELATED_THEMES_ENVIRONMENT'] = 'staging_' + runtime
    if evaluation:
        env['RELATED_THEMES_ACCESS'] = 'protected_tunnel'
        env['RELATED_THEMES_EVALUATION_FILE'] = '/run/related-themes/evaluation.private.json'
        app.setdefault('volumes', []).append({'type': 'bind', 'source': str(root / 'evaluation-runtime.private.json'),
            'target': '/run/related-themes/evaluation.private.json', 'read_only': True})
    else:
        env.pop('RELATED_THEMES_ACCESS', None)
        env.pop('RELATED_THEMES_EVALUATION_FILE', None)
    return result


def canary_config(candidate, runtime, commit):
    result = json.loads(json.dumps(candidate))
    result['name'] = 'savinggrace-themes-canary-' + runtime + '-' + commit[:12]
    app = result['services']['app']
    app.pop('ports', None)
    app.pop('container_name', None)
    for value in app.get('networks', {}).values():
        if isinstance(value, dict):
            value.pop('ipv4_address', None)
            value.pop('ipv6_address', None)
    return result


def maintenance_config(root, image, original, commit, runtime):
    if runtime not in ['public', 'protected']:
        fail('runtime_refused')
    owner = original.get('secrets', {}).get('db_owner_password')
    if (not isinstance(owner, dict) or set(owner) not in [{'file'}, {'file', 'name'}]
            or not isinstance(owner.get('file'), str) or not pathlib.PurePosixPath(owner['file']).is_absolute()
            or 'name' in owner and not re.fullmatch(r'[a-zA-Z0-9_.-]+', str(owner['name']))):
        fail('owner_secret_reference_refused')
    return {'name': 'savinggrace-themes-maintenance-' + runtime, 'services': {'maintenance': {
        'image': image, 'user': '0:0', 'entrypoint': ['node', 'related-themes-sync.cjs'],
        'read_only': True, 'environment': {'NODE_ENV': 'production', 'STAGING_SEALED': '1',
            'RELEASE_COMMIT': commit, 'DB_HOST': 'db', 'DB_PORT': '5432', 'DB_NAME': 'savinggrace_staging',
            'ALLOW_STAGING_RELATED_THEMES_SYNC': '1', 'RELATED_THEMES_TARGET': 'existing-protected',
            'RELATED_THEMES_ENVIRONMENT': 'staging_' + runtime, 'D171_COHORT_FILE': '/verification/cohort.private.json'},
        'secrets': ['db_owner_password'], 'networks': ['existing'], 'cap_drop': ['ALL'],
        'security_opt': ['no-new-privileges:true'], 'volumes': [
            str(root / (runtime + '-index.private.json')) + ':/verification/related-themes.private.json:ro',
            str(root / 'cohort.private.json') + ':/verification/cohort.private.json:ro',
            str(root / ('output-' + runtime)) + ':/verification/output:rw']}},
        'networks': {'existing': {'external': True, 'name': NETWORK}}, 'secrets': {'db_owner_password': owner}}


def verified_database_owner(retained, configurations):
    """Both runtimes use the protected shared DB, not the old public DB owner.

    Compare protected references privately; never print secret bytes or hashes.
    Existing ownership, permissions and maintenance capabilities are unchanged.
    """
    db = retained.inspect(DB)
    env = dict(value.split('=', 1) for value in db['Config']['Env'] if '=' in value)
    destination = env.get('POSTGRES_PASSWORD_FILE')
    mounts = [value for value in db['Mounts'] if value['Destination'] == destination]
    if len(mounts) != 1 or mounts[0]['RW']:
        fail('database_owner_mount_refused')
    original = configurations['protected']
    reference = original.get('secrets', {}).get('db_owner_password', {})
    if not isinstance(reference.get('file'), str):
        fail('database_owner_reference_refused')
    intended = protected_file(pathlib.Path(reference['file']))
    mounted = protected_file(pathlib.Path(mounts[0]['Source']))
    if hashlib.sha256(intended.read_bytes()).digest() != hashlib.sha256(mounted.read_bytes()).digest():
        fail('database_owner_reference_mismatch')
    return original


def repair_maintenance_owner(retained, root, recovery, commit):
    configurations = {name: checked_json(root / (name + '-previous.json')) for name in ['public', 'protected']}
    owner = verified_database_owner(retained, configurations)
    outcomes = {}
    planned = {}
    for runtime in ['public', 'protected']:
        image = checked_json(root / (runtime + '-bridge.json'))['services']['app']['image']
        before = maintenance_config(root, image, configurations[runtime], commit, runtime)
        after = maintenance_config(root, image, owner, commit, runtime)
        path = root / (runtime + '-maintenance.json')
        current = checked_json(path)
        if current == after:
            outcomes[runtime] = 'unchanged'
            continue
        if current != before:
            fail('unexpected_maintenance_configuration')
        planned[runtime] = (current, after)
    # Validate both runtimes before changing either task-owned config.
    for runtime, (current, after) in planned.items():
        path = root / (runtime + '-maintenance.json')
        if checked_json(path) != current:
            fail('concurrent_maintenance_configuration')
        save_unchanged(root / (runtime + '-maintenance-owner-before.json'), current)
        temporary = root / (runtime + '-maintenance-owner-corrected.tmp')
        save(temporary, after)
        os.replace(temporary, path)
        outcomes[runtime] = 'corrected'
    if preservation_state() != recovery['preservation']:
        fail('owner_repair_changed_database')
    save_unchanged(root / 'maintenance-owner-repair.json', {
        'outcome': 'owner_reference_corrected', 'commit': commit,
        'operatorSha256': sha(pathlib.Path(__file__)), 'secretPermissionsUnchanged': True,
        'maintenanceIdentityUnchanged': True, 'sharedDatabaseOwnerVerified': True})
    return {'outcome': 'owner_reference_verified', 'corrected': sum(value == 'corrected' for value in outcomes.values()),
            'unchanged': sum(value == 'unchanged' for value in outcomes.values()), 'contentPreserved': True}


def safe_archive(archive):
    total = 0
    for item in archive.getmembers():
        path = pathlib.PurePosixPath(item.name)
        if path.is_absolute() or '..' in path.parts or not (item.isfile() or item.isdir()):
            fail('unsafe_archive_member')
        if (any(part in path.parts for part in ['private', 'development-data', '.git', 'youtube-oath', 'node_modules'])
                or '.private.' in item.name or path.name.startswith('.env')
                or path.suffix.lower() in ['.pem', '.key', '.onnx', '.dump', '.bin']):
            fail('private_archive_member')
        total += item.size
    if total > 250_000_000:
        fail('package_size_refused')


def runtime_probe(container, commit, expected_count, evaluation):
    script = """(async()=>{const a=require('node:assert/strict');const get=p=>fetch('http://127.0.0.1:8080'+p,{headers:{connection:'close'},signal:AbortSignal.timeout(60000)});const h=await get('/health/ready');a.equal(h.status,200);a((await h.text()).includes(process.argv[1]));const l=await get('/api/v1/sermons?pageSize=1');a.equal(l.status,200);a.equal((await l.json()).pagination.totalItems,Number(process.argv[2]));const v=await get('/sermons-v5/');a.equal(v.status,200);a.match(v.headers.get('cache-control'),/no-store/);a.match(v.headers.get('x-robots-tag'),/noindex/);for(const p of ['/admin','/frontend-preview/','/draft-preview/'])a([401,403,404].includes((await get(p)).status));const e=await get('/related-themes-evaluation/');if(process.argv[3]==='1'){a.equal(e.status,200);a.match(e.headers.get('cache-control'),/no-store/);a.match(e.headers.get('x-robots-tag'),/noindex/);}else a([401,403,404].includes(e.status));console.log(JSON.stringify({outcome:'verified',eligible:Number(process.argv[2]),evaluationEnabled:process.argv[3]==='1',visitorEnabled:false}));})().catch(()=>{console.log(JSON.stringify({outcome:'stopped_safely',code:'runtime_probe_failed'}));process.exitCode=1;});"""
    return safe_summary(json.loads(run(['docker', 'exec', container, 'node', '-e', script, commit,
                                       str(expected_count), '1' if evaluation else '0'])))


def eligible_count(container):
    script = """(async()=>{const r=await fetch('http://127.0.0.1:8080/api/v1/sermons?pageSize=1',{signal:AbortSignal.timeout(60000)});if(r.status!==200)throw Error();const n=(await r.json()).pagination.totalItems;if(!Number.isInteger(n)||n<1)throw Error();console.log(JSON.stringify({eligible:n}));})().catch(()=>process.exitCode=1);"""
    value = json.loads(run(['docker', 'exec', container, 'node', '-e', script]))
    if set(value) != {'eligible'} or type(value['eligible']) is not int:
        fail('eligible_count_refused')
    return value['eligible']


def verify_current_runtimes(retained, root, recovery, require_compatible=False):
    for runtime, container in [('public', PUBLIC), ('protected', PROTECTED)]:
        info = retained.inspect(container)
        allowed_images = [recovery['newImage']] if require_compatible else [PREVIOUS_IMAGE, recovery['newImage']]
        if info['Image'] not in allowed_images:
            fail('concurrent_runtime_changed')
        current = checked_json(pathlib.Path(info['Config']['Labels']['com.docker.compose.project.config_files']))
        permitted = ['bridge', 'candidate'] if require_compatible else ['previous', 'bridge', 'candidate']
        if not any(current == checked_json(root / (runtime + '-' + name + '.json')) for name in permitted):
            fail('concurrent_configuration_changed')


def main():
    if os.geteuid() != 0 or len(sys.argv) < 3:
        fail('operator_arguments_refused')
    operation, commit = sys.argv[1:3]
    if not re.fullmatch(r'[a-f0-9]{40}', commit):
        fail('commit_refused')
    retained = helper()
    identity_and_network(retained)
    root = pathlib.Path('/opt/savinggrace-related-themes') / commit
    incoming = pathlib.Path('/home/ec2-user/.related-themes-transfer') / commit
    if operation == 'prepare':
        if len(sys.argv) != 6 or root.exists():
            fail('existing_release_or_arguments')
        hashes = dict(zip(INPUTS, sys.argv[3:]))
        for name, expected in hashes.items():
            if not re.fullmatch(r'[a-f0-9]{64}', expected) or sha(incoming / name) != expected:
                fail('transfer_hash_mismatch')
        configurations, counts, cohort_bytes = {}, {}, None
        for runtime, container in [('public', PUBLIC), ('protected', PROTECTED)]:
            info = retained.inspect(container)
            if info['Image'] != PREVIOUS_IMAGE or info['State'].get('Health', {}).get('Status') != 'healthy':
                fail('incumbent_runtime_changed')
            path = pathlib.Path(info['Config']['Labels']['com.docker.compose.project.config_files'])
            if sha(path) != CONFIG_HASHES[runtime]:
                fail('incumbent_configuration_changed')
            original = checked_json(path)
            candidate_config(original, runtime, commit, 'validation-only', root)
            cohort_target = original['services']['app']['environment'].get('D171_COHORT_FILE')
            mounts = [m for m in info['Mounts'] if m['Destination'] == cohort_target]
            if len(mounts) != 1 or mounts[0]['RW']:
                fail('existing_cohort_mount_refused')
            data = retained.cohort_bytes(pathlib.Path(mounts[0]['Source']))
            if cohort_bytes is not None and data != cohort_bytes:
                fail('existing_runtime_cohorts_differ')
            cohort_bytes = data
            configurations[runtime], counts[runtime] = original, eligible_count(container)
        before = preservation_state()
        root.mkdir(mode=0o700, parents=True)
        for name in INPUTS:
            with (root / name).open('xb') as stream:
                stream.write((incoming / name).read_bytes())
            (root / name).chmod(0o600)
        with (root / 'cohort.private.json').open('xb') as stream:
            stream.write(cohort_bytes)
        (root / 'cohort.private.json').chmod(0o600)
        scoped_backup(root)
        source = root / 'release'
        source.mkdir(mode=0o700)
        with tarfile.open(root / 'release.tar') as archive:
            safe_archive(archive)
            archive.extractall(source)
        digests = [v for v in retained.inspect('node:24-bookworm-slim')['RepoDigests'] if v.startswith('node@sha256:')]
        if len(digests) != 1:
            fail('immutable_base_unavailable')
        image = 'savinggrace-related-themes:' + commit
        with (root / 'build.log').open('xb') as log:
            run(['docker', 'build', '--build-arg', 'NODE_IMAGE=' + digests[0], '--build-arg',
                 'RELEASE_COMMIT=' + commit, '-t', image, str(source)], log, timeout=900)
        owner_configuration = verified_database_owner(retained, configurations)
        for runtime, original in configurations.items():
            (root / ('output-' + runtime)).mkdir(mode=0o700)
            save(root / (runtime + '-previous.json'), original)
            bridge = candidate_config(original, runtime, commit, image, root)
            candidate = candidate_config(original, runtime, commit, image, root, runtime == 'protected')
            for name, value in [('bridge', bridge), ('candidate', candidate),
                                ('bridge-canary', canary_config(bridge, runtime, commit)),
                                ('canary', canary_config(candidate, runtime, commit))]:
                save(root / (runtime + '-' + name + '.json'), value)
            save(root / (runtime + '-maintenance.json'), maintenance_config(root, image, owner_configuration, commit, runtime))
        if preservation_state() != before:
            fail('incumbent_data_changed_during_prepare')
        save(root / 'recovery.json', {'commit': commit, 'previousCommit': PREVIOUS_COMMIT,
             'previousImage': PREVIOUS_IMAGE, 'newImage': retained.inspect(image)['Id'], 'inputHashes': hashes,
             'cohortSha256': sha(root / 'cohort.private.json'), 'preservation': before, 'eligible': counts,
             'rollback': 'feature_off_schema_compatible_bridge_and_previous_active_pointer;retain_history'})
        print(json.dumps({'outcome': 'prepared', 'commit': commit, 'image': retained.inspect(image)['Id'],
                          'stored': before['membership']['stored'], 'eligible': counts, 'visitorEnabled': False}))
        return
    recovery = checked_json(root / 'recovery.json')
    if recovery.get('commit') != commit or sha(root / 'cohort.private.json') != recovery['cohortSha256']:
        fail('recovery_or_scope_changed')
    for name, expected in recovery['inputHashes'].items():
        if sha(root / name) != expected:
            fail('retained_input_changed')
    if preservation_state() != recovery['preservation']:
        fail('incumbent_data_changed')
    verify_current_runtimes(retained, root, recovery,
                            require_compatible=(root / 'bridge-active.json').exists())
    if operation == 'repair-maintenance-owner':
        print(json.dumps(repair_maintenance_owner(retained, root, recovery, commit)))
    elif operation in ['bridge-canary', 'canary']:
        if operation == 'canary' and (not (root / 'index-verified.json').is_file() or not (root / 'evaluation-verified.json').is_file()):
            fail('index_verification_required')
        before = semantic_state()
        results = {}
        for runtime in ['public', 'protected']:
            config = root / (runtime + '-' + operation + '.json')
            project = checked_json(config)['name']
            if run(['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=' + project]).strip():
                fail('canary_project_occupied')
            try:
                run(['docker', 'compose', '-f', str(config), 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'app'])
                container = run(['docker', 'compose', '-f', str(config), 'ps', '-q', 'app']).decode().strip()
                if retained.inspect(container)['HostConfig']['PortBindings']:
                    fail('canary_exposed_port')
                results[runtime] = runtime_probe(container, commit, recovery['eligible'][runtime], operation == 'canary' and runtime == 'protected')
            finally:
                run(['docker', 'compose', '-f', str(config), 'down'])
        if semantic_state() != before or preservation_state() != recovery['preservation']:
            fail('canary_changed_database')
        save_unchanged(root / (operation + '-verified.json'), results)
        print(json.dumps({'outcome': 'canary_verified', 'visitorEnabled': False, 'evaluationEnabled': operation == 'canary'}))
    elif operation in ['apply-0026', 'baseline', 'plan', 'import', 'verify', 'evaluate', 'rollback-index']:
        if not (root / 'bridge-active.json').is_file():
            fail('compatible_bridge_required')
        runtimes = ['public'] if operation == 'apply-0026' else ['public', 'protected']
        summaries = {}
        for runtime in runtimes:
            if operation in ['import', 'rollback-index'] and not list((root / ('output-' + runtime)).glob('baseline*.json')):
                fail('scoped_recovery_required')
            if operation == 'import' and not list((root / ('output-' + runtime)).glob('plan*.json')):
                fail('reviewable_plan_required')
            before = semantic_state()
            values, code = maintenance_result(['docker', 'compose', '-f', str(root / (runtime + '-maintenance.json')),
                'run', '--rm', '--no-deps', 'maintenance', operation])
            save(root / ('output-' + runtime) / (operation + '-' + str(time.time_ns()) + '.receipt.json'), values)
            if operation in ['baseline', 'plan', 'verify', 'evaluate'] and semantic_state() != before:
                fail('read_only_operation_changed_semantics')
            if preservation_state() != recovery['preservation']:
                fail('semantic_operation_changed_incumbent_data')
            summaries[runtime] = values
            for value in values:
                print(json.dumps(value))
            if code:
                sys.exit(code)
        if operation == 'verify':
            save_unchanged(root / 'index-verified.json', summaries)
        if operation == 'evaluate':
            # Generated inside the destination after corpus reconciliation. No
            # local-only descriptions or recommendations enter the transfer.
            path = root / 'output-protected' / 'staging_protected-evaluation.private.json'
            data = protected_file(path).read_bytes()
            runtime_path = root / 'evaluation-runtime.private.json'
            if runtime_path.exists():
                if sha(runtime_path) != hashlib.sha256(data).hexdigest():
                    fail('evaluation_runtime_changed')
            else:
                with runtime_path.open('xb') as stream:
                    stream.write(data)
                os.chown(runtime_path, 1000, 1000)
                runtime_path.chmod(0o400)
            save_unchanged(root / 'evaluation-verified.json', {'sha256': sha(runtime_path), 'visitorEnabled': False})
    elif operation in ['activate-bridge', 'activate', 'rollback', 'reactivate']:
        suffix = 'candidate' if operation in ['activate', 'reactivate'] else 'bridge'
        required = 'canary-verified.json' if suffix == 'candidate' else 'bridge-canary-verified.json'
        if not (root / required).is_file():
            fail('canary_verification_required')
        before = semantic_state()
        for runtime, container, port in [('protected', PROTECTED, 8082), ('public', PUBLIC, 8080)]:
            retained.compose(root / (runtime + '-' + suffix + '.json'))
            retained.ready(port, commit)
            if retained.inspect(container)['Image'] != recovery['newImage']:
                fail('running_image_changed')
            runtime_probe(container, commit, recovery['eligible'][runtime], suffix == 'candidate' and runtime == 'protected')
        if semantic_state() != before or preservation_state() != recovery['preservation']:
            fail('application_restart_changed_database')
        if operation == 'activate-bridge' and not (root / 'bridge-active.json').exists():
            save(root / 'bridge-active.json', {'commit': commit, 'visitorEnabled': False, 'evaluationEnabled': False})
        print(json.dumps({'outcome': 'activated' if suffix == 'candidate' else 'feature_disabled',
                          'visitorEnabled': False, 'evaluationEnabled': suffix == 'candidate', 'commit': commit}))
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

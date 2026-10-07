"""Offline synthetic deployment checks. No network, credentials or sermon rows."""
import importlib.util
import io
import pathlib
import tarfile
import tempfile
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[1] / 'deployment' / 'related-themes-remote.py'
SPEC = importlib.util.spec_from_file_location('related_themes_operator_fixture', SOURCE)
OP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OP)


def original():
    return {'name': 'fixture-project', 'services': {'app': {
        'image': 'fixture-old', 'container_name': 'fixture-app', 'read_only': True,
        'environment': {'RELEASE_COMMIT': OP.PREVIOUS_COMMIT, 'DB_NAME': 'savinggrace_staging',
                        'DB_PORT': '5432', 'STAGING_SEALED': '1', 'D175_COMPLETED_ENABLED': '1',
                        'UNRELATED_GUARD': 'preserved'},
        'ports': [{'host_ip': '127.0.0.1', 'published': 8082, 'target': 8080}],
        'networks': {'private': {'ipv4_address': '172.25.0.10'}},
        'secrets': ['db_reader_password'], 'volumes': ['fixture-cohort:/verification/cohort:ro']}},
        'secrets': {'db_owner_password': {'file': '/protected/fixture-owner.secret'},
                    'db_reader_password': {'file': '/protected/fixture-reader.secret'}}}


class RelatedThemesDeploymentTest(unittest.TestCase):
    def test_public_feature_and_evaluation_stay_off_and_original_is_unchanged(self):
        source = original()
        result = OP.candidate_config(source, 'public', '1' * 40, 'fixture-new', pathlib.Path('/fixture'))
        env = result['services']['app']['environment']
        self.assertEqual(env['RELATED_THEMES_VISITOR_ENABLED'], '0')
        self.assertEqual(env['RELATED_THEMES_EVALUATION_ENABLED'], '0')
        self.assertEqual(env['UNRELATED_GUARD'], 'preserved')
        self.assertNotIn('RELATED_THEMES_EVALUATION_FILE', env)
        self.assertEqual(source['services']['app']['image'], 'fixture-old')
        self.assertEqual(result['services']['app']['ports'], source['services']['app']['ports'])

    def test_only_protected_runtime_gets_read_only_evaluation_material(self):
        result = OP.candidate_config(original(), 'protected', '1' * 40, 'fixture-new', pathlib.Path('/fixture'), True)
        app = result['services']['app']
        self.assertEqual(app['environment']['RELATED_THEMES_ACCESS'], 'protected_tunnel')
        self.assertEqual(app['environment']['RELATED_THEMES_VISITOR_ENABLED'], '0')
        self.assertEqual(app['volumes'][-1]['target'], '/run/related-themes/evaluation.private.json')
        self.assertTrue(app['volumes'][-1]['read_only'])
        with self.assertRaisesRegex(RuntimeError, 'public_evaluation_refused'):
            OP.candidate_config(original(), 'public', '1' * 40, 'fixture-new', pathlib.Path('/fixture'), True)

    def test_remote_development_identity_and_changed_selector_are_refused(self):
        for key, value in [('ENABLE_LOCAL_TEST_IDENTITIES', '1'), ('D175_COMPLETED_ENABLED', '0'),
                           ('DB_NAME', 'other'), ('RELEASE_COMMIT', '2' * 40), ('STAGING_SEALED', '0')]:
            source = original()
            source['services']['app']['environment'][key] = value
            with self.assertRaises(RuntimeError):
                OP.candidate_config(source, 'protected', '1' * 40, 'new', pathlib.Path('/fixture'))

    def test_canary_has_no_listener_or_static_address_and_cannot_replace_existing_app(self):
        candidate = OP.candidate_config(original(), 'protected', '1' * 40, 'new', pathlib.Path('/fixture'))
        result = OP.canary_config(candidate, 'protected', '1' * 40)
        self.assertNotEqual(result['name'], candidate['name'])
        self.assertNotIn('ports', result['services']['app'])
        self.assertNotIn('container_name', result['services']['app'])
        self.assertNotIn('ipv4_address', result['services']['app']['networks']['private'])
        self.assertIn('ports', candidate['services']['app'])

    def test_maintenance_has_only_scoped_private_inputs_and_no_listeners(self):
        value = OP.maintenance_config(pathlib.Path('/fixture'), 'image', original(), '1' * 40, 'protected')
        service = value['services']['maintenance']
        self.assertNotIn('ports', service)
        self.assertTrue(service['read_only'])
        self.assertEqual(service['secrets'], ['db_owner_password'])
        self.assertEqual(service['environment']['RELATED_THEMES_ENVIRONMENT'], 'staging_protected')
        self.assertEqual(value['networks']['existing']['name'], OP.NETWORK)
        self.assertEqual(sum('/verification/related-themes.private.json:ro' in str(v) for v in service['volumes']), 1)
        self.assertFalse(any('evaluation' in str(v) for v in service['volumes']))

    def test_input_contract_never_transfers_local_evaluation_descriptions(self):
        self.assertEqual(OP.INPUTS, ('release.tar', 'public-index.private.json', 'protected-index.private.json'))
        self.assertEqual(set(OP.TABLES), {'accepted_description_semantic_vectors', 'accepted_description_semantic_builds',
                                        'accepted_description_semantic_members', 'accepted_description_semantic_active'})

    def test_logs_allow_only_sanitized_aggregates(self):
        self.assertEqual(OP.safe_summary({'outcome': 'evaluation_prepared', 'anchors': 24,
             'evaluationFingerprint': '1' * 64, 'visitorEnabled': False})['anchors'], 24)
        for bad in [{'outcome': 'ok', 'rows': []}, {'outcome': 'ok', 'description': 'synthetic'},
                    {'outcome': 'ok', 'counts': {'secret': 1}}, {'outcome': 'raw error material'},
                    {'outcome': 'ok', 'eligible': True}, {'outcome': 'ok', 'sha256': 'invalid'}]:
            with self.assertRaises(RuntimeError):
                OP.safe_summary(bad)

    def test_archives_refuse_traversal_symlinks_credentials_models_and_private_exports(self):
        for name, kind in [('src/safe.js', tarfile.REGTYPE), ('../outside', tarfile.REGTYPE),
                           ('/absolute', tarfile.REGTYPE), ('private/a.json', tarfile.REGTYPE),
                           ('secret.pem', tarfile.REGTYPE), ('model.onnx', tarfile.REGTYPE),
                           ('data.private.json', tarfile.REGTYPE), ('.env', tarfile.REGTYPE),
                           ('src/link', tarfile.SYMTYPE)]:
            with self.subTest(name=name):
                stream = io.BytesIO()
                with tarfile.open(fileobj=stream, mode='w') as archive:
                    item = tarfile.TarInfo(name)
                    item.type = kind
                    archive.addfile(item)
                stream.seek(0)
                with tarfile.open(fileobj=stream) as archive:
                    if name == 'src/safe.js':
                        OP.safe_archive(archive)
                    else:
                        with self.assertRaises(RuntimeError):
                            OP.safe_archive(archive)

    def test_recovery_writes_never_overwrite_changed_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'receipt.json'
            OP.save_unchanged(path, {'safe': 1})
            OP.save_unchanged(path, {'safe': 1})
            with self.assertRaisesRegex(RuntimeError, 'existing_receipt_changed'):
                OP.save_unchanged(path, {'safe': 2})
            self.assertEqual(OP.checked_json(path), {'safe': 1})

    def test_live_runtime_drift_and_incompatible_old_image_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            states = {}
            for runtime, container in [('public', OP.PUBLIC), ('protected', OP.PROTECTED)]:
                previous = original()
                bridge = OP.candidate_config(previous, runtime, '1' * 40, 'new', root)
                candidate = OP.candidate_config(previous, runtime, '1' * 40, 'new', root, runtime == 'protected')
                for name, value in [('previous', previous), ('bridge', bridge), ('candidate', candidate)]:
                    OP.save(root / (runtime + '-' + name + '.json'), value)
                live_path = root / (runtime + '-live.json')
                OP.save(live_path, previous)
                states[container] = {'Image': OP.PREVIOUS_IMAGE, 'Config': {'Labels': {
                    'com.docker.compose.project.config_files': str(live_path)}}}
            retained = type('Fixture', (), {'inspect': staticmethod(lambda name: states[name])})
            OP.verify_current_runtimes(retained, root, {'newImage': 'new'})
            with self.assertRaisesRegex(RuntimeError, 'concurrent_runtime_changed'):
                OP.verify_current_runtimes(retained, root, {'newImage': 'new'}, True)
            states[OP.PUBLIC]['Image'] = 'unexpected'
            with self.assertRaisesRegex(RuntimeError, 'concurrent_runtime_changed'):
                OP.verify_current_runtimes(retained, root, {'newImage': 'new'})


if __name__ == '__main__':
    unittest.main()

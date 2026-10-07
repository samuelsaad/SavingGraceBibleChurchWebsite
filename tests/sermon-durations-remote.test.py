"""Offline operator boundaries, using anonymous configuration and no network."""
import importlib.util
import pathlib
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location('duration_operator', pathlib.Path(__file__).parents[1] / 'deployment/sermon-durations-remote.py')
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)


class DurationOperatorTests(unittest.TestCase):
    def fixture(self, runtime='public'):
        return {'name': 'anonymous-project', 'services': {'app': {
            'image': 'anonymous-prior-image', 'environment': {
                'RELEASE_COMMIT': operator.PREVIOUS[runtime]['commit'],
                'STAGING_SEALED': '1', 'D175_COMPLETED_ENABLED': '1',
                'DB_NAME': 'savinggrace_staging', 'DB_PORT': '5432'},
            'ports': ['127.0.0.1:8080:8080'], 'secrets': ['db_reader_password'],
            'networks': {'private': {'ipv4_address': '192.0.2.7'}}}},
            'secrets': {'db_owner_password': {'file': '/protected/anonymous-placeholder'}}}

    def test_candidates_change_only_image_and_commit_for_each_existing_runtime(self):
        for runtime in ['public', 'protected']:
            original = self.fixture(runtime)
            candidate = operator.candidate_config(original, runtime, 'a' * 40, 'anonymous-image')
            candidate['services']['app']['image'] = original['services']['app']['image']
            candidate['services']['app']['environment']['RELEASE_COMMIT'] = operator.PREVIOUS[runtime]['commit']
            self.assertEqual(candidate, original)

    def test_drift_extra_service_identity_and_database_fail_closed(self):
        for mutate in [lambda value: value['services'].update({'other': {}}),
                       lambda value: value['services']['app']['environment'].update({'RELEASE_COMMIT': 'b' * 40}),
                       lambda value: value['services']['app']['environment'].update({'ENABLE_LOCAL_TEST_IDENTITIES': '1'}),
                       lambda value: value['services']['app']['environment'].update({'DB_NAME': 'unrelated'}),
                       lambda value: value['services']['app']['environment'].update({'D175_COMPLETED_ENABLED': '0'})]:
            fixture = self.fixture()
            mutate(fixture)
            with self.assertRaises(RuntimeError):
                operator.candidate_config(fixture, 'public', 'a' * 40, 'anonymous-image')

    def test_canary_has_no_listener_or_incumbent_static_address(self):
        original = self.fixture()
        original['services']['app']['container_name'] = 'anonymous-incumbent'
        original['services']['app']['networks']['private']['ipv6_address'] = '2001:db8::7'
        candidate = operator.candidate_config(original, 'public', 'a' * 40, 'anonymous-image')
        canary = operator.canary_config(candidate, 'public', 'a' * 40)
        self.assertNotIn('ports', canary['services']['app'])
        self.assertNotIn('container_name', canary['services']['app'])
        self.assertEqual(canary['services']['app']['networks']['private'], {})
        self.assertEqual(candidate['services']['app']['ports'], original['services']['app']['ports'])

    def test_maintenance_is_only_owner_secret_consumer_of_private_packet(self):
        original = self.fixture('protected')
        config = operator.maintenance_config(pathlib.Path('/protected/release'), 'anonymous-image', original, 'a' * 40)
        maintenance = config['services']['maintenance']
        self.assertNotIn('ports', maintenance)
        self.assertTrue(maintenance['read_only'])
        self.assertEqual(maintenance['secrets'], ['db_owner_password'])
        self.assertIn(':/verification/durations.private.json:ro', maintenance['volumes'][0])
        self.assertEqual(maintenance['environment']['ALLOW_STAGING_DURATION_SYNC'], '1')
        self.assertEqual(maintenance['environment']['RELEASE_COMMIT'], 'a' * 40)
        self.assertEqual(maintenance['environment']['D171_COHORT_FILE'], '/verification/cohort.private.json')
        self.assertIn(':/verification/cohort.private.json:ro', maintenance['volumes'][1])
        candidate = operator.candidate_config(original, 'protected', 'a' * 40, 'anonymous-image')
        self.assertNotIn('/verification', str(candidate))

    def test_raw_provider_errors_rows_credentials_and_unrestricted_text_are_refused(self):
        for value in [None, {'message': 'anonymous message'},
                      {'outcome': 'failed', 'request': {'headers': {'Authorization': 'anonymous-secret'}}},
                      {'outcome': 'verified', 'title': 'anonymous title'},
                      {'outcome': 'failed', 'code': 'arbitrary provider message'},
                      {'outcome': 'verified', 'updated': True},
                      {'outcome': 'verified', 'sha256': 'not-a-hash'}]:
            with self.assertRaisesRegex(RuntimeError, 'maintenance_output_refused'):
                operator.safe_summary(value)
        value = {'outcome': 'verified', 'updated': 2, 'unchanged': 3, 'inventoryUnchanged': True, 'sha256': 'a' * 64}
        self.assertEqual(operator.safe_summary(value), value)

    def test_command_errors_do_not_include_stderr(self):
        fake = mock.Mock(returncode=1, stdout=b'', stderr=b'Authorization: anonymous-secret')
        with mock.patch.object(operator.subprocess, 'run', return_value=fake):
            with self.assertRaisesRegex(RuntimeError, '^guarded_command_failed$'):
                operator.run(['anonymous-command'])

    def test_partial_checkpoint_keeps_only_validated_aggregate_result(self):
        fake = mock.Mock(returncode=1, stdout=b'{"outcome":"partial","updated":2,"conflicting":1}',
                         stderr=b'Authorization: anonymous-secret')
        with mock.patch.object(operator.subprocess, 'run', return_value=fake):
            values, code = operator.maintenance_result(['anonymous-command'])
            self.assertEqual(code, 1)
            self.assertEqual(values, [{'outcome': 'partial', 'updated': 2, 'conflicting': 1}])
        fake.stdout = b'{"outcome":"partial","headers":{"Authorization":"anonymous-secret"}}'
        with mock.patch.object(operator.subprocess, 'run', return_value=fake):
            with self.assertRaisesRegex(RuntimeError, 'maintenance_output_refused'):
                operator.maintenance_result(['anonymous-command'])

    def test_recovery_files_never_overwrite_existing_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'recovery.json'
            operator.save(path, {'phase': 'before'})
            with self.assertRaises(FileExistsError):
                operator.save(path, {'phase': 'after'})
            self.assertEqual(operator.checked_json(path), {'phase': 'before'})


if __name__ == '__main__':
    unittest.main()

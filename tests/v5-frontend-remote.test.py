"""Offline anonymous checks: no real host, configuration, database or content."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('v5_operator', pathlib.Path(__file__).parents[1] / 'deployment/v5-frontend-remote.py')
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)

class V5OperatorTests(unittest.TestCase):
    def fixture(self):
        return {'name': 'anonymous-project', 'services': {'app': {'image': 'previous', 'environment': {'RELEASE_COMMIT': operator.PREVIOUS, 'D175_COMPLETED_ENABLED': '1', 'DB_NAME': 'anonymous_staging'}, 'ports': ['127.0.0.1:8080:8080'], 'secrets': ['db_reader_password']}}, 'secrets': {'db_reader_password': {'file': '/protected/anonymous-placeholder'}}}

    def test_only_image_and_revision_change(self):
        original = self.fixture()
        changed = operator.candidate_config(original, 'a' * 40, 'anonymous-image')
        self.assertEqual(original['services']['app']['image'], 'previous')
        changed['services']['app']['image'] = 'previous'
        changed['services']['app']['environment']['RELEASE_COMMIT'] = operator.PREVIOUS
        self.assertEqual(changed, original)

    def test_extra_service_refused(self):
        original = self.fixture(); original['services']['other'] = {}
        with self.assertRaisesRegex(RuntimeError, 'service_scope_changed'):
            operator.candidate_config(original, 'a' * 40, 'anonymous-image')

    def test_revision_drift_refused(self):
        original = self.fixture(); original['services']['app']['environment']['RELEASE_COMMIT'] = 'b' * 40
        with self.assertRaisesRegex(RuntimeError, 'previous_release_changed'):
            operator.candidate_config(original, 'a' * 40, 'anonymous-image')

    def test_development_identity_refused(self):
        for key in ['ENABLE_LOCAL_TEST_IDENTITIES', 'ENABLE_LOCAL_DASHBOARD']:
            original = self.fixture(); original['services']['app']['environment'][key] = '1'
            with self.assertRaisesRegex(RuntimeError, 'remote_identity_refused'):
                operator.candidate_config(original, 'a' * 40, 'anonymous-image')

    def test_canary_does_not_reuse_public_ports_or_reserved_addresses(self):
        original = self.fixture()
        original['services']['app']['container_name'] = 'anonymous-public'
        original['services']['app']['networks'] = {'private': {'ipv4_address': '192.0.2.7', 'ipv6_address': '2001:db8::7'}}
        candidate = operator.candidate_config(original, 'a' * 40, 'anonymous-image')
        canary = operator.canary_config(candidate, 'a' * 40)
        self.assertNotIn('ports', canary['services']['app'])
        self.assertNotIn('container_name', canary['services']['app'])
        self.assertEqual(canary['services']['app']['networks']['private'], {})
        self.assertEqual(candidate['services']['app']['networks'], original['services']['app']['networks'])
        self.assertEqual(candidate['services']['app']['ports'], original['services']['app']['ports'])

if __name__ == '__main__':
    unittest.main()

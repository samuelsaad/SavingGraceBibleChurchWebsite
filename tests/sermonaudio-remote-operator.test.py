"""Anonymous offline operator checks. No Docker, network, or database access."""
import importlib.util
import io
import json
import pathlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('operator_fixture', pathlib.Path(__file__).parents[1] / 'deployment' / 'sermonaudio-completion-remote.py')
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)

class OperatorTests(unittest.TestCase):
    def archive(self, name, kind=tarfile.REGTYPE):
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode='w') as archive:
            item = tarfile.TarInfo(name)
            item.type = kind
            archive.addfile(item)
        data.seek(0)
        return tarfile.open(fileobj=data)

    def test_scope_and_symlink_exclusion(self):
        with self.archive('src/anonymous.ts') as archive:
            operator.safe_archive(archive)
        for name, kind in [('../anonymous', tarfile.REGTYPE), ('/anonymous', tarfile.REGTYPE), ('private/anonymous.json', tarfile.REGTYPE), ('development-data/anonymous.json', tarfile.REGTYPE), ('src/anonymous.ts', tarfile.SYMTYPE)]:
            with self.archive(name, kind) as archive:
                with self.assertRaises(RuntimeError):
                    operator.safe_archive(archive)

    def test_failure_never_propagates_raw_command_output(self):
        class Result:
            returncode = 1
            stdout = b'fictional credential and private body'
            stderr = b'fictional request configuration and secret'
        with patch.object(operator.subprocess, 'run', return_value=Result()):
            with self.assertRaisesRegex(RuntimeError, '^command_failed_fixture$'):
                operator.run(['fixture'])

    def test_no_clobber_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'anonymous.json'
            operator.save(path, {'anonymous': True})
            before = path.read_bytes()
            with self.assertRaises(FileExistsError):
                operator.save(path, {'anonymous': False})
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(json.loads(before), {'anonymous': True})

    def test_instance_drift_refuses_operation(self):
        class Response:
            def __init__(self, data): self.data = data
            def read(self): return self.data
        with patch.object(operator.urllib.request, 'urlopen', side_effect=[Response(b'fictional metadata token'), Response(b'i-anonymous-wrong')]):
            with self.assertRaisesRegex(RuntimeError, '^instance_identity_changed$'):
                operator.verify_host()

    def test_cohort_requires_exact_verified_membership(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'anonymous.json'
            for value in [{'decision': 'D-171', 'ids': []}, {'decision': 'other', 'ids': []}, {'decision': 'D-171', 'ids': [], 'membershipSha256': operator.MEMBERSHIP}]:
                path.write_text(json.dumps(value), encoding='utf-8')
                with self.assertRaisesRegex(RuntimeError, '^previous_cohort_refused$'):
                    operator.cohort_bytes(path)

    def test_code_followup_reuses_only_baseline_and_requires_new_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            root, prior = pathlib.Path(directory) / 'next', pathlib.Path(directory) / 'prior'
            for path in [root, prior]:
                (path / 'output').mkdir(parents=True)
                (path / 'source.private.json').write_text('{"anonymous":true}')
                (path / 'cohort.private.json').write_text('{"anonymous":true}')
            baseline = {'decision': 'D-175', 'manifestSha256': operator.MANIFEST, 'anonymous': True}
            (prior / 'output' / 'baseline.private.json').write_text(json.dumps(baseline))
            with self.assertRaisesRegex(RuntimeError, '^previous_verified_data_required$'):
                operator.reuse_baseline(root, prior)
            (prior / 'output' / 'verify-fixture.receipt.json').write_text(json.dumps([{'outcome': 'verified', 'targets': 119, 'ready': 119, 'failed': 0, 'conflicted': 0}]))
            operator.reuse_baseline(root, prior)
            self.assertEqual(json.loads((root / 'output' / 'baseline.private.json').read_text()), baseline)
            self.assertEqual(list((root / 'output').glob('verify-*.receipt.json')), [])
            self.assertTrue(json.loads((root / 'output' / 'baseline-reuse.receipt.json').read_text())['freshTargetVerificationRequired'])
            (root / 'source.private.json').write_text('{"anonymous":false}')
            with self.assertRaisesRegex(RuntimeError, '^baseline_scope_changed$'):
                operator.reuse_baseline(root, prior)

if __name__ == '__main__':
    unittest.main()

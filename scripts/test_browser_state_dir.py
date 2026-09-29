import tempfile
import unittest
from pathlib import Path

from browser_state_dir import create_browser_state


class BrowserStateDirectoryTests(unittest.TestCase):
    def test_rejects_unsafe_paths_without_touching_existing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'repo'
            root.mkdir()
            sentinel = root / 'keep.txt'
            sentinel.write_text('preserved')
            for requested in ('', ' ', '.', '..', 'tmp', 'tmp/../src', str(root), str(root.parent)):
                with self.subTest(requested=requested), self.assertRaises(ValueError):
                    create_browser_state(root, requested)
            self.assertEqual(sentinel.read_text(), 'preserved')
            self.assertFalse((root / 'tmp').exists())

    def test_creates_fresh_children_and_preserves_prior_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = create_browser_state(root)
            sentinel = first / 'existing.sqlite'
            sentinel.write_text('preserved')
            second = create_browser_state(root)
            custom = create_browser_state(root, 'tmp/custom-qa')
            self.assertNotEqual(first, second)
            self.assertEqual(sentinel.read_text(), 'preserved')
            self.assertEqual(custom.parent, root.resolve() / 'tmp' / 'custom-qa')
            self.assertTrue(first.is_dir() and second.is_dir() and custom.is_dir())

    def test_rejects_redirected_parent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'repo'
            outside = Path(directory) / 'outside'
            (root / 'tmp').mkdir(parents=True)
            outside.mkdir()
            try:
                (root / 'tmp' / 'link').symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest('Creating directory symlinks requires host permission')
            with self.assertRaises(ValueError):
                create_browser_state(root, 'tmp/link')
            self.assertEqual(list(outside.iterdir()), [])


if __name__ == '__main__':
    unittest.main()

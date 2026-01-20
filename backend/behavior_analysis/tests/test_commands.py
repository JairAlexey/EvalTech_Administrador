from unittest import mock

from django.core.management.base import CommandError
from django.test import TestCase

from behavior_analysis.management.commands.test_behavior import Command


class BehaviorCommandTests(TestCase):
    def test_unknown_feature(self):
        command = Command()
        with self.assertRaises(CommandError):
            command._load_runner("unknown")

    def test_import_error(self):
        command = Command()
        with mock.patch(
            "behavior_analysis.management.commands.test_behavior.importlib.import_module",
            side_effect=ImportError("missing"),
        ):
            with self.assertRaises(CommandError):
                command._load_runner("voice")

from io import StringIO

from django.core.management import call_command
from django.test import TestCase


class ProxyCommandsTests(TestCase):
    def test_start_dynamic_proxy_command(self):
        out = StringIO()
        call_command("start_dynamic_proxy", stdout=out)
        output = out.getvalue()
        self.assertIn("HTTP-ONLY", output)

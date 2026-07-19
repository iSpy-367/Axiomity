import importlib
import os
from unittest.mock import patch

from django.test import SimpleTestCase


class DatabaseSettingsTests(SimpleTestCase):
    def test_default_database_uses_postgresql(self):
        with patch.dict(os.environ, {
            'DB_NAME': 'stockdb',
            'DB_USER': 'postgres',
            'DB_PASSWORD': 'root',
            'DB_HOST': 'localhost',
            'DB_PORT': '5432',
        }, clear=False):
            import stockanalysis.settings as settings
            settings = importlib.reload(settings)

            self.assertEqual(
                settings.DATABASES['default']['ENGINE'],
                'django.db.backends.postgresql',
            )

from django.test import SimpleTestCase

from .analysis import generate_recommendation


class RecommendationTests(SimpleTestCase):
    def test_generate_recommendation_handles_short_series(self):
        result = generate_recommendation([100.0])
        self.assertEqual(result['recommendation'], 'Hold')
        self.assertEqual(result['confidence'], 50.0)
        self.assertEqual(result['rsi'], 50.0)

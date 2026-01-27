from django.test import TestCase
from rest_framework.test import APIClient
from swim_backend.devices.models import Device
from swim_backend.core.models import Job
from django.utils import timezone
import datetime

class DashboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create some devices
        self.dev1 = Device.objects.create(hostname="dev1", ip_address="1.1.1.1", reachability='Reachable', site='SiteA')
        self.dev2 = Device.objects.create(hostname="dev2", ip_address="1.1.1.2", reachability='Unreachable', site='SiteB')
        
        # Create a failed job
        Job.objects.create(device=self.dev1, status='failed')
        
    def test_stats_api(self):
        response = self.client.get('/api/dashboard/stats/')
        self.assertEqual(response.status_code, 200)
        data = response.data
        
        # Network Stats
        self.assertEqual(data['network']['devices'], 2)
        self.assertEqual(data['network']['sites'], 2)
        
        # Health Stats
        self.assertEqual(data['health']['reachable'], 1)
        self.assertEqual(data['health']['unreachable'], 1)
        self.assertEqual(data['health']['percentage'], 50)
        
        # Issues Stats
        self.assertEqual(data['issues']['critical'], 1)

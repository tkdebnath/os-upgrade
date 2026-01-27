from django.test import TestCase
from swim_backend.devices.plugins.registry import PluginRegistry
from swim_backend.devices.plugins.base import BaseInventoryPlugin

class MockPlugin(BaseInventoryPlugin):
    plugin_id = 'test_mock'
    name = 'Mock Plugin'
    
    def test_connection(self, config):
        return {"status": "connected"}

    def get_filter_metadata(self, config):
        return {'sites': ['Site1'], 'roles': ['Switch']}
        
    def preview_devices(self, config, filters):
        return [{'name': 'Dev1', 'ip_address': '1.1.1.1', 'platform': 'iosxe', 'site': 'Site1'}]

class PluginRegistryTests(TestCase):
    def setUp(self):
        # Register the mock plugin manually or ensure it's registered
        PluginRegistry.register(MockPlugin)

    def test_get_plugin(self):
        plugin = PluginRegistry.get_plugin('test_mock')
        self.assertIsNotNone(plugin)
        self.assertEqual(plugin.name, 'Mock Plugin')
        
    def test_plugin_interface(self):
        plugin = PluginRegistry.get_plugin('test_mock')
        result = plugin.test_connection({})
        self.assertEqual(result['status'], 'connected')

    def test_list_plugins(self):
        plugins = PluginRegistry.list_plugins()
        self.assertTrue(len(plugins) >= 1)
        ids = [p['id'] for p in plugins]
        self.assertIn('test_mock', ids)

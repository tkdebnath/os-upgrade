class PluginRegistry:
    _plugins = {}

    @classmethod
    def register(cls, plugin_class):
        instance = plugin_class()
        cls._plugins[instance.plugin_id] = instance
        return plugin_class

    @classmethod
    def get_plugin(cls, plugin_id):
        return cls._plugins.get(plugin_id)

    @classmethod
    def list_plugins(cls):
        return [{'id': p.plugin_id, 'name': p.name} for p in cls._plugins.values()]

# Import plugins here to ensure registration
# Plugins are now loaded in devices/apps.py ready()

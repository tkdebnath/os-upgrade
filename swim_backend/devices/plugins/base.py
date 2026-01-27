from abc import ABC, abstractmethod

class BaseInventoryPlugin(ABC):
    """
    Abstract Base Class for Inventory Import Plugins.
    """
    
    @property
    @abstractmethod
    def plugin_id(self):
        """Unique identifier for the plugin (e.g., 'netbox')."""
        pass

    @property
    @abstractmethod
    def name(self):
        """Human-readable name (e.g., 'NetBox')."""
        pass

    @abstractmethod
    def test_connection(self, config):
        """
        Validate connection credentials.
        Returns dict with status and metadata (e.g., version, count).
        """
        pass

    @abstractmethod
    def get_filter_metadata(self, config):
        """
        Return available filter options (sites, roles, types).
        Returns dict: {'sites': [], 'roles': [], 'types': []}
        """
        pass

    @abstractmethod
    def preview_devices(self, config, filters):
        """
        Fetch list of devices matching filters for preview.
        Returns list of dicts: [{'name': '...', 'ip': '...', ...}]
        """
        pass

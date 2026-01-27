import requests
import logging
import re
from .base import BaseInventoryPlugin
from .registry import PluginRegistry

logger = logging.getLogger(__name__)

@PluginRegistry.register
class NetBoxPlugin(BaseInventoryPlugin):
    plugin_id = 'netbox'
    name = 'NetBox'

    def _get_client(self, config):
        url = config.get('url', '').rstrip('/')
        token = config.get('token', '')
        version = config.get('token_version', 'v1')
        api_key = config.get('api_key', '')
        return _NetBoxClient(url, token, version, api_key)

    def test_connection(self, config):
        client = self._get_client(config)
        data = client.get('dcim/devices', {'limit': 1})
        return {"status": "connected", "total_devices": data.get('count', 0)}

    def get_filter_metadata(self, config):
        client = self._get_client(config)
        return {
            "sites": [{'id': s['id'], 'name': s['name'], 'slug': s['slug']} for s in client.get('dcim/sites', {'limit': 0}).get('results', [])],
            "roles": [{'id': r['id'], 'name': r['name'], 'slug': r['slug']} for r in client.get('dcim/device-roles', {'limit': 0}).get('results', [])],
            "types": [{'id': t['id'], 'model': t['model'], 'slug': t['slug']} for t in client.get('dcim/device-types', {'limit': 0}).get('results', [])]
        }

    def preview_devices(self, config, filters):
        client = self._get_client(config)
        params = {'limit': 0}
        
        if filters.get('site'): params['site'] = filters['site']
        if filters.get('role'): params['role'] = filters['role']
        if filters.get('device_type'): params['device_type_id'] = filters['device_type']
        if filters.get('search'): params['q'] = filters['search']

        data = client.get('dcim/devices', params)
        results = []
        
        for d in data.get('results', []):
            if d.get('primary_ip'):
                ip = d['primary_ip']['address'].split('/')[0]
                results.append({
                    'name': d['name'],
                    'ip_address': ip,
                    'platform': d['platform']['name'] if d.get('platform') else 'iosxe',
                    'site': d['site']['name'] if d.get('site') else 'Global',
                    'role': d['device_role']['name'] if d.get('device_role') else 'Switch',
                    'model': d['device_type']['model'] if d.get('device_type') else 'Unknown',
                })
        return results

class _NetBoxClient:
    def __init__(self, url, token, version='v1', api_key=''):
        self.url = url
        
        token = token.strip()
        
        # Explicit v2 logic
        if version == 'v2' and api_key:
            # Construct standard v2 header: Bearer nbt_<KEY>.<TOKEN>
            # Clean key/token just in case
            clean_key = api_key.strip().replace('nbt_', '') # In case user pasted "nbt_..."
            clean_token = token
            self.headers = {'Authorization': f'Bearer nbt_{clean_key}.{clean_token}', 'Accept': 'application/json'}
        else:
            # Fallback / v1 / Auto-detect logic
            # Handle various input formats:
            # 1. "Token <key>" -> Token <key>
            # 2. "Bearer <key>" -> Bearer <key>
            # 3. "nbt_..." -> Bearer nbt_... (Netbox v2/v3 new style)
            # 4. "<hex>" -> Token <hex> (Old style)
            
            # Strip existing prefixes
            cleaned_token = re.sub(r'(?i)^(token|bearer)\s+', '', token).strip()
            
            # Determine prefix
            if cleaned_token.startswith('nbt_'):
                 prefix = 'Bearer'
            else:
                 prefix = 'Token'
                 
            self.headers = {'Authorization': f'{prefix} {cleaned_token}', 'Accept': 'application/json'}

    def get(self, endpoint, params=None):
        try:
            r = requests.get(f"{self.url}/api/{endpoint}/", headers=self.headers, params=params, timeout=10)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.error(f"NetBox Error: {e}")
            raise Exception(f"NetBox Connection Failed: {str(e)}")

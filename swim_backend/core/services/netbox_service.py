import requests
import logging

logger = logging.getLogger(__name__)

class NetBoxService:
    def __init__(self, url, token, ssl_verify=True):
        self.url = url.rstrip('/')
        self.headers = {
            'Authorization': f'Token {token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        self.ssl_verify = ssl_verify

    def _get(self, endpoint, params=None):
        try:
            response = requests.get(
                f"{self.url}/api/{endpoint}/", 
                headers=self.headers, 
                params=params, 
                verify=self.ssl_verify,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"NetBox API Error: {e}")
            raise Exception(f"Failed to connect to NetBox: {str(e)}")

    def test_connection(self):
        """Validates connection and returns counts."""
        data = self._get('dcim/devices', {'limit': 1})
        return {"status": "connected", "total_devices": data.get('count', 0)}

    def get_sites(self):
        """Fetches all sites."""
        data = self._get('dcim/sites', {'limit': 0})
        return [{'id': s['id'], 'name': s['name'], 'slug': s['slug']} for s in data.get('results', [])]

    def get_roles(self):
        """Fetches all device roles."""
        data = self._get('dcim/device-roles', {'limit': 0})
        return [{'id': r['id'], 'name': r['name'], 'slug': r['slug']} for r in data.get('results', [])]

    def get_device_types(self):
        """Fetches all device types."""
        data = self._get('dcim/device-types', {'limit': 0})
        return [{'id': t['id'], 'model': t['model'], 'slug': t['slug']} for t in data.get('results', [])]

    def get_devices(self, site=None, role=None, device_type=None, search=None):
        """
        Fetches devices filtering by criteria.
        Ensures device has a primary IP.
        """
        params = {'limit': 0}
        if site: params['site'] = site
        if role: params['role'] = role
        if device_type: params['device_type_id'] = device_type
        if search: params['q'] = search

        data = self._get('dcim/devices', params)
        results = []
        
        for d in data.get('results', []):
            # Must have primary IP to be useful for SWIM
            if d.get('primary_ip'):
                ip = d['primary_ip']['address'].split('/')[0]
                results.append({
                    'name': d['name'],
                    'ip_address': ip,
                    'platform': d['platform']['name'] if d.get('platform') else 'Unknown',
                    'site': d['site']['name'] if d.get('site') else 'Unknown',
                    'role': d['device_role']['name'] if d.get('device_role') else 'Unknown',
                    'model': d['device_type']['model'] if d.get('device_type') else 'Unknown',
                })
                
        return results

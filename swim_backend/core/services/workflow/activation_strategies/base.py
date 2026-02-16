class BaseActivationStrategy:
    supported_models = []
    supported_platforms = []
    min_version = None
    max_version = None
    
    def __init__(self, device, job, logger):
        self.device = device
        self.job = job
        self.log = logger
        
    def can_handle(self, device):
        # Check model match
        if self.supported_models:
            model_name = device.model.name if device.model else None
            # Case-insensitive check
            if model_name:
                if not any(m.lower() == model_name.lower() for m in self.supported_models):
                    return False
            else:
                return False
        
        # Check platform match
        if self.supported_platforms:
            if device.platform:
                 if not any(p.lower() == device.platform.lower() for p in self.supported_platforms):
                    return False
            else:
                return False
        
        # Check version range (if specified)
        if self.min_version or self.max_version:
            current_version = device.version or "0.0.0"
            if self.min_version and not self._version_gte(current_version, self.min_version):
                return False
            if self.max_version and not self._version_lte(current_version, self.max_version):
                return False
        
        return True
    
    def _version_gte(self, v1, v2):
        try:
            p1 = [int(''.join(filter(str.isdigit, x)) or '0') for x in str(v1).replace('-', '.').split('.')]
            p2 = [int(''.join(filter(str.isdigit, x)) or '0') for x in str(v2).replace('-', '.').split('.')]
            return p1 >= p2
        except:
            return True
    
    def _version_lte(self, v1, v2):
        try:
            p1 = [int(''.join(filter(str.isdigit, x)) or '0') for x in str(v1).replace('-', '.').split('.')]
            p2 = [int(''.join(filter(str.isdigit, x)) or '0') for x in str(v2).replace('-', '.').split('.')]
            return p1 <= p2
        except:
            return True
    
    def get_credentials(self):

        from swim_backend.devices.models import GlobalCredential
        
        username = self.device.username
        password = self.device.password
        secret = self.device.secret
        
        if not username or not password:
            global_creds = GlobalCredential.objects.first()
            if global_creds:
                if not username: username = global_creds.username
                if not password: password = global_creds.password
                if not secret and global_creds.secret: secret = global_creds.secret
        
        return username, password, secret
    
    def create_genie_device(self, username, password, secret):
        from genie.conf.base.device import Device as GenieDevice
        
        return GenieDevice(
            name=self.device.hostname,
            os=self.device.platform if self.device.platform else 'iosxe',
            credentials={
                'default': {
                    'username': username,
                    'password': password
                },
                'enable': {
                    'password': secret if secret else password
                }
            },
            connections={
                'default': {
                    'protocol': 'ssh',
                    'ip': self.device.ip_address,
                }
            }
        )
    
    def execute(self, genie_device):
        raise NotImplementedError("Subclasses must implement execute()")

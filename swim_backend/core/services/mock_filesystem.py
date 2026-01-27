import re

class MockFileSystem:
    """
    Simulates listing files on a remote server.
    """
    
    @staticmethod
    def list_files(server, path):
        """
        Returns a list of dicts: {'filename': str, 'version': str, 'size': int}
        """
        # Define mock file patterns based on path keywords
        # In reality, this would connect to server.address via server.protocol (SCP/SFTP/HTTP)
        
        mock_files = []
        path = path.lower()
        
        if 'c9300' in path or 'cat9k' in path:
            mock_files = [
                {'filename': 'cat9k_iosxe.17.09.04a.SPA.bin', 'version': '17.9.4a'},
                {'filename': 'cat9k_iosxe.17.09.03.SPA.bin', 'version': '17.9.3'},
                {'filename': 'cat9k_iosxe.17.06.05.SPA.bin', 'version': '17.6.5'},
                {'filename': 'cat9k_iosxe.16.12.05.SPA.bin', 'version': '16.12.5'},
            ]
        elif 'isr4' in path:
            mock_files = [
                {'filename': 'isr4400-universalk9.17.03.04a.SPA.bin', 'version': '17.3.4a'},
                {'filename': 'isr4400-universalk9.17.03.03.SPA.bin', 'version': '17.3.3'},
            ]
        elif '9800' in path or 'wlc' in path:
             mock_files = [
                {'filename': 'C9800-universalk9.17.09.04a.SPA.bin', 'version': '17.9.4a'},
                {'filename': 'C9800-universalk9.17.09.01.SPA.bin', 'version': '17.9.1'},
            ]
        else:
             # Generic fallback
             mock_files = [
                {'filename': 'unknown_device.1.0.0.bin', 'version': '1.0.0'}
             ]
             
        # Add metadata
        results = []
        for f in mock_files:
            results.append({
                'filename': f['filename'],
                'version': f['version'],
                'path': f"{path.rstrip('/')}/{f['filename']}",
                'path': f"{path.rstrip('/')}/{f['filename']}",
                'size': 450 * 1024 * 1024,
                'md5': '5d41402abc4b2a76b9719d911017c592'
            })
            
        return results

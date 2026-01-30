import requests
import re
from urllib.parse import urljoin
import logging

logger = logging.getLogger(__name__)

class FileSystemService:
    """
    Handles file listing from remote servers (HTTP, FTP, SFTP).
    """

    @staticmethod
    def list_files(server, path):
        """
        Dispatches to specific protocol handler.
        """
        protocol = server.protocol.lower()
        
        if protocol in ['http', 'https']:
            return FileSystemService._list_http(server, path)
        elif protocol == 'ftp':
            pass
        elif protocol == 'sftp':
            pass
            
        return []

    @staticmethod
    def _list_http(server, path):
        """
        Lists files from an HTTP/S directory listing (Apache/Nginx style).
        """
        try:
            base_url = f"{server.protocol}://{server.address}"
            if server.port:
                base_url += f":{server.port}"
            
            # Construct full URL
            # Ensure path starts with / logic
            clean_path = path.strip('/')
            full_url = f"{base_url}/{clean_path}/"
            
            logger.info(f"Listing files from: {full_url}")
            
            try:
                # Basic Auth if credentials exist
                auth = None
                if server.username and server.password:
                    auth = (server.username, server.password)

                response = requests.get(full_url, auth=auth, timeout=10)
                response.raise_for_status()
                
                html = response.text
                
                # Regex to find links strictly to files (ignoring query params, parent dir etc)
                # Matches <a href="filename.bin"> ... </a>
                # We filter common extensions for IOS images
                file_pattern = r'<a\s+href="([^"?/]+\.(?:bin|iso|img|tar))">'
                
                matches = re.findall(file_pattern, html, re.IGNORECASE)
                
                results = []
                for filename in set(matches): # Deduplicate
                    results.append({
                        'filename': filename,
                        # Version extraction could be regex based on filename pattern
                        'version': FileSystemService._extract_version(filename),
                        'path': f"{clean_path}/{filename}",
                        'size': 0, # Hard to get size reliably from generic HTML without complex parsing
                        'md5': ''
                    })
                    
                return results

            except requests.exceptions.RequestException as e:
                logger.error(f"HTTP Request failed: {e}")
                raise Exception(f"Failed to connect to HTTP server: {str(e)}")

        except Exception as e:
            logger.error(f"Error listing HTTP files: {e}")
            raise e

    @staticmethod
    def _extract_version(filename):
        """
        Attempts to extract version from filename using common Cisco patterns.
        """
        # Example: cat9k_iosxe.17.09.04a.SPA.bin -> 17.9.4a
        # Simple regex for X.X.X
        match = re.search(r'(\d+\.\d+\.\w+)', filename)
        if match:
            return match.group(1)
        return "unknown"

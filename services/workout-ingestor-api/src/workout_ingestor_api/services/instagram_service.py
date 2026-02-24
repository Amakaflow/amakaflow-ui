"""Helpers for downloading Instagram posts via Instaloader or web scraping."""

from __future__ import annotations

import json
import os
import re
from typing import List, Optional
import requests
from urllib.parse import urlparse

try:
    import instaloader
    from instaloader import Post
    from instaloader.exceptions import (
        BadCredentialsException,
        ConnectionException,
        InstaloaderException,
        TwoFactorAuthRequiredException,
    )
    INSTALOADER_AVAILABLE = True
except ImportError:
    INSTALOADER_AVAILABLE = False

# Try to import instagrapi - alternative Instagram API (optional, experimental)
# Set USE_INSTAGRAPI = False to disable instagrapi and use web scraping only
USE_INSTAGRAPI = False  # Disabled: instagrapi has Pydantic validation errors with current Instagram API
try:
    if USE_INSTAGRAPI:
        from instagrapi import Client
        INSTAGRAPI_AVAILABLE = True
    else:
        INSTAGRAPI_AVAILABLE = False
except ImportError:
    INSTAGRAPI_AVAILABLE = False


SHORTCODE_RE = re.compile(r"(?:instagram\.com/(?:p|reel|tv)/|/p/)([A-Za-z0-9_-]+)")


class InstagramServiceError(RuntimeError):
    """Raised when Instaloader cannot download the requested media."""


class InstagramService:
    """Wrapper around Instaloader or web scraping to fetch Instagram post images."""

    @staticmethod
    def _extract_shortcode(url: str) -> str:
        match = SHORTCODE_RE.search(url)
        if not match:
            raise InstagramServiceError("Could not extract Instagram shortcode from the provided URL.")
        return match.group(1)

    @staticmethod
    def download_post_images_instagrapi(
        username: Optional[str] = None,
        password: Optional[str] = None,
        url: str = "",
        target_dir: str = "",
    ) -> List[str]:
        """
        Download images from Instagram post using instagrapi (experimental).
        
        Requires instagrapi library and may require credentials for better results.
        Falls back to no-login method if instagrapi fails.
        
        Args:
            username: Instagram username (optional, but improves quality)
            password: Instagram password (optional)
            url: Instagram post URL
            target_dir: Directory to save downloaded images
            
        Returns:
            List of paths to downloaded image files
            
        Raises:
            InstagramServiceError: If extraction or download fails
        """
        if not INSTAGRAPI_AVAILABLE:
            raise InstagramServiceError(
                "instagrapi is not installed. Install it with: pip install instagrapi"
            )
        
        os.makedirs(target_dir, exist_ok=True)
        shortcode = InstagramService._extract_shortcode(url)
        
        try:
            cl = Client()
            
            # If credentials provided, login for better access
            if username and password and username.strip() and password.strip().lower() != "string":
                try:
                    cl.login(username, password)
                except Exception as e:
                    # If login fails, try without login (public access)
                    pass
            
            # Get media by shortcode
            media_pk = cl.media_pk_from_url(url)
            media_info = cl.media_info(media_pk)
            
            image_paths = []
            
            # Handle single image post
            if media_info.media_type == 1:  # Photo
                try:
                    cl.photo_download(media_pk, folder=target_dir, filename=f"{shortcode}_0.jpg")
                    # Check for the actual downloaded file (instagrapi may add extension or use different naming)
                    # Look for any file that starts with the shortcode
                    for file in os.listdir(target_dir):
                        if file.startswith(f"{shortcode}_") and file.endswith(('.jpg', '.jpeg', '.png')):
                            full_path = os.path.join(target_dir, file)
                            if os.path.exists(full_path) and os.path.getsize(full_path) > 0:
                                image_paths.append(full_path)
                except Exception as e:
                    raise InstagramServiceError(f"Failed to download photo: {e}") from e
            
            # Handle album/carousel post
            elif media_info.media_type == 8:  # Album/Carousel
                resources = media_info.resources or []
                for idx, resource in enumerate(resources):
                    if resource.media_type == 1:  # Photo only
                        try:
                            cl.photo_download(resource.pk, folder=target_dir, filename=f"{shortcode}_{idx}.jpg")
                            # Check for the actual downloaded file
                            for file in os.listdir(target_dir):
                                if file.startswith(f"{shortcode}_{idx}") and file.endswith(('.jpg', '.jpeg', '.png')):
                                    full_path = os.path.join(target_dir, file)
                                    if os.path.exists(full_path) and os.path.getsize(full_path) > 0 and full_path not in image_paths:
                                        image_paths.append(full_path)
                        except Exception as e:
                            # Log error but continue with other images
                            continue
            
            if not image_paths:
                raise InstagramServiceError("No images were downloaded via instagrapi.")
            
            return image_paths
                
        except Exception as e:
            # Log the full error for debugging
            error_msg = str(e)
            raise InstagramServiceError(f"instagrapi download failed: {error_msg}") from e

    @staticmethod
    def _get_images_from_node_scraper(url: str) -> Optional[List[str]]:
        """
        Get image URLs using Node.js instagram-media-scraper script.
        
        Falls back to GraphQL Python implementation if Node.js unavailable.
        
        Args:
            url: Instagram post URL
            
        Returns:
            List of image URLs or None if Node.js not available
        """
        import subprocess
        import os
        
        script_path = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "instagram_scraper.js")
        
        try:
            # Try to run Node.js script
            result = subprocess.run(
                ["node", script_path, url],
                capture_output=True,
                text=True,
                timeout=15,
                check=False
            )
            
            if result.returncode == 0 and result.stdout:
                try:
                    # Parse JSON array of URLs
                    image_urls = json.loads(result.stdout.strip())
                    if isinstance(image_urls, list) and len(image_urls) > 0:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.info(f"Node.js scraper: Found {len(image_urls)} images")
                        return image_urls
                except json.JSONDecodeError:
                    # Output might be error JSON
                    pass
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            # Node.js not available or script failed - fall back to Python implementation
            pass
        
        return None
    
    @staticmethod
    def _get_images_from_graphql(shortcode: str) -> List[str]:
        """
        Get high-quality image URLs from Instagram using GraphQL API (no login required).
        
        Based on: https://github.com/ahmedrangel/instagram-media-scraper
        
        Args:
            shortcode: Instagram post shortcode (e.g., "DRHiuniDM1K")
            
        Returns:
            List of high-quality image URLs
        """
        image_urls = []
        
        try:
            # Instagram GraphQL endpoint
            graphql_url = "https://www.instagram.com/api/graphql"
            
            # GraphQL query parameters
            variables = json.dumps({"shortcode": shortcode})
            doc_id = "10015901848480474"  # Instagram's internal doc ID for media queries
            lsd = "AVqbxe3J_YA"  # Instagram's LSD token
            
            # Build request URL
            from urllib.parse import urlencode
            params = {
                "variables": variables,
                "doc_id": doc_id,
                "lsd": lsd
            }
            request_url = f"{graphql_url}?{urlencode(params)}"
            
            # Headers to mimic browser request
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-IG-App-ID': '936619743392459',  # Instagram's web app ID
                'X-FB-LSD': lsd,
                'X-ASBD-ID': '129477',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Referer': 'https://www.instagram.com/',
                'Origin': 'https://www.instagram.com',
            }
            
            # Make GraphQL request
            response = requests.post(
                request_url,
                headers=headers,
                timeout=15
            )
            response.raise_for_status()
            
            data = response.json()
            
            # Extract media data from GraphQL response
            media = data.get("data", {}).get("xdt_shortcode_media")
            if not media:
                return image_urls
            
            # Single image post - get display_resources (sorted by quality, highest first)
            display_resources = media.get("display_resources", [])
            if display_resources:
                # display_resources is sorted by quality (lowest to highest)
                # Get the highest quality resource (last in list, usually largest)
                best_resource = display_resources[-1]  # Last one is highest quality
                if "src" in best_resource:
                    image_urls.append(best_resource["src"])
                    # Also log the quality for debugging
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"GraphQL: Found image {best_resource.get('config_width', '?')}x{best_resource.get('config_height', '?')}")
            elif media.get("display_url"):
                # Fallback to display_url
                image_urls.append(media["display_url"])
                import logging
                logger = logging.getLogger(__name__)
                logger.info("GraphQL: Using display_url fallback")
            
            # Carousel post (sidecar)
            sidecar = media.get("edge_sidecar_to_children", {}).get("edges", [])
            if sidecar:
                for edge in sidecar:
                    node = edge.get("node", {})
                    # Get highest quality from display_resources
                    node_resources = node.get("display_resources", [])
                    if node_resources:
                        best_node_resource = node_resources[-1]  # Last one is highest quality
                        if "src" in best_node_resource:
                            img_url = best_node_resource["src"]
                            if img_url not in image_urls:
                                image_urls.append(img_url)
                    elif node.get("display_url"):
                        img_url = node["display_url"]
                        if img_url not in image_urls:
                            image_urls.append(img_url)
            
            # Remove duplicates while preserving order
            seen = set()
            unique_urls = []
            for url in image_urls:
                if url and url not in seen:
                    seen.add(url)
                    unique_urls.append(url)
            
            return unique_urls
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"GraphQL method failed for shortcode {shortcode}: {e}")
            return []
    
    @staticmethod
    def download_post_images_no_login(url: str, target_dir: str) -> List[str]:
        """
        Download images from Instagram post without login.
        
        First tries GraphQL method (higher quality), then falls back to HTML scraping.
        
        Args:
            url: Instagram post URL
            target_dir: Directory to save downloaded images
            
        Returns:
            List of paths to downloaded image files
            
        Raises:
            InstagramServiceError: If extraction or download fails
        """
        os.makedirs(target_dir, exist_ok=True)
        shortcode = InstagramService._extract_shortcode(url)
        
        # Try Node.js scraper first (if available)
        image_urls = InstagramService._get_images_from_node_scraper(url)
        
        # Fall back to Python GraphQL implementation
        if not image_urls:
            image_urls = InstagramService._get_images_from_graphql(shortcode)
        
        # Use the image URLs we found
        if image_urls:
            graphql_urls = image_urls
        if graphql_urls:
            # Download images from GraphQL URLs (already high quality)
            image_paths = []
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.instagram.com/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            }
            
            for idx, img_url in enumerate(graphql_urls[:10]):  # Limit to 10 images
                try:
                    parsed_url = urlparse(img_url)
                    ext = os.path.splitext(parsed_url.path)[1] or '.jpg'
                    if '?' in ext:
                        ext = ext.split('?')[0]
                    
                    filepath = os.path.join(target_dir, f"{shortcode}_{idx}{ext}")
                    
                    img_response = requests.get(img_url, headers=headers, timeout=15, stream=True)
                    img_response.raise_for_status()
                    
                    with open(filepath, 'wb') as f:
                        for chunk in img_response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    if os.path.exists(filepath) and os.path.getsize(filepath) > 1024:
                        image_paths.append(filepath)
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Failed to download image {idx} from GraphQL: {e}")
                    continue
            
            if image_paths:
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Successfully downloaded {len(image_paths)} images using GraphQL method")
                return image_paths
        
        # Fallback to HTML scraping method
        # Fetch the Instagram post page
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            html = response.text
        except requests.RequestException as e:
            raise InstagramServiceError(f"Failed to fetch Instagram post page: {e}") from e
        
        # Extract image URLs from HTML
        image_urls = []
        
        # Method 1: Extract from Open Graph meta tags (these are usually higher quality)
        og_image_pattern = r'<meta\s+property="og:image"\s+content="([^"]+)"'
        og_image_matches = re.findall(og_image_pattern, html)
        for url in og_image_matches:
            # Remove ALL query parameters to get potentially higher resolution
            # Instagram OG images often have size parameters like s640x640, s1080x1080
            # Removing params may get us the original size
            base_url = url.split('?')[0] if '?' in url else url
            # Try to remove size suffixes from path (e.g., /s640x640/)
            base_url = re.sub(r'/s\d+x\d+/', '/', base_url)
            if base_url not in image_urls:
                image_urls.append(base_url)
        
        # Method 2: Extract from JSON-LD structured data
        json_ld_pattern = r'<script type="application/ld\+json">(.*?)</script>'
        json_ld_matches = re.findall(json_ld_pattern, html, re.DOTALL)
        for json_str in json_ld_matches:
            try:
                data = json.loads(json_str)
                # Check for image in various possible locations
                if isinstance(data, dict):
                    if 'image' in data:
                        img = data['image']
                        if isinstance(img, str):
                            image_urls.append(img)
                        elif isinstance(img, dict) and 'url' in img:
                            image_urls.append(img['url'])
                        elif isinstance(img, list) and len(img) > 0:
                            if isinstance(img[0], str):
                                image_urls.append(img[0])
                            elif isinstance(img[0], dict) and 'url' in img[0]:
                                image_urls.append(img[0]['url'])
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and 'image' in item:
                            img = item['image']
                            if isinstance(img, str):
                                image_urls.append(img)
                            elif isinstance(img, dict) and 'url' in img:
                                image_urls.append(img['url'])
            except (json.JSONDecodeError, KeyError, TypeError):
                continue
        
        # Method 3: Extract from window._sharedData (Instagram embeds data here)
        shared_data_pattern = r'window\._sharedData\s*=\s*({.*?});'
        shared_data_match = re.search(shared_data_pattern, html, re.DOTALL)
        if shared_data_match:
            try:
                shared_data = json.loads(shared_data_match.group(1))
                # Navigate through Instagram's data structure
                entry_data = shared_data.get('entry_data', {})
                for page in entry_data.values():
                    if isinstance(page, list) and len(page) > 0:
                        post_page = page[0]
                        if 'graphql' in post_page:
                            shortcode_media = post_page['graphql'].get('shortcode_media', {})
                            # Single image post - prefer high_resolution_video or display_url
                            if 'display_resources' in shortcode_media:
                                # display_resources is an array sorted by quality (highest first)
                                resources = shortcode_media.get('display_resources', [])
                                if resources:
                                    # Get the highest quality (first) resource
                                    best_resource = resources[0]
                                    if 'src' in best_resource:
                                        # Remove size parameters to potentially get higher resolution
                                        url = best_resource['src']
                                        url = re.sub(r'[?&]w=\d+[&]?', '', url)
                                        url = re.sub(r'[?&]h=\d+[&]?', '', url)
                                        url = re.sub(r'[?&]s=\d+[&]?', '', url)
                                        url = re.sub(r'[?&]c=\d+[&]?', '', url)
                                        image_urls.append(url)
                            elif 'display_url' in shortcode_media:
                                image_urls.append(shortcode_media['display_url'])
                            # Carousel post
                            if 'edge_sidecar_to_children' in shortcode_media:
                                edges = shortcode_media['edge_sidecar_to_children'].get('edges', [])
                                for edge in edges:
                                    node = edge.get('node', {})
                                    # Prefer display_resources for carousel too
                                    if 'display_resources' in node:
                                        resources = node.get('display_resources', [])
                                        if resources and 'src' in resources[0]:
                                            # Remove size parameters for higher resolution
                                            url = resources[0]['src']
                                            url = re.sub(r'[?&]w=\d+[&]?', '', url)
                                            url = re.sub(r'[?&]h=\d+[&]?', '', url)
                                            url = re.sub(r'[?&]s=\d+[&]?', '', url)
                                            url = re.sub(r'[?&]c=\d+[&]?', '', url)
                                            image_urls.append(url)
                                    elif 'display_url' in node:
                                        image_urls.append(node['display_url'])
            except (json.JSONDecodeError, KeyError, TypeError):
                pass
        
        # Method 4: Extract from __additionalDataLoaded (newer Instagram format)
        additional_data_pattern = r'__additionalDataLoaded\([^,]+,\s*({.*?})\);'
        additional_data_matches = re.findall(additional_data_pattern, html, re.DOTALL)
        for data_str in additional_data_matches:
            try:
                data = json.loads(data_str)
                # Navigate through nested structure to find images
                if isinstance(data, dict):
                    # Try common paths
                    for path in ['graphql', 'shortcode_media', 'data', 'media']:
                        current = data
                        for key in path.split('.'):
                            if isinstance(current, dict) and key in current:
                                current = current[key]
                            else:
                                break
                        else:
                            if isinstance(current, dict):
                                if 'display_url' in current:
                                    image_urls.append(current['display_url'])
            except (json.JSONDecodeError, KeyError, TypeError):
                continue
        
        # Method 5: Extract from require("TimeSliceImpl") pattern (Instagram's React JSON)
        react_json_pattern = r'require\("TimeSliceImpl"\)[^;]*;([^<]*)'
        react_matches = re.findall(react_json_pattern, html, re.DOTALL)
        for match in react_matches:
            # Look for JSON-like structures in the React code
            json_like_pattern = r'"display_url":"([^"]+)"'
            display_urls = re.findall(json_like_pattern, match)
            image_urls.extend(display_urls)
        
        # Method 6: Try to find any Instagram CDN URLs in the HTML
        instagram_cdn_pattern = r'(https?://[^"]*instagram\.com[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)'
        cdn_matches = re.findall(instagram_cdn_pattern, html, re.IGNORECASE)
        image_urls.extend(cdn_matches)
        
        # Remove duplicates while preserving order (first pass)
        seen_first = set()
        unique_image_urls = []
        for url in image_urls:
            if url and url not in seen_first:
                seen_first.add(url)
                unique_image_urls.append(url)
        
        if not unique_image_urls:
            # Try one more method: look for any img tags with src containing cdninstagram
            img_tag_pattern = r'<img[^>]+src="([^"]*cdninstagram[^"]*)"'
            img_tag_matches = re.findall(img_tag_pattern, html, re.IGNORECASE)
            if img_tag_matches:
                unique_image_urls.extend(img_tag_matches)
        
        # Remove duplicates again after adding img tags and filter valid URLs
        # Prioritize higher resolution versions by removing size parameters
        final_seen = set()
        final_image_urls = []
        
        # Sort URLs to prefer display_resources (from window._sharedData) which are usually higher quality
        # These typically come before CDN URLs in our extraction
        prioritized_urls = unique_image_urls
        
        for url in prioritized_urls:
            if not url or not url.startswith('http'):
                continue
            
            # Try multiple URL variations to get higher resolution
            url_variants = [url]
            
            # Variant 1: Remove size parameters from query string
            # Instagram CDN URLs often have: ?stp=...s640x640... or s1080x1080
            cleaned = re.sub(r'[?&]stp=[^&]*s\d+x\d+[^&]*', '', url)
            cleaned = re.sub(r'[?&]s=\d+x\d+', '', cleaned)
            cleaned = re.sub(r'[?&](w|h|width|height|fit|quality)=[^&]*', '', cleaned)
            if cleaned != url:
                url_variants.append(cleaned)
            
            # Variant 2: Remove size suffixes from path (e.g., /s640x640/)
            path_cleaned = re.sub(r'/s\d+x\d+/', '/', url)
            if path_cleaned != url and path_cleaned not in url_variants:
                url_variants.append(path_cleaned)
            
            # Variant 3: Try to extract base CDN URL without size params
            # Instagram format: https://scontent-xxx.cdninstagram.com/v/t51.xxx/.../image.jpg?stp=...
            if 'cdninstagram.com' in url:
                # Try removing all query params to get base URL
                base_url = url.split('?')[0]
                if base_url not in url_variants and base_url != url:
                    url_variants.append(base_url)
            
            # Add all variants (they'll be tried in order during download)
            for variant in url_variants:
                if variant and variant.startswith('http') and variant not in final_seen:
                    final_seen.add(variant)
                    # Prefer cleaned variants (higher resolution) over original
                    if variant != url:
                        # Insert cleaned version first
                        final_image_urls.insert(0, variant) if variant not in final_image_urls else None
                    elif url not in final_image_urls:
                        final_image_urls.append(url)
            
            # Add original if not already added
            if url not in final_seen:
                final_seen.add(url)
                if url not in final_image_urls:
                    final_image_urls.append(url)
        
        # Remove duplicates while preserving order (prefer cleaned URLs first)
        final_image_urls = list(dict.fromkeys(final_image_urls))
        
        if not final_image_urls:
            # Check if this might be a private post (login required)
            private_indicators = [
                'Log In' in html[:1000],
                'Sign Up' in html[:1000],
                'This page isn\'t available' in html,
                'Sorry, this page' in html,
            ]
            
            if any(private_indicators):
                raise InstagramServiceError(
                    f"Instagram post appears to be private or requires login. "
                    f"Please provide username and password to access this post, or the post may not be publicly accessible."
                )
            
            # Log some debug info before failing
            debug_info = {
                'has_og_image': bool(og_image_matches),
                'has_json_ld': len(json_ld_matches) > 0,
                'has_shared_data': bool(shared_data_match),
                'html_length': len(html),
                'html_preview': html[:500] if len(html) > 0 else 'Empty HTML',
                'might_be_private': any(private_indicators)
            }
            raise InstagramServiceError(
                f"Could not extract image URLs from Instagram post. "
                f"The post might be private, deleted, or Instagram's page structure has changed. "
                f"Try: 1) Providing username/password for private posts, 2) Using a direct image URL instead, "
                f"or 3) Manually uploading screenshots. Debug info: {debug_info}"
            )
        
        # Download images with retry logic for expired/blocked URLs
        image_paths = []
        for idx, img_url in enumerate(final_image_urls[:10]):  # Limit to first 10 images (carousel posts)
            max_retries = 2
            downloaded = False
            original_url = img_url  # Keep original for retry
            
            for attempt in range(max_retries):
                try:
                    # Get image extension from URL or default to jpg
                    parsed_url = urlparse(img_url)
                    ext = os.path.splitext(parsed_url.path)[1] or '.jpg'
                    if '?' in ext:
                        ext = ext.split('?')[0]
                    
                    filepath = os.path.join(target_dir, f"{shortcode}_{idx}{ext}")
                    
                    # Use same headers as page fetch for consistency
                    img_headers = headers.copy()
                    img_headers['Referer'] = 'https://www.instagram.com/'
                    img_headers['Accept'] = 'image/webp,image/apng,image/*,*/*;q=0.8'
                    
                    # Download the image with timeout
                    img_response = requests.get(img_url, headers=img_headers, timeout=15, stream=True, allow_redirects=True)
                    
                    # Handle 403/404 - might be expired or blocked
                    if img_response.status_code == 403:
                        if attempt < max_retries - 1:
                            # Try original URL without cleaning on retry
                            img_url = original_url
                            continue
                        continue
                    elif img_response.status_code == 404:
                        # URL expired, skip this one
                        break
                    
                    img_response.raise_for_status()
                    
                    # Download in chunks
                    with open(filepath, 'wb') as f:
                        for chunk in img_response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    # Verify the file was downloaded and has reasonable size (>1KB)
                    if os.path.exists(filepath) and os.path.getsize(filepath) > 1024:
                        image_paths.append(filepath)
                        downloaded = True
                        break  # Success, move to next image
                    else:
                        # File too small or missing
                        if os.path.exists(filepath):
                            os.remove(filepath)
                        continue
                        
                except requests.RequestException as e:
                    # If it's a 403/404 on last attempt, skip this image
                    if attempt == max_retries - 1:
                        continue
                    # Otherwise retry with original URL
                    img_url = original_url
                
                except Exception as e:
                    # Unexpected error, log and continue
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Error downloading image {idx} from {img_url}: {e}")
                    continue
            
            if not downloaded:
                # Could not download this image after retries
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to download image {idx} after {max_retries} attempts: {img_url}")
        
        if not image_paths:
            # Provide helpful error message
            error_msg = (
                f"Failed to download images from Instagram post. "
                f"Possible reasons: "
                f"1) Images URLs expired or blocked by Instagram CDN, "
                f"2) Post is private (requires login), "
                f"3) Rate limiting or geo-restrictions. "
                f"Suggestion: Try providing username/password, or manually upload screenshots."
            )
            raise InstagramServiceError(error_msg)
        
        # Log success
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Successfully downloaded {len(image_paths)} images from Instagram post {shortcode}")
        
        return image_paths

    @staticmethod
    def download_post_images(
        username: Optional[str] = None,
        password: Optional[str] = None,
        url: str = "",
        target_dir: str = "",
    ) -> List[str]:
        """
        Download all images for a single Instagram post.
        
        If username/password are provided, uses Instaloader (requires login).
        Otherwise, attempts to download images without login using web scraping.
        
        Args:
            username: Instagram username (optional, if not provided, uses no-login method)
            password: Instagram password (optional)
            url: Instagram post URL
            target_dir: Directory to save downloaded images
            
        Returns:
            List of paths to downloaded image files
        """
        # Try instagrapi first if available (experimental - better image quality)
        # Only if credentials are provided and valid
        username_valid = username and username.strip() and username.strip().lower() != "string"
        password_valid = password and password.strip() and password.strip().lower() != "string"
        
        if INSTAGRAPI_AVAILABLE and username_valid and password_valid:
            try:
                return InstagramService.download_post_images_instagrapi(
                    username=username,
                    password=password,
                    url=url,
                    target_dir=target_dir,
                )
            except (InstagramServiceError, Exception) as e:
                # Log the error and fall back to web scraping if instagrapi fails
                # This allows us to try instagrapi but fall back gracefully
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"instagrapi failed, falling back to web scraping: {e}")
                # Continue to fallback methods below
                pass
        
        # If no credentials provided (None or empty string), use no-login method
        if not username_valid or not password_valid:
            return InstagramService.download_post_images_no_login(url, target_dir)
        
        # If credentials provided but instagrapi failed, try web scraping as fallback
        # This is safer than trying Instaloader which may also have issues
        return InstagramService.download_post_images_no_login(url, target_dir)
        
        # Otherwise, use Instaloader (requires login)
        if not INSTALOADER_AVAILABLE:
            raise InstagramServiceError(
                "Instaloader is not installed. Install it with: pip install instaloader"
            )
        
        if not url or not target_dir:
            raise InstagramServiceError("URL and target_dir are required.")
        
        os.makedirs(target_dir, exist_ok=True)
        shortcode = InstagramService._extract_shortcode(url)

        loader = instaloader.Instaloader(
            download_videos=False,
            download_video_thumbnails=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            post_metadata_txt_pattern="",
            dirname_pattern=target_dir,
            filename_pattern=f"{shortcode}_{{index}}",
            quiet=True,
        )

        try:
            loader.login(username, password)
        except TwoFactorAuthRequiredException as exc:
            raise InstagramServiceError(
                "Two-factor authentication is required for this account, which is not supported yet."
            ) from exc
        except BadCredentialsException as exc:
            raise InstagramServiceError("Instagram login failed: invalid username or password.") from exc
        except ConnectionException as exc:
            raise InstagramServiceError(f"Instagram login failed: {exc}.") from exc

        try:
            post = Post.from_shortcode(loader.context, shortcode)
        except InstaloaderException as exc:
            raise InstagramServiceError(f"Could not load Instagram post: {exc}.") from exc

        nodes = []
        if post.typename == "GraphSidecar":
            nodes.extend(post.get_sidecar_nodes())
        else:
            nodes.append(post)

        image_paths: List[str] = []
        for idx, node in enumerate(nodes):
            if getattr(node, "is_video", False):
                continue

            filepath_root = os.path.join(target_dir, f"{shortcode}_{idx}")
            media_url = getattr(node, "display_url", None) or getattr(node, "url", None)
            if not media_url:
                continue

            media_date = getattr(node, "date_utc", getattr(post, "date_utc", None))
            downloaded = loader.download_pic(filepath_root, media_url, media_date)
            if not downloaded:
                continue

            basename = os.path.basename(filepath_root)
            for entry in os.listdir(target_dir):
                if entry.startswith(basename):
                    candidate = os.path.join(target_dir, entry)
                    if os.path.isfile(candidate):
                        image_paths.append(candidate)
                        break

        if not image_paths:
            raise InstagramServiceError("No images were downloaded for the Instagram post.")

        return image_paths




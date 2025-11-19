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
    def download_post_images_no_login(url: str, target_dir: str) -> List[str]:
        """
        Download images from Instagram post without login by extracting URLs from page HTML.
        
        This method fetches the Instagram post page and extracts image URLs from:
        - Open Graph meta tags (og:image)
        - JSON-LD structured data
        - Page metadata
        
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
            # Try to get higher resolution version by removing size parameters
            # Instagram URLs often have ?width=XXX&height=XXX - remove those for full size
            high_res_url = re.sub(r'[?&](width|height|quality|fit)=[^&]*', '', url)
            if high_res_url not in image_urls:
                image_urls.append(high_res_url)
        
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
        final_seen = set()
        final_image_urls = []
        for url in unique_image_urls:
            if url and url.startswith('http') and url not in final_seen:
                final_seen.add(url)
                final_image_urls.append(url)
        
        if not final_image_urls:
            # Log some debug info before failing
            debug_info = {
                'has_og_image': bool(og_image_matches),
                'has_json_ld': len(json_ld_matches) > 0,
                'has_shared_data': bool(shared_data_match),
                'html_length': len(html),
                'html_preview': html[:500] if len(html) > 0 else 'Empty HTML'
            }
            raise InstagramServiceError(
                f"Could not extract image URLs from Instagram post. "
                f"The post might be private, deleted, or Instagram's page structure has changed. "
                f"Debug info: {debug_info}"
            )
        
        # Download images
        image_paths = []
        for idx, img_url in enumerate(final_image_urls):
            try:
                # Get image extension from URL or default to jpg
                parsed_url = urlparse(img_url)
                ext = os.path.splitext(parsed_url.path)[1] or '.jpg'
                if '?' in ext:
                    ext = ext.split('?')[0]
                
                filepath = os.path.join(target_dir, f"{shortcode}_{idx}{ext}")
                
                # Download the image
                img_response = requests.get(img_url, headers=headers, timeout=15, stream=True)
                img_response.raise_for_status()
                
                with open(filepath, 'wb') as f:
                    for chunk in img_response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                    image_paths.append(filepath)
            except requests.RequestException as e:
                # Log error but continue with other images
                continue
        
        if not image_paths:
            raise InstagramServiceError("Failed to download any images from the extracted URLs.")
        
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




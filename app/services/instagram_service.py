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
        
        # Method 1: Extract from Open Graph meta tags
        og_image_pattern = r'<meta\s+property="og:image"\s+content="([^"]+)"'
        og_image_matches = re.findall(og_image_pattern, html)
        image_urls.extend(og_image_matches)
        
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
                            # Single image post
                            if 'display_url' in shortcode_media:
                                image_urls.append(shortcode_media['display_url'])
                            # Carousel post
                            if 'edge_sidecar_to_children' in shortcode_media:
                                edges = shortcode_media['edge_sidecar_to_children'].get('edges', [])
                                for edge in edges:
                                    node = edge.get('node', {})
                                    if 'display_url' in node:
                                        image_urls.append(node['display_url'])
            except (json.JSONDecodeError, KeyError, TypeError):
                pass
        
        # Method 4: Try to find image URLs in script tags with __additionalDataLoaded
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
        
        # Remove duplicates while preserving order
        seen = set()
        unique_image_urls = []
        for url in image_urls:
            if url and url not in seen:
                seen.add(url)
                unique_image_urls.append(url)
        
        if not unique_image_urls:
            raise InstagramServiceError(
                "Could not extract image URLs from Instagram post. "
                "The post might be private, deleted, or Instagram's page structure has changed."
            )
        
        # Download images
        image_paths = []
        for idx, img_url in enumerate(unique_image_urls):
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
        # If no credentials provided, use no-login method
        if not username or not password:
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




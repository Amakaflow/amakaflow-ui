"""TikTok video ingestion service for workout extraction."""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

# Check for yt-dlp availability
try:
    import yt_dlp
    YT_DLP_AVAILABLE = True
except ImportError:
    YT_DLP_AVAILABLE = False


class TikTokServiceError(RuntimeError):
    """Raised when TikTok video processing fails."""


@dataclass
class TikTokVideoMetadata:
    """Metadata extracted from a TikTok video."""
    video_id: str
    url: str
    title: str
    author_name: str
    author_url: str
    thumbnail_url: Optional[str] = None
    thumbnail_width: Optional[int] = None
    thumbnail_height: Optional[int] = None
    embed_html: Optional[str] = None
    provider_name: str = "TikTok"
    provider_url: str = "https://www.tiktok.com"
    hashtags: List[str] = field(default_factory=list)
    duration_seconds: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


class TikTokService:
    """Service for downloading and processing TikTok videos for workout extraction."""
    
    OEMBED_URL = "https://www.tiktok.com/oembed"
    
    # Regex patterns for TikTok URLs
    VIDEO_ID_PATTERN = re.compile(r'/video/(\d+)')
    SHORTCODE_PATTERN = re.compile(r'tiktok\.com/(?:@[\w.]+/video/|t/)([A-Za-z0-9_-]+)')
    
    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """
        Extract video ID from a TikTok URL.
        
        Supports:
        - https://www.tiktok.com/@username/video/1234567890
        - https://vm.tiktok.com/XXXXXX/
        - https://www.tiktok.com/t/XXXXXX/
        
        Args:
            url: TikTok video URL
            
        Returns:
            Video ID string or None if not found
        """
        # Standard format: /video/ID
        match = TikTokService.VIDEO_ID_PATTERN.search(url)
        if match:
            return match.group(1)
        
        # Short URL formats will need to be resolved first
        return None
    
    @staticmethod
    def normalize_url(url: str) -> str:
        """
        Normalize a TikTok URL by removing query parameters.
        
        Args:
            url: Input TikTok URL
            
        Returns:
            Normalized URL
        """
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    
    @staticmethod
    def is_short_url(url: str) -> bool:
        """Check if URL is a shortened TikTok URL that needs resolution."""
        return 'vm.tiktok.com' in url or '/t/' in url
    
    @staticmethod
    def resolve_short_url(short_url: str) -> Optional[str]:
        """
        Resolve a shortened TikTok URL to full URL.
        
        Args:
            short_url: Shortened TikTok URL
            
        Returns:
            Full TikTok URL or None if resolution fails
        """
        try:
            response = requests.head(
                short_url, 
                allow_redirects=True, 
                timeout=10,
                headers={"User-Agent": "Mozilla/5.0"}
            )
            return response.url
        except Exception as e:
            logger.warning(f"Failed to resolve short URL {short_url}: {e}")
            return None
    
    @staticmethod
    def get_oembed_metadata(url: str) -> Optional[Dict[str, Any]]:
        """
        Fetch metadata using TikTok's oEmbed API.
        
        This is the official, public API that doesn't require authentication.
        
        Args:
            url: TikTok video URL
            
        Returns:
            oEmbed response dictionary or None on error
        """
        try:
            response = requests.get(
                TikTokService.OEMBED_URL,
                params={"url": url},
                timeout=15,
                headers={
                    "User-Agent": "WorkoutIngestorAPI/1.0",
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.warning(f"oEmbed request failed: {e}")
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"oEmbed JSON parsing failed: {e}")
            return None
    
    @staticmethod
    def extract_hashtags(text: str) -> List[str]:
        """Extract hashtags from text."""
        if not text:
            return []
        return re.findall(r'#(\w+)', text)
    
    @staticmethod
    def extract_metadata(url: str) -> TikTokVideoMetadata:
        """
        Extract comprehensive metadata from a TikTok video.
        
        Uses oEmbed API for public metadata extraction.
        
        Args:
            url: TikTok video URL
            
        Returns:
            TikTokVideoMetadata with all available metadata
            
        Raises:
            TikTokServiceError: If metadata extraction fails
        """
        # Normalize URL
        url = TikTokService.normalize_url(url)
        
        # Resolve short URLs
        if TikTokService.is_short_url(url):
            resolved = TikTokService.resolve_short_url(url)
            if resolved:
                url = TikTokService.normalize_url(resolved)
            else:
                raise TikTokServiceError(f"Failed to resolve short URL: {url}")
        
        # Extract video ID
        video_id = TikTokService.extract_video_id(url)
        if not video_id:
            raise TikTokServiceError(f"Could not extract video ID from URL: {url}")
        
        # Get oEmbed data
        oembed_data = TikTokService.get_oembed_metadata(url)
        if not oembed_data:
            raise TikTokServiceError(f"Failed to fetch oEmbed metadata for: {url}")
        
        # Extract title and hashtags
        title = oembed_data.get('title', '')
        hashtags = TikTokService.extract_hashtags(title)
        
        return TikTokVideoMetadata(
            video_id=video_id,
            url=url,
            title=title,
            author_name=oembed_data.get('author_name', ''),
            author_url=oembed_data.get('author_url', ''),
            thumbnail_url=oembed_data.get('thumbnail_url'),
            thumbnail_width=oembed_data.get('thumbnail_width'),
            thumbnail_height=oembed_data.get('thumbnail_height'),
            embed_html=oembed_data.get('html'),
            hashtags=hashtags,
        )
    
    @staticmethod
    def download_video(url: str, target_dir: str) -> Optional[str]:
        """
        Download TikTok video using yt-dlp.
        
        Args:
            url: TikTok video URL
            target_dir: Directory to save the video
            
        Returns:
            Path to downloaded video file or None on error
        """
        if not YT_DLP_AVAILABLE:
            raise TikTokServiceError(
                "yt-dlp is not installed. Install with: pip install yt-dlp"
            )
        
        os.makedirs(target_dir, exist_ok=True)
        
        # Extract video ID for filename
        video_id = TikTokService.extract_video_id(url) or "tiktok_video"
        output_template = os.path.join(target_dir, f"{video_id}.%(ext)s")
        
        ydl_opts = {
            "outtmpl": output_template,
            "format": "best[ext=mp4]/best",
            "quiet": True,
            "no_warnings": True,
            "nocheckcertificate": True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                # Find the downloaded file
                if info:
                    ext = info.get('ext', 'mp4')
                    video_path = os.path.join(target_dir, f"{video_id}.{ext}")
                    if os.path.exists(video_path):
                        return video_path
                
                # Fallback: look for any video file
                for ext in ['mp4', 'webm', 'mkv']:
                    video_path = os.path.join(target_dir, f"{video_id}.{ext}")
                    if os.path.exists(video_path):
                        return video_path
                
                return None
                
        except Exception as e:
            logger.error(f"Failed to download TikTok video: {e}")
            return None
    
    @staticmethod
    def download_video_subprocess(url: str, target_dir: str) -> Optional[str]:
        """
        Download TikTok video using yt-dlp as subprocess (fallback).
        
        Args:
            url: TikTok video URL
            target_dir: Directory to save the video
            
        Returns:
            Path to downloaded video file or None on error
        """
        os.makedirs(target_dir, exist_ok=True)
        
        video_id = TikTokService.extract_video_id(url) or "tiktok_video"
        output_template = os.path.join(target_dir, f"{video_id}.%(ext)s")
        
        try:
            result = subprocess.run(
                [
                    "yt-dlp",
                    "--no-warnings",
                    "-o", output_template,
                    "--format", "best[ext=mp4]/best",
                    url
                ],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                # Find the downloaded file
                for ext in ['mp4', 'webm', 'mkv']:
                    video_path = os.path.join(target_dir, f"{video_id}.{ext}")
                    if os.path.exists(video_path):
                        return video_path
            else:
                logger.error(f"yt-dlp failed: {result.stderr}")
                
        except FileNotFoundError:
            logger.error("yt-dlp not found in PATH")
        except subprocess.TimeoutExpired:
            logger.error("Video download timed out")
        except Exception as e:
            logger.error(f"Video download failed: {e}")
        
        return None
    
    @staticmethod
    def download_thumbnail(thumbnail_url: str, target_dir: str, video_id: str) -> Optional[str]:
        """
        Download video thumbnail.
        
        Args:
            thumbnail_url: URL of the thumbnail
            target_dir: Directory to save the thumbnail
            video_id: Video ID for filename
            
        Returns:
            Path to downloaded thumbnail or None on error
        """
        if not thumbnail_url:
            return None
        
        os.makedirs(target_dir, exist_ok=True)
        
        try:
            response = requests.get(thumbnail_url, timeout=30)
            response.raise_for_status()
            
            # Determine extension from content type
            content_type = response.headers.get('content-type', 'image/jpeg')
            ext = 'jpg' if 'jpeg' in content_type else 'png' if 'png' in content_type else 'jpg'
            
            filepath = os.path.join(target_dir, f"{video_id}_thumbnail.{ext}")
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            return filepath
            
        except Exception as e:
            logger.warning(f"Failed to download thumbnail: {e}")
            return None
    
    @staticmethod
    def is_tiktok_url(url: str) -> bool:
        """
        Check if a URL is a valid TikTok video URL.
        
        Args:
            url: URL to check
            
        Returns:
            True if it's a TikTok video URL
        """
        tiktok_patterns = [
            r'tiktok\.com/@[\w.]+/video/\d+',
            r'tiktok\.com/t/[\w]+',
            r'vm\.tiktok\.com/[\w]+',
        ]
        
        for pattern in tiktok_patterns:
            if re.search(pattern, url, re.IGNORECASE):
                return True
        
        return False
    
    @staticmethod
    def extract_text_from_description(metadata: TikTokVideoMetadata) -> str:
        """
        Extract workout-relevant text from video metadata.
        
        Args:
            metadata: TikTok video metadata
            
        Returns:
            Extracted text for workout parsing
        """
        parts = []
        
        if metadata.title:
            parts.append(metadata.title)
        
        # Hashtags can indicate workout type
        if metadata.hashtags:
            workout_hashtags = [
                h for h in metadata.hashtags
                if any(kw in h.lower() for kw in [
                    'workout', 'fitness', 'exercise', 'gym', 'training',
                    'wod', 'hiit', 'cardio', 'strength', 'leg', 'arm',
                    'chest', 'back', 'shoulder', 'abs', 'core'
                ])
            ]
            if workout_hashtags:
                parts.append(' '.join(f"#{h}" for h in workout_hashtags))
        
        return '\n'.join(parts)
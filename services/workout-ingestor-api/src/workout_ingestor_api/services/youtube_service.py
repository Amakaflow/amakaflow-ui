"""Enhanced YouTube video processing service with metadata, captions, and chapters."""
import json
import os
import subprocess
import tempfile
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException
import requests

# Optional dependency (guarded)
try:
    import yt_dlp  # type: ignore
except ImportError:
    yt_dlp = None


class YouTubeService:
    """Service for extracting comprehensive metadata from YouTube videos."""
    
    @staticmethod
    def extract_metadata(url: str) -> Dict:
        """
        Extract comprehensive metadata from YouTube video.
        
        Returns:
            Dict with: title, description, chapters, captions, duration, publish_date
        """
        if yt_dlp is None:
            raise HTTPException(
                status_code=500,
                detail="yt-dlp is not installed. Run: pip install yt-dlp"
            )
        
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "nocheckcertificate": True,
            "writeautomaticsub": True,  # Get auto-generated captions
            "writesubtitles": True,     # Get manual captions
            "subtitleslangs": ["en", "en-US", "en-GB"],  # Prefer English
            "subtitlesformat": "json3",  # Get JSON format for structured data
            "youtube_include_dash_manifest": False,
            # For captions/chapters only - don't need video formats, so any SABR-safe client works
            # Using tv_embedded/mweb avoids SABR and PO token issues
            "extractor_args": {"youtube": {"player_client": ["tv_embedded", "mweb"]}},
        }
        
        try:
            # Add timeout wrapper for extraction
            import signal
            
            def timeout_handler(signum, frame):
                raise TimeoutError("Video metadata extraction timed out")
            
            # Set timeout (20 seconds)
            if hasattr(signal, 'SIGALRM'):
                signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(20)
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
            finally:
                if hasattr(signal, 'SIGALRM'):
                    signal.alarm(0)  # Cancel timeout
        except TimeoutError:
            raise HTTPException(
                status_code=408,
                detail="Video metadata extraction timed out. YouTube may be rate-limiting or the video is unavailable."
            )
        except Exception as e:
            # If extraction fails, try mweb client (also avoids SABR, no PO token needed)
            ydl_opts_minimal = {
                "quiet": True,
                "skip_download": True,
                "nocheckcertificate": True,
                "extractor_args": {"youtube": {"player_client": ["mweb"]}},
            }
            try:
                if hasattr(signal, 'SIGALRM'):
                    signal.alarm(20)  # Set timeout again
                try:
                    with yt_dlp.YoutubeDL(ydl_opts_minimal) as ydl:
                        info = ydl.extract_info(url, download=False)
                finally:
                    if hasattr(signal, 'SIGALRM'):
                        signal.alarm(0)
            except TimeoutError:
                raise HTTPException(
                    status_code=408,
                    detail="Video metadata extraction timed out after retry."
                )
            except Exception as e2:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to extract video info: {str(e2)}. Try updating yt-dlp: pip install -U yt-dlp"
                )
        
        # Extract basic info
        metadata = {
            "title": info.get("title") or "",
            "description": info.get("description") or "",
            "duration": info.get("duration"),
            "upload_date": info.get("upload_date"),  # YYYYMMDD format
            "channel": info.get("channel") or info.get("uploader") or "",
            "chapters": [],
            "captions": {},
            "download_url": None,
        }
        
        # Extract chapters (YouTube chapters are gold!)
        chapters = info.get("chapters") or []
        for chapter in chapters:
            metadata["chapters"].append({
                "title": chapter.get("title", ""),
                "start_time": chapter.get("start_time", 0),
                "end_time": chapter.get("end_time", 0),
            })
        
        # Extract captions
        # yt-dlp downloads captions to files, we need to read them
        # For now, we'll extract caption text from info if available
        # Full implementation would download and parse caption files
        
        # Get download URL for video - try multiple strategies
        formats = info.get("formats") or []
        
        # Strategy 1: Look for mp4 with URL
        for f in formats:
            if f.get("vcodec") != "none" and f.get("url") and (f.get("ext") == "mp4" or "mp4" in str(f.get("ext"))):
                metadata["download_url"] = f.get("url")
                break
        
        # Strategy 2: If no mp4, try any video format with URL
        if not metadata["download_url"]:
            for f in formats:
                if f.get("vcodec") != "none" and f.get("url"):
                    metadata["download_url"] = f.get("url")
                    break
        
        # Note: If download_url is still None, that's OK - we can still use captions and description
        
        return metadata
    
    @staticmethod
    def extract_captions(url: str, output_dir: Optional[str] = None) -> Dict[str, str]:
        """
        Extract captions from YouTube video.
        
        Args:
            url: YouTube video URL
            output_dir: Optional directory to save caption files (unused, kept for compatibility)
            
        Returns:
            Dict mapping language codes to caption data
        """
        if yt_dlp is None:
            raise HTTPException(
                status_code=500,
                detail="yt-dlp is not installed. Run: pip install yt-dlp"
            )
        
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "nocheckcertificate": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": ["en", "en-US", "en-GB", "en.*"],  # Try various English variants
            "subtitlesformat": "json3",  # Prefer JSON3 format
            # Avoid web/web_safari (SABR streaming) and ios (requires PO token)
            # Use tv_embedded/mweb to reliably fetch captions without video formats
            "extractor_args": {"youtube": {"player_client": ["tv_embedded", "mweb"]}},
        }
        
        captions = {}
        
        try:
            import signal
            
            # Set timeout for extraction (30 seconds)
            def timeout_handler(signum, frame):
                raise TimeoutError("Caption extraction timed out")
            
            # Only set timeout on Unix systems
            if hasattr(signal, 'SIGALRM'):
                signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(30)
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
            finally:
                if hasattr(signal, 'SIGALRM'):
                    signal.alarm(0)  # Cancel timeout
            
            # Check if subtitles are available in info
            subtitles = info.get("subtitles", {})
            automatic_captions = info.get("automatic_captions", {})
            
            # Try manual subtitles first, then auto-generated
            all_subtitles = {**subtitles, **automatic_captions}
            
            if not all_subtitles:
                # No captions available
                return {}
            
            # Get the first available English subtitle
            for lang_code in ["en", "en-US", "en-GB"]:
                if lang_code in all_subtitles:
                    subtitle_formats = all_subtitles[lang_code]
                    # Prefer json3, fallback to srt
                    if any(f.get("ext") == "json3" for f in subtitle_formats):
                        format_url = next(f["url"] for f in subtitle_formats if f.get("ext") == "json3")
                    elif any(f.get("ext") == "srt" for f in subtitle_formats):
                        format_url = next(f["url"] for f in subtitle_formats if f.get("ext") == "srt")
                    else:
                        format_url = subtitle_formats[0].get("url")
                    
                    if format_url:
                        # Download the subtitle content with timeout
                        response = requests.get(format_url, timeout=15)
                        response.raise_for_status()
                        
                        if format_url.endswith(".json3") or "json3" in format_url:
                            captions[lang_code] = {
                                "format": "json3",
                                "data": response.json()
                            }
                        else:
                            captions[lang_code] = {
                                "format": "srt",
                                "data": response.text
                            }
                        break
            
            # If no specific language found, try any English variant
            if not captions:
                for lang_code, subtitle_formats in all_subtitles.items():
                    if lang_code.startswith("en"):
                        format_url = subtitle_formats[0].get("url")
                        if format_url:
                            response = requests.get(format_url, timeout=15)
                            response.raise_for_status()
                            
                            if format_url.endswith(".json3") or "json3" in format_url:
                                captions[lang_code] = {
                                    "format": "json3",
                                    "data": response.json()
                                }
                            else:
                                captions[lang_code] = {
                                    "format": "srt",
                                    "data": response.text
                                }
                            break
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract captions: {str(e)}"
            )
        
        return captions
    
    @staticmethod
    def parse_caption_json(caption_data: Dict) -> List[Dict]:
        """
        Parse JSON3 caption format into timestamped segments.
        
        Args:
            caption_data: JSON caption data from yt-dlp
            
        Returns:
            List of dicts with: text, start, duration
        """
        events = caption_data.get("events", [])
        segments = []
        
        for event in events:
            if "segs" in event:
                text_parts = []
                for seg in event.get("segs", []):
                    if "utf8" in seg:
                        text_parts.append(seg["utf8"])
                
                if text_parts:
                    segments.append({
                        "text": "".join(text_parts),
                        "start": event.get("tStartMs", 0) / 1000.0,  # Convert to seconds
                        "duration": event.get("dDurationMs", 0) / 1000.0,
                    })
        
        return segments
    
    @staticmethod
    def parse_caption_srt(srt_text: str) -> List[Dict]:
        """
        Parse SRT caption format into timestamped segments.
        
        Args:
            srt_text: SRT caption text
            
        Returns:
            List of dicts with: text, start, duration
        """
        import re
        
        segments = []
        # SRT format: sequence number, timestamp, text, blank line
        pattern = r'(\d+)\n(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\n(.*?)(?=\n\d+\n|\n*$)'
        
        matches = re.finditer(pattern, srt_text, re.DOTALL)
        
        for match in matches:
            start_str = match.group(2)
            end_str = match.group(3)
            text = match.group(4).strip().replace('\n', ' ')
            
            # Convert timestamp to seconds
            def srt_to_seconds(srt_time: str) -> float:
                parts = srt_time.split(',')
                time_part = parts[0]
                ms = int(parts[1]) if len(parts) > 1 else 0
                h, m, s = map(int, time_part.split(':'))
                return h * 3600 + m * 60 + s + ms / 1000.0
            
            start = srt_to_seconds(start_str)
            end = srt_to_seconds(end_str)
            duration = end - start
            
            segments.append({
                "text": text,
                "start": start,
                "duration": duration,
            })
        
        return segments


"""Video processing service for extracting frames and metadata from videos."""
import os
import subprocess
from typing import Tuple
from fastapi import HTTPException

# Optional dependency (guarded)
try:
    import yt_dlp  # type: ignore
except ImportError:
    yt_dlp = None  # we'll error nicely in /ingest/url if missing


class VideoService:
    """Service for processing videos and extracting metadata."""
    
    @staticmethod
    def extract_video_info(url: str) -> Tuple[str, str, str]:
        """
        Extract title, description, and download URL from a video URL.
        
        Args:
            url: Video URL (YouTube, etc.)
            
        Returns:
            Tuple of (title, description, download_url)
            
        Raises:
            HTTPException: If yt-dlp is not installed or extraction fails
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
            "youtube_include_dash_manifest": False
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        title = info.get("title") or ""
        desc = info.get("description") or ""
        dl_url = ""
        for f in (info.get("formats") or []):
            if f.get("vcodec") != "none" and (f.get("ext") == "mp4" or "mp4" in str(f.get("ext"))):
                dl_url = f.get("url") or ""
                if dl_url:
                    break
        return title, desc, dl_url
    
    @staticmethod
    def sample_frames(video_path: str, out_dir: str, fps: float = 0.75, max_secs: int = 25) -> None:
        """
        Extract frames from video at specified FPS.
        
        Args:
            video_path: Path to input video file
            out_dir: Output directory for frames
            fps: Frames per second to extract
            max_secs: Maximum seconds of video to process
        """
        trimmed = os.path.join(out_dir, "clip_trimmed.mp4")
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error",
             "-y", "-i", video_path, "-t", str(max_secs), "-an", trimmed],
            check=True
        )
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error",
             "-y", "-i", trimmed, "-vf", f"fps={fps}", os.path.join(out_dir, "frame_%03d.png")],
            check=True
        )


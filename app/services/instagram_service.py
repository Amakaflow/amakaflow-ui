"""Instagram media ingestion helpers using Instaloader."""

from __future__ import annotations

import os
import re
from typing import List

import instaloader
from instaloader import Post
from instaloader.exceptions import (
    BadCredentialsException,
    ConnectionException,
    InstaloaderException,
    TwoFactorAuthRequired,
)


SHORTCODE_REGEX = re.compile(r"(?:instagram\.com/(?:p|reel|tv)/|/p/)([A-Za-z0-9_-]+)")


class InstagramServiceError(RuntimeError):
    """Generic error raised when Instagram ingestion fails."""


class InstagramService:
    """Wrapper around Instaloader for fetching Instagram post images."""

    @staticmethod
    def _extract_shortcode(url: str) -> str:
        match = SHORTCODE_REGEX.search(url)
        if not match:
            raise InstagramServiceError("Could not extract Instagram shortcode from URL.")
        return match.group(1)

    @staticmethod
    def download_post_images(
        username: str,
        password: str,
        url: str,
        target_dir: str,
    ) -> List[str]:
        """Download images for a single Instagram post.

        Args:
            username: Instagram username used to login.
            password: Instagram password.
            url: Full Instagram post URL.
            target_dir: Directory where images should be saved.

        Returns:
            List of absolute file paths for downloaded images.
        """

        os.makedirs(target_dir, exist_ok=True)
        shortcode = InstagramService._extract_shortcode(url)

        loader = instaloader.Instaloader(
            download_videos=False,
            download_video_thumbnails=False,
            save_metadata=False,
            compress_json=False,
            download_comments=False,
            post_metadata_txt_pattern="",
            dirname_pattern=target_dir,
            filename_pattern=f"{shortcode}_{{index}}",
            quiet=True,
        )

        try:
            loader.login(username=username, password=password)
        except TwoFactorAuthRequired as exc:
            raise InstagramServiceError("Two-factor authentication is required and currently unsupported.") from exc
        except BadCredentialsException as exc:
            raise InstagramServiceError("Invalid Instagram username or password.") from exc
        except ConnectionException as exc:
            raise InstagramServiceError(f"Instagram login failed: {exc}.") from exc

        try:
            post = Post.from_shortcode(loader.context, shortcode)
        except InstaloaderException as exc:
            raise InstagramServiceError(f"Failed to load Instagram post: {exc}.") from exc

        nodes = []
        if post.typename == "GraphSidecar":
            nodes.extend(post.get_sidecar_nodes())
        else:
            nodes.append(post)

        image_paths: List[str] = []
        for idx, node in enumerate(nodes):
            # Skip videos – current workflow expects still images.
            is_video = getattr(node, "is_video", False)
            if is_video:
                continue

            filepath_root = os.path.join(target_dir, f"{shortcode}_{idx}")
            url_to_download = getattr(node, "display_url", None) or getattr(node, "url", None)
            if not url_to_download:
                continue

            mdate = getattr(node, "date_utc", getattr(post, "date_utc", None))
            downloaded = loader.download_pic(filepath_root, url_to_download, mdate)
            if downloaded:
                basename = os.path.basename(filepath_root)
                for entry in os.listdir(target_dir):
                    if entry.startswith(basename):
                        candidate = os.path.join(target_dir, entry)
                        if os.path.isfile(candidate):
                            image_paths.append(candidate)
                            break

        if not image_paths:
            raise InstagramServiceError("No images were downloaded from the Instagram post.")

        return image_paths



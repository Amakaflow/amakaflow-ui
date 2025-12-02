# =============================================================================
# ADD THIS TO YOUR routes.py FILE
# =============================================================================

# -----------------------------------------------------------------------------
# STEP 1: Add this import near the top (around line 35, after instagram import)
# -----------------------------------------------------------------------------

from workout_ingestor_api.services.tiktok_service import (
    TikTokService,
    TikTokServiceError,
)

# -----------------------------------------------------------------------------
# STEP 2: Add this model (around line 85, after InstagramTestRequest class)
# -----------------------------------------------------------------------------

class TikTokIngestRequest(BaseModel):
    url: str

# -----------------------------------------------------------------------------
# STEP 3: Add these endpoints at the END of routes.py
# -----------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# TikTok ingest
# ---------------------------------------------------------------------------

@router.post("/ingest/tiktok")
async def ingest_tiktok(payload: TikTokIngestRequest):
    """
    Ingest workout from TikTok video.
    
    Extracts metadata via oEmbed API, downloads video, and uses OCR + Vision
    to extract workout information.
    """
    url = payload.url
    
    # Validate TikTok URL
    if not TikTokService.is_tiktok_url(url):
        raise HTTPException(
            status_code=400,
            detail="Invalid TikTok URL. Expected format: https://www.tiktok.com/@username/video/123..."
        )
    
    tmpdir = tempfile.mkdtemp(prefix="tiktok_ingest_")
    
    try:
        # Step 1: Extract metadata via oEmbed
        try:
            metadata = TikTokService.extract_metadata(url)
        except TikTokServiceError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Step 2: Download video
        video_path = TikTokService.download_video(url, tmpdir)
        
        if not video_path:
            # Try subprocess fallback
            video_path = TikTokService.download_video_subprocess(url, tmpdir)
        
        if not video_path:
            raise HTTPException(
                status_code=400,
                detail="Could not download TikTok video. The video may be private or unavailable."
            )
        
        # Step 3: Extract frames for OCR
        try:
            VideoService.sample_frames(video_path, tmpdir, fps=0.5, max_secs=60)
        except Exception as e:
            pass  # Continue even if frame extraction fails
        
        # Step 4: OCR the frames
        ocr_text = ""
        try:
            ocr_text = OCRService.ocr_many_images_to_text(tmpdir, fast_mode=True)
        except Exception as e:
            pass  # Continue even if OCR fails
        
        # Step 5: Combine description + OCR text
        description_text = TikTokService.extract_text_from_description(metadata)
        merged_text = "\n".join(t for t in [description_text, ocr_text] if t).strip()
        
        if not merged_text:
            raise HTTPException(
                status_code=422,
                detail="No workout text found in TikTok video."
            )
        
        # Step 6: Parse workout
        workout, filtered_items = ParserService.parse_free_text_to_workout(
            merged_text, 
            source=url, 
            return_filtered=True
        )
        
        # Set title from TikTok if available
        if metadata.title and not workout.title:
            clean_title = re.sub(r'#\w+\s*', '', metadata.title).strip()
            if clean_title:
                workout.title = clean_title[:80]
        
        # Build response
        response_payload = workout.convert_to_new_structure().model_dump()
        response_payload.setdefault("_provenance", {})
        response_payload["_provenance"].update({
            "mode": "tiktok_video",
            "source_url": url,
            "video_id": metadata.video_id,
            "author": metadata.author_name,
            "extraction_method": "ocr",
            "api_build_timestamp": BUILD_TIMESTAMP,
        })
        if metadata.hashtags:
            response_payload["_provenance"]["hashtags"] = metadata.hashtags
        if GIT_INFO:
            response_payload["_provenance"]["api_git_commit"] = GIT_INFO["commit_short"]
        
        response_payload["_filtered_items"] = filtered_items
        
        return JSONResponse(response_payload)
        
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"TikTok ingestion failed: {str(exc)}"
        ) from exc
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


@router.get("/tiktok/metadata")
async def get_tiktok_metadata(url: str):
    """
    Get metadata for a TikTok video without full ingestion.
    """
    if not TikTokService.is_tiktok_url(url):
        raise HTTPException(status_code=400, detail="Invalid TikTok URL")
    
    try:
        metadata = TikTokService.extract_metadata(url)
        return JSONResponse(metadata.to_dict())
    except TikTokServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
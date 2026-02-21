from workout_ingestor_api.services.url_router import route_url

def test_route_instagram_reel():
    result = route_url("https://www.instagram.com/reel/DEaDjHLtHwA/")
    assert result is not None
    assert result.platform == "instagram"
    assert result.source_id == "DEaDjHLtHwA"

def test_route_instagram_post():
    result = route_url("https://www.instagram.com/p/DEaDjHLtHwA/")
    assert result is not None
    assert result.platform == "instagram"
    assert result.source_id == "DEaDjHLtHwA"

def test_route_youtube_watch():
    result = route_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert result is not None
    assert result.platform == "youtube"
    assert result.source_id == "dQw4w9WgXcQ"

def test_route_youtube_short():
    result = route_url("https://youtu.be/dQw4w9WgXcQ")
    assert result is not None
    assert result.platform == "youtube"
    assert result.source_id == "dQw4w9WgXcQ"

def test_route_youtube_shorts():
    result = route_url("https://www.youtube.com/shorts/dQw4w9WgXcQ")
    assert result is not None
    assert result.platform == "youtube"
    assert result.source_id == "dQw4w9WgXcQ"

def test_route_tiktok():
    result = route_url("https://www.tiktok.com/@user/video/7575571317500546322")
    assert result is not None
    assert result.platform == "tiktok"
    assert result.source_id == "7575571317500546322"

def test_route_unsupported_returns_none():
    result = route_url("https://www.example.com/video/123")
    assert result is None

def test_route_pinterest():
    result = route_url("https://www.pinterest.com/pin/123456789/")
    assert result is not None
    assert result.platform == "pinterest"
    assert result.source_id == "123456789"

def test_route_tiktok_shortlink():
    result = route_url("https://vm.tiktok.com/ZMhXxxx123/")
    assert result is not None
    assert result.platform == "tiktok"
    assert result.source_id == "ZMhXxxx123"

def test_route_youtube_playlist_url():
    result = route_url("https://www.youtube.com/watch?list=PLxxx&v=dQw4w9WgXcQ")
    assert result is not None
    assert result.platform == "youtube"
    assert result.source_id == "dQw4w9WgXcQ"

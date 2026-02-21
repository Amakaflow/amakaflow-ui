"""Content extractor implementations for the Fitness Knowledge Base.

Each extractor satisfies the ContentExtractorPort protocol and handles one or
more source_type values. The registry pattern (can_handle) lets callers pick
the right extractor at runtime without importing concrete classes directly.

Available extractors
--------------------
ArticleExtractor  — source_type "url": fetches and cleans arbitrary web articles.
YouTubeExtractor  — source_type "youtube": pulls transcripts via youtube-transcript-api.
"""

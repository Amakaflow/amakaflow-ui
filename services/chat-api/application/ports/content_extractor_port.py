"""Port interface for KB content extraction (AMA-656)."""

from typing import Protocol, runtime_checkable


@runtime_checkable
class ContentExtractorPort(Protocol):
    """Protocol for content extractors that pull raw text from a KB source.

    Each extractor handles one or more source_type values (e.g. "url", "pdf").
    Implementations live in backend/services/content_extractors/.
    """

    def can_handle(self, source_type: str) -> bool:
        """Return True if this extractor handles the given source_type.

        Args:
            source_type: One of the SourceType enum values (e.g. "url", "pdf").

        Returns:
            True when the extractor is capable of processing this source type.
        """
        ...

    def extract(self, source: dict) -> dict:
        """Extract content from a source descriptor.

        Args:
            source: Dict describing the source to extract. Recognised keys:
                - source_type (str): The type of source (mirrors SourceType enum).
                - source_url (str, optional): URL to fetch content from.
                - raw_content (str, optional): Pre-supplied raw text to process.

        Returns:
            Dict with the following keys:
                - raw_content (str): Extracted plain-text body.
                - title (str): Document or page title.
                - source_url (str): Canonical URL of the content.
                - metadata (dict): Extractor-specific metadata (e.g. content_length).

        Raises:
            ValueError: When the source cannot be fetched or processed.
        """
        ...

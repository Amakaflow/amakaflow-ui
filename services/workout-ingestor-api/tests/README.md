# Workout Ingestor API Tests

## Structure

```
tests/
├── test_models.py          # Pydantic model validation tests
├── test_parser.py          # Text parsing logic tests
├── test_ocr.py             # OCR service tests
├── test_export.py          # Export service tests
├── test_utils.py           # Utility function tests
└── test_instagram_ingestion.py  # Instagram ingestion integration tests
```

## Running Tests

```bash
# Run all tests
pytest tests/

# Run specific test file
pytest tests/test_parser.py

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run with verbose output
pytest tests/ -v
```

## Test Categories

- **Unit Tests**: `test_models.py`, `test_utils.py` - Test individual components
- **Service Tests**: `test_parser.py`, `test_ocr.py`, `test_export.py` - Test service functionality
- **Integration Tests**: `test_instagram_ingestion.py` - Test end-to-end workflows









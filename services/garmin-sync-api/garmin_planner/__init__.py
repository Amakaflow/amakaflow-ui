import logging

# Configure logging
def configure_logging():
    logger = logging.getLogger(__name__)
    if not logger.hasHandlers():  # Prevent duplicate handlers
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(levelname)s - %(message)s',
        )
        logger.info('Logger configured')
    return logger

# Create and configure the logger
logger = configure_logging()
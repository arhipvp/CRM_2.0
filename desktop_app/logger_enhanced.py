"""Enhanced logging module with detailed traces"""
import logging
import sys
import os
from datetime import datetime
from pathlib import Path

# Create logs directory
LOGS_DIR = Path.cwd() / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# Log file path
LOG_FILE = LOGS_DIR / f"desktop_app_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for console output"""

    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[41m',   # Red background
        'RESET': '\033[0m'        # Reset
    }

    def format(self, record):
        if sys.stdout.encoding and 'utf' not in sys.stdout.encoding.lower():
            # Windows console without UTF-8
            level_name = record.levelname
            msg = super().format(record)
            return f"[{level_name}] {msg}"
        else:
            # Unix or UTF-8 console
            color = self.COLORS.get(record.levelname, '')
            reset = self.COLORS['RESET']

            # Format the message
            msg = super().format(record)

            if color:
                return f"{color}[{record.levelname}]{reset} {msg}"
            return msg

def setup_logger(name="desktop_app", level=logging.INFO):
    """Setup logger with both file and console handlers"""

    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Remove existing handlers
    logger.handlers = []

    # Detailed format for file
    file_formatter = logging.Formatter(
        '[%(asctime)s] [%(levelname)s] [%(name)s:%(funcName)s:%(lineno)d] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Simple format for console
    console_formatter = logging.Formatter(
        '[%(asctime)s] [%(levelname)s] %(message)s',
        datefmt='%H:%M:%S'
    )

    # File handler (detailed)
    try:
        file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"[WARNING] Could not create file handler: {e}")

    # Console handler (simple)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(ColoredFormatter(
        '[%(asctime)s] [%(levelname)s] %(message)s',
        datefmt='%H:%M:%S'
    ))
    logger.addHandler(console_handler)

    return logger

# Global logger instance
logger = setup_logger("desktop_app", logging.INFO)

def log_api_call(method, url, status=None, error=None):
    """Log API calls with details"""
    if error:
        logger.error(f"{method} {url} -> {status}: {error}")
    else:
        logger.info(f"{method} {url} -> {status}")

def log_data_loaded(entity_type, count):
    """Log data loading"""
    logger.info(f"Loaded {count} {entity_type}")

def log_exception(exc, context=""):
    """Log exceptions with full traceback"""
    logger.exception(f"Exception in {context}: {exc}")

def log_debug_dict(data, title="Data"):
    """Log dictionary contents at debug level"""
    logger.debug(f"\n{title}:")
    for key, value in data.items():
        if isinstance(value, (dict, list)):
            logger.debug(f"  {key}: {type(value).__name__}(...)")
        else:
            logger.debug(f"  {key}: {value}")

if __name__ == "__main__":
    # Test logging
    logger.debug("This is a DEBUG message")
    logger.info("This is an INFO message")
    logger.warning("This is a WARNING message")
    logger.error("This is an ERROR message")

    print(f"\n[INFO] Log file created: {LOG_FILE}")

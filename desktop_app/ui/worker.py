"""Worker threads for background operations."""

from __future__ import annotations

import logging
from typing import Any, Callable

from PySide6.QtCore import QThread, Signal

logger = logging.getLogger(__name__)


class Worker(QThread):
    """Worker thread for executing long-running operations.

    Executes a function in a separate thread and emits signals for result/error handling.

    Signals:
        finished: Emitted when operation completes successfully with result
        error: Emitted when operation fails with error message
        progress: Emitted for progress updates (optional)
    """

    finished = Signal(object)  # Result of operation
    error = Signal(str)  # Error message
    progress = Signal(int)  # Progress percentage

    def __init__(
        self,
        func: Callable[..., Any],
        *args: Any,
        **kwargs: Any,
    ) -> None:
        """Initialize worker.

        Args:
            func: Function to execute in thread
            args: Positional arguments for function
            kwargs: Keyword arguments for function
        """
        super().__init__()
        self.func = func
        self.args = args
        self.kwargs = kwargs

    def run(self) -> None:
        """Execute function in thread (automatically called by start())."""
        try:
            logger.debug("Worker starting: %s", self.func.__name__)
            result = self.func(*self.args, **self.kwargs)
            self.finished.emit(result)
            logger.debug("Worker finished: %s", self.func.__name__)
        except Exception as exc:
            logger.exception("Worker error in %s: %s", self.func.__name__, exc)
            self.error.emit(str(exc))


class WorkerPool:
    """Simple worker pool to manage multiple threads.

    Tracks active workers and prevents multiple concurrent operations on same resource.
    """

    def __init__(self) -> None:
        """Initialize empty pool."""
        self._workers: dict[str, Worker] = {}

    def start(self, key: str, worker: Worker) -> None:
        """Start worker, replacing any existing worker with same key.

        Args:
            key: Unique identifier for this operation (e.g., 'load_clients')
            worker: Worker thread to start
        """
        # Clean up previous worker if exists
        if key in self._workers:
            old_worker = self._workers[key]
            if old_worker.isRunning():
                old_worker.quit()
                old_worker.wait()

        self._workers[key] = worker
        worker.finished.connect(lambda: self._on_finished(key))
        worker.error.connect(lambda: self._on_finished(key))
        worker.start()

    def is_running(self, key: str) -> bool:
        """Check if worker with given key is running.

        Args:
            key: Operation identifier

        Returns:
            True if worker is running, False otherwise
        """
        if key not in self._workers:
            return False
        return self._workers[key].isRunning()

    def _on_finished(self, key: str) -> None:
        """Cleanup when worker finishes.

        Args:
            key: Operation identifier
        """
        if key in self._workers:
            worker = self._workers[key]
            worker.quit()
            worker.wait()
            # Keep for 1 second reference, then remove
            # In practice would use deleteLater, but for simplicity just remove

    def cleanup(self) -> None:
        """Stop and cleanup all workers."""
        for worker in list(self._workers.values()):
            if worker.isRunning():
                worker.quit()
                worker.wait()
        self._workers.clear()

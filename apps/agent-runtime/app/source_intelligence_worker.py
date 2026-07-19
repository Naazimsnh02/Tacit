from __future__ import annotations

import os
import time

from .source_intelligence import SourceIntelligenceWorker


def main() -> None:
    worker = SourceIntelligenceWorker()
    interval = float(os.environ.get("SOURCE_INTELLIGENCE_WORKER_POLL_SECONDS", "5"))
    while True:
        if not worker.run_once():
            time.sleep(interval)


if __name__ == "__main__":
    main()

from __future__ import annotations

import os
import time

from .evidence_ingestion import EvidenceIngestionWorker


def main() -> None:
    worker = EvidenceIngestionWorker()
    interval = float(os.environ.get("EVIDENCE_WORKER_POLL_SECONDS", "5"))
    while True:
        did_work = worker.run_once()
        if not did_work:
            time.sleep(interval)


if __name__ == "__main__":
    main()

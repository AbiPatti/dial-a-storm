"""End-to-end pipeline: tests -> load -> storms -> features -> model -> scenario grid export.

Run from pipeline/:
    python -m dial_a_storm                        # writes web/public/data/ (replaces FIXTURE files)
    python -m dial_a_storm.pipeline --out /tmp/x  # writes elsewhere
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

from . import config


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=config.WEB_DATA_DIR, help="artifact output directory")
    parser.add_argument("--skip-tests", action="store_true", help="do not run the causality test-suite first")
    parser.add_argument("--rebuild", action="store_true", help="rebuild cached Parquet files")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    log = logging.getLogger("dial_a_storm.pipeline")
    t0 = time.time()

    if not args.skip_tests:
        import pytest

        code = pytest.main(["-q", str(config.TESTS_DIR)])
        if code != 0:
            log.error("causality tests failed; refusing to export")
            return int(code)

    from . import export_grid, features, load, model, storms

    out = args.out.resolve()
    config.ensure_dirs(out)
    df = load.run() if args.rebuild or not config.OMNI_PARQUET.exists() else load.load_cached()
    storms.run(out, df=df)
    if args.rebuild or not config.FEATURES_PARQUET.exists():
        features.run()
    model.train(out)
    export_grid.run(out)
    log.info("pipeline finished in %.1fs -> %s", time.time() - t0, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())

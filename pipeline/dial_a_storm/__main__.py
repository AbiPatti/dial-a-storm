"""Allow `python -m dial_a_storm` as a shortcut for the full pipeline."""

import sys

from .pipeline import main

sys.exit(main())

"""Wrapper script to run audio_separator CLI entry point.

The audio_separator.utils.cli module has a main() function but no
if __name__ == "__main__" guard, so `python -m audio_separator.utils.cli`
silently exits. This wrapper calls main() directly, surviving venv rebuilds.
"""
import sys
from audio_separator.utils.cli import main

if __name__ == "__main__":
    main()

import shutil
import subprocess, os
from pathlib import Path
script_dir = Path(__file__).resolve('.').parent


def main():
    src_dir = Path(script_dir.joinpath('src'))
    build_dir = Path(script_dir.joinpath('build'))
    timerjs_path = build_dir.joinpath('timer.js')
    timerpstj_path = src_dir.joinpath('timer.pstj')
    timerhtml_path = build_dir.joinpath('timer.html')
    timerpsth_path = src_dir.joinpath('timer.psth')

    shutil.copy(timerpstj_path, timerjs_path)
    shutil.copy(timerpsth_path, timerhtml_path)

if __name__ == '__main__':
    main()


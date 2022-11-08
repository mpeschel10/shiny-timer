#!/bin/python3

import shutil

from pathlib import Path
script_dir = Path(__file__).resolve().parent
server_dir = Path('/var/www/timer')

strings_to_copy = [
    'sounds',
    'sounds/*.ogg',
    'timer.html',
    'timer.js',
    'licenses.txt'
]

local_paths = set()
for s in strings_to_copy:
    if '*' in s:
        for child in script_dir.glob(s):
            local_path = child.relative_to(script_dir)
            local_paths.add(local_path)
    else:
        local_paths.add(Path(s))

for abs_path in server_dir.rglob('**/*'):
    server_path = abs_path.relative_to(server_dir)
    if not server_path in local_paths:
        input('Going to delete {} from server; press enter'.format(server_path))
        if abs_path.is_dir():
            abs_path.rmdir()
        else:
            abs_path.unlink()

for local_path in local_paths:
    abs_path = server_dir.joinpath(local_path)
    if abs_path.exists():
        if abs_path.is_dir():
            if local_path.is_dir():
                continue
            else:
                raise Exception('{} is a directory on server but a file locally. Please fix manually.'.format(local_path))
        if local_path.is_dir():
            raise Exception('{} is a file on server but a directory locally. Please fix manually.'.format(local_path))

        if local_path.stat().st_mtime == abs_path.stat().st_mtime:
            continue
    
    if local_path.is_dir():
        abs_path.mkdir()
    else:
        print('Copying {} to {}'.format(local_path, abs_path))
        shutil.copy2(local_path, abs_path)



















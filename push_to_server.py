#!/bin/python3

import subprocess
import shutil

from pathlib import Path
build_dir = Path(__file__).resolve().parent
key_path = Path('/home/mpeschel/.ssh/dobby')
server_str = 'root@mpeschel10.com:/var/www/timer'

whitelist = [
    'sounds/*.ogg',
    'timer.html',
    'timer.js',
    'timer.css',
    'copyright'
]

# rsync does have a built-in whitelist/blacklist functionality
#  in the form of include/exclude rules.
# But I spent half an hour poking at that and couldn't work it out.
# So just implement the file-list builder in python instead.
source_paths = []
for pattern in whitelist:
    if '*' in pattern:
        for child in build_dir.glob(pattern):
            source_paths.append(child.relative_to(build_dir))
    else:
        source_paths.append(Path(pattern))

# rsync flags are basically -a|--archive but not recursive.
rsync_flags = '-' + ''.join([
    #'r', # recursive (use whitelist instead)
    'R', # preserve relative path, necessary due to file-list-as-whitelist
    'l', # copy symlinks
    'p', # copy permissions
    't', # copy times
    'o', # copy owner
    'g', # copy group
    'v', # verbose
    #' --devices', # preserve device files. (I don't need this)
    #' --specials', # preserve special files. (I don't need this)
])

ssh_cmd = ['ssh', '-i', key_path]
ssh_cmd_str = ' '.join(str(s) for s in ssh_cmd)
rsync_cmd = ['rsync', rsync_flags, '-e', ssh_cmd_str] + source_paths + [server_str]

#print(' '.join(str(s) for s in rsync_cmd))

subprocess.run(rsync_cmd, cwd=build_dir)


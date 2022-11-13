#!/bin/python3

import subprocess
import shutil

from pathlib import Path
script_dir = Path(__file__).resolve().parent
key_path = Path('/home/mpeschel/.ssh/dobby')
target_string = 'root@mpeschel10.com:/var/www/timer'

whitelist = [
    'sounds/*.ogg',
    'timer.html',
    'timer.js',
    'licenses.txt'
]

# rsync does have a built-in whitelist/blacklist functionality
#  in the form of include/exclude rules.
# But I spent half an hour poking at that and couldn't work it out.
# So just implement the file-list builder in python instead.
source_paths = []
for s in whitelist:
    if '*' in s:
        for child in script_dir.glob(s):
            source_paths.append(child.relative_to(script_dir))
    else:
        source_paths.append(Path(s))

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
rsync_cmd = ['rsync', rsync_flags, '-e', ssh_cmd_str] + source_paths + [target_string]

#print(' '.join(str(s) for s in rsync_cmd))

subprocess.run(rsync_cmd)

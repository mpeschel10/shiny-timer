import subprocess

print('Running build script.')
print('Processing audio...')
subprocess.run(['python3', 'compress_audio.py'])
print('Computing templates...')
subprocess.run(['python3', 'paste.py'])


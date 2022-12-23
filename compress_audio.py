import itertools
import sys, subprocess

from pathlib import Path
script_dir = Path(__file__).resolve().parent
sound_dir = script_dir.joinpath('sounds')

flag_force = False

def main():
    #global flag_force
    # For speed, this script only reencodes files if -f is present
    for old_loop in itertools.chain(sound_dir.glob("*-loop.wav"), sound_dir.glob("*-loop.mp3")):
        new_loop = old_loop.parent.joinpath(old_loop.stem + '.ogg')
        if flag_force or not new_loop.exists():
            # -i <input file> -filter:a<udio> 'loudnorm' -c<onvert>:a<udio> 'libvorbis' <output file>
            cmd = ['ffmpeg', '-i', old_loop, '-filter:a', 'loudnorm', '-c:a', 'libvorbis', new_loop]
            #print('I will run {}'.format(' '.join(str(c) for c in cmd)))
            subprocess.run(cmd)

if __name__ == '__main__':
    flag_force = '-f' in sys.argv
    main()


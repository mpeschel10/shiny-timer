import sys, subprocess

from pathlib import Path
script_dir = Path(__file__).resolve().parent

flag_force = False

def main():
    #global flag_force
    for old_loop in script_dir.glob("*-loop.wav"):
        new_loop = old_loop.parent.joinpath(old_loop.stem + '.ogg')
        print(old_loop)
        print(new_loop)
        if flag_force or not new_loop.exists():
            # -i <input file> -c<onvert>:a<udio> 'libvorbis' <output file>
            cmd = ['ffmpeg', '-i', old_loop, '-c:a', 'libvorbis', new_loop]
            #print('I will run {}'.format(' '.join(str(c) for c in cmd)))
            subprocess.run(cmd)

if __name__ == '__main__':
    flag_force = '-f' in sys.argv
    main()


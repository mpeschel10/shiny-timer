(() => {
    var timeDisplay;  // todo change to pTime or something
    var fieldDuration;
    var buttonStartPause; var buttonReset; var buttonTest;
    var pTimer;
    var comboSounds;

    var timer;
    function makeTimer() {
        return {
        endTime: null,
        timeLeft: 0,
        running: false,
        shouldRing: false
        };
    }
    timer = makeTimer();

    var soundPaths = [
        'bbbbeep-loop.ogg',
        'church-bells-loop.ogg',
        'slow-bell-loop.ogg',
        'crickets-loop.ogg',
        'car-alarm-loop.ogg'
    ]

    var sounds = {
        // Silent is a default sound so that currentSound will never be null.
        // I generated the URI using Steve Wittens' "JavaScript audio synthesizer"
        //  http://acko.net/files/audiosynth/index.html
        // as described on his blog:
        //  https://acko.net/blog/javascript-audio-synthesis-with-html-5/
        // The URI (I think) consists of a WAVE file consisting of a single 0.
        // Since this is purely generated data, I do not believe it is subject to copyright or licensing; I am not a lawyer.
        "silent": new Audio("data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==")
        // I'm not sure if I'm being too clever with this or not.
        // The alternative is to just throw in a bunch of null/undefined checks (maybe only undefined)
        //  every time we would access currentSound.
        // That seems more robust at runtime, and also avoids hard-coding a file,
        //  but also more error-prone to code,
        //  and also would require machinery for tracking if a sound should continue to play or not while we change selections.
    }
    sounds["silent"].loop = true;

    for (const path of soundPaths)
    {
        sounds[path] = new Audio("sounds/" + path);
        sounds[path].loop = true;
    }

    var currentSound = sounds["silent"];

    function init() {
        timeDisplay = document.getElementById('time-display');
        fieldDuration = document.getElementById('field-duration');
        buttonStartPause = document.getElementById('button-start-pause');
        buttonReset = document.getElementById('button-reset');
        buttonTest = document.getElementById('button-test');
        pTimer = document.getElementById('p-timer');
        comboSounds = document.getElementById('combo-sounds');

        fieldDuration.addEventListener('keypress', onDurationKey);
        buttonStartPause.addEventListener('click', startPause);
        buttonReset.addEventListener('click', onReset);
        comboSounds.addEventListener('change', updateCurrentSound);

        updateCurrentSound();
        setTimeout(update, 500);
    }

    function updateTimer() {
        if (timer.running) {
            timer.timeLeft = (timer.endTime - Date.now()) / 1000;
            if (timer.timeLeft < 0) {
                timer.timeLeft = 0;
                timer.running = false;
                timer.shouldRing = true;
                buttonStartPause.value = "Ok";
                timer.endTime = null;
            }
        }
    }

    function updateDisplay() {
        timeDisplay.innerHTML = Date();
        pTimer.innerHTML = timer.timeLeft;
        if (timer.shouldRing) {
            console.log('Ring the bell!');
            timer.shouldRing = false;
            if (currentSound.paused) {
                currentSound.play(); // play may fail if the source doesn't load, but the exception will happen in a promise.
            }
        }
    }

    function update() {
        updateTimer();
        updateDisplay();
        setTimeout(update, 500);
    }

    function updateCurrentSound() {
        var shouldPlay = false;
        shouldPlay = !currentSound.paused;
        currentSound.pause();
        currentSound = sounds[comboSounds.value];
        if (shouldPlay) {
            currentSound.play();
        }
    }

    function onDurationKey() {
        //console.log('Key pressed in duration input!');
    }

    function onReset() {
        timer = makeTimer();
        timer.timeLeft = parseInt(fieldDuration.value);
        buttonStartPause.value = "Start";
        currentSound.pause();
    }

    function startPause() {
        if (buttonStartPause.value === "Start") {
            if (timer.endTime === null) {
                timer.timeLeft = parseInt(fieldDuration.value);
            }

            var offsetMilli = 1000 * timer.timeLeft;
            timer.endTime = Date.now() + offsetMilli;

            timer.running = true;
            buttonStartPause.value = "Stop";

            updateDisplay();
        } else if (buttonStartPause.value === "Stop") {
            updateTimer();
            timer.running = false;

            buttonStartPause.value = "Start";
        } else if (buttonStartPause.value === "Ok") {
            timer.running = false; // Should be redundant
            timer.shouldRing = false;
            currentSound.pause();
        }
    }

    window.addEventListener('load', init, false);
})()







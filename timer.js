(() => {
    const reDigits = /[\d\.]/; // Hint to the user this is numbers only

    var pClock;
    var divTimerRun, divTimerSet;
    var fieldHours, fieldMinutes, fieldSeconds;
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

    // Error function if a sound fails to load.
    // Should remove the sound from the comboBox so user can't select it.
    // Should not remove it from sounds since I'm worried about a race condition
    //  where the default sound fails to load, but still gets selected as currentSound by init()
    //  and then the user can fire the alarm, change currentSound, and reset() will be unable
    //  to turn the sound off.
    function willDeleteSound(path) {
        function deleteSound() {
            // Have to re-fetch comboSounds since this error function might fire before init()
            const _comboSounds = document.getElementById('combo-sounds');
            for (let i = 0; i < _comboSounds.length; i++) {
                if (_comboSounds.options[i].value === path) {
                    console.log("Deleting _combosound[" + i + "]: " + _comboSounds.options[i]);
                    _comboSounds.remove(i)
                    return;
                }
            }
        }
        console.log("Try delete sound of " + path);

        if (document.readyState === "loading") {
            window.addEventListener("load", deleteSound);
        } else {
            deleteSound();
        }
    }

    for (const path of soundPaths)
    {
        sounds[path] = new Audio("sounds/" + path);
        sounds[path].addEventListener("error", () => { willDeleteSound(path); });
        sounds[path].loop = true;
    }

    var currentSound = sounds["silent"];

    function init() {
        pClock = document.getElementById('p-clock');

        divTimerSet = document.getElementById('div-timer-set');
        fieldHours = document.getElementById('field-hours');
        fieldMinutes = document.getElementById('field-minutes');
        fieldSeconds = document.getElementById('field-seconds');

        buttonStartPause = document.getElementById('button-start-pause');
        buttonReset = document.getElementById('button-reset');
        buttonTest = document.getElementById('button-test');

        divTimerRun = document.getElementById('div-timer-run');
        pTimer = document.getElementById('p-timer');
        comboSounds = document.getElementById('combo-sounds');

        fieldHours.addEventListener('keypress', forbidNondigits);
        fieldMinutes.addEventListener('keypress', forbidNondigits);
        fieldSeconds.addEventListener('keypress', forbidNondigits);

        buttonStartPause.addEventListener('click', startPause);
        buttonReset.addEventListener('click', onReset);
        comboSounds.addEventListener('change', updateCurrentSound);

        updateCurrentSound();
        setTimeout(update, 500);
    }

    function secondsToHHMMSS(seconds) {
        if (seconds < 0)
            return "00:00:00";
        seconds = Math.ceil(seconds);
        
        var daysPrefix = "";
        var days = Math.floor(seconds / 86400);
        if (days > 0) {
            seconds -= days * 86400;
            if (days > 1)
                daysPrefix = String(days) + " days, ";
            else
                daysPrefix = "1 day, ";
        }
        var hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        var minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        seconds = Math.floor(seconds)

        hours = String(hours).padStart(2, "0");
        minutes = String(minutes).padStart(2, "0");
        seconds = String(seconds).padStart(2, "0");

        return daysPrefix + hours + ":" + minutes + ":" + seconds;
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
        pClock.innerHTML = Date();
        pTimer.innerHTML = secondsToHHMMSS(timer.timeLeft);
        if (timer.shouldRing) {
            console.log('Ring the bell!');
            timer.shouldRing = false;
            if (currentSound.paused) {
                currentSound.currentTime = 0;
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
            currentSound.currentTime = 0;
            currentSound.play();
        }
    }

    // Note that the user can still paste non-numbers in!
    // This is just a hint that this box should be numbers only.
    function forbidNondigits(e) {
        if (! reDigits.test(e.key)) {
            e.preventDefault();
        }
    }

    function parseTime() {
        try {
            // Multiply the strings by numbers to convert
            //  because for some incomprehenisble reason, "parseFloat"
            //  of empty string is NaN
            var maybeSeconds = fieldHours.value * 3600 + fieldMinutes.value * 60 + fieldSeconds.value * 1;
            // I could have written something complicated to extract
            // a useable value no matter what,
            //  but I think it is safer to fire the alarm immediately
            //  so the user knows something is wrong.
            if (Number.isNaN(maybeSeconds))
                return 0;
            return maybeSeconds;
        } catch (e) {
            return 0;
        }
    }

    function onReset() {
        currentSound.pause() // Hopefully redundant.
        for (const key of Object.keys(sounds)) {
            if (sounds[key]) { // Should always be true.
                sounds[key].pause();
            }
        }
        divTimerSet.style['display'] = "";
        divTimerRun.style['display'] = "";
        timer = makeTimer();
        timer.timeLeft = parseTime();
        buttonStartPause.value = "Start";
    }

    function startPause() {
        if (buttonStartPause.value === "Start") {
            divTimerSet.style['display'] = "none";
            divTimerRun.style['display'] = "block";
            if (timer.endTime === null) {
                timer.timeLeft = parseTime();
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







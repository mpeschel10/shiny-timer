(() => {
    const reDigits = /[\d\.]/; // Hint to the user this is numbers only

    var pClock;
    var fieldHours, fieldMinutes, fieldSeconds;
    var fieldDummyBorder;
    var buttonStartPause; var buttonReset; var buttonTest;
    var comboSounds;

    var timer;
    function makeTimer() {
        return {
            endTime: null,
            timeLeft: 0,
            resetTime: ["", "5", ""],
            state: "wait_for_entry",
            // states: wait_for_entry, running, paused, ringing, rung
            // difference between wait_for_entry and paused
            // is that paused remembers a reset value.
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

        fieldHours = document.getElementById('field-hours');
        fieldMinutes = document.getElementById('field-minutes');
        fieldSeconds = document.getElementById('field-seconds');
        fieldDummyBorder = document.getElementById("field-dummy-border");

        buttonStartPause = document.getElementById('button-start-pause');
        buttonReset = document.getElementById('button-reset');
        buttonTest = document.getElementById('button-test');

        comboSounds = document.getElementById('combo-sounds');

        for (let field of [fieldHours, fieldMinutes, fieldSeconds])
        {
            field.addEventListener('keypress', onKeyPress);
            field.addEventListener('keydown', onKeyDown);
        }

        buttonStartPause.addEventListener('click', onButtonStartPause);
        buttonReset.addEventListener('click', onReset);
        comboSounds.addEventListener('change', updateCurrentSound);

        updateCurrentSound();
        setTimeout(update, 500);
    }

    function secondsToHoursMinutesSeconds(seconds) {
        if (seconds < 0)
            return "00:00:00";
        seconds = Math.ceil(seconds);
        
        var hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        var minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        seconds = Math.floor(seconds)

        hours = String(hours).padStart(2, "0");
        minutes = String(minutes).padStart(2, "0");
        seconds = String(seconds).padStart(2, "0");

        return [hours, minutes, seconds];
    }

    function updateTimer() {
        if (timer.state === "running") {
            timer.timeLeft = (timer.endTime - Date.now()) / 1000;
            if (timer.timeLeft < 0) {
                timer.timeLeft = 0;
                timer.state = "ringing";
                buttonStartPause.value = "Ok";
            }
        }
    }

    function updateDisplay() {
        pClock.innerHTML = Date();

        // I am beginning to suspect I should have just made
        //  several different buttons to enable/diasble, rather than
        //  try to "guess" what the user intent is from
        //  the display text.
        if (timer.state !== "wait_for_entry")
        {
            hms = secondsToHoursMinutesSeconds(timer.timeLeft);
            fieldHours.value = hms[0];
            fieldMinutes.value = hms[1];
            fieldSeconds.value = hms[2];
        }

        if (timer.state === "ringing" && currentSound.paused) {
            console.log('Ring the bell!');
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

    function onKeyPress(e) {
        // Forbid non-digits from being typed.
        // Note that the user can still paste non-numbers in!
        // Forbidding letters only hints that this input should be numbers.
        console.log(e);
        if (e.key === "Enter" ) {
            buttonStartPause.click();
        } else if (! reDigits.test(e.key)) {
            e.preventDefault();
        } else if (timer.state !== "wait_for_entry") {
            onReset(e, resetInputs=false);
        }
    }

    function onKeyDown(e) {
        // If it's an arrow key, maybe jump from box to box.
        // I can't do this in onKeyPress since arrows don't fire that event
        let field = e.target; let i = field.selectionStart;
        let targetField = null;
        if (e.key === "ArrowLeft" && i === 0) {
            if (field === fieldMinutes) targetField = fieldHours;
            else if (field === fieldSeconds) targetField = fieldMinutes;
            else return;
            targetField.focus();
            let last = targetField.value.length;
            targetField.setSelectionRange(last, last);
            e.preventDefault();

        } else if (e.key === "ArrowRight" && i === field.value.length) {
            if (field === fieldMinutes) targetField = fieldSeconds;
            else if (field === fieldHours) targetField = fieldMinutes;
            else return;
            targetField.focus();
            targetField.setSelectionRange(0, 0);
            e.preventDefault();
        } else if ((e.key === "Backspace" || e.key === "Delete") && timer.state !== "wait_for_entry") {
            onReset(e, resetInputs=false);
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

    function onReset(e, resetInputs=true) {
        currentSound.pause() // Hopefully redundant.
        for (const key of Object.keys(sounds)) {
            if (sounds[key]) { // Should always be true.
                sounds[key].pause();
            }
        }
        buttonStartPause.value = "Start";
        if (resetInputs) {
            fieldHours.value = timer.resetTime[0];
            fieldMinutes.value = timer.resetTime[1];
            fieldSeconds.value = timer.resetTime[2];
        }
        timer = makeTimer(); // timer.state = "wait_for_entry";
        updateCurrentSound();   // Hopefully redundant.
    }

    function onButtonStartPause() {
        if (timer.state === "wait_for_entry") {
            timer.timeLeft = parseTime();
            timer.resetTime = [
                fieldHours.value, fieldMinutes.value, fieldSeconds.value
            ];
        }
        if (timer.state === "wait_for_entry" || timer.state === "paused") {
            var offsetMilli = 1000 * timer.timeLeft;
            timer.endTime = Date.now() + offsetMilli;

            timer.state = "running";
            buttonStartPause.value = "Pause";

            updateDisplay();
        } else if (timer.state === "running") {
            updateTimer();
            timer.state = "paused";

            buttonStartPause.value = "Start";
        } else if (timer.state === "ringing") {
            timer.state = "rung";
            currentSound.pause();
        }
        // else if (timer.state === "rung")
    }

    window.addEventListener('load', init, false);
})()







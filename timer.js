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

    var sounds = {}
    for (const path of soundPaths)
    {
        sounds[path] = new Audio("sounds/" + path);
        sounds[path].loop = true;
    }
    var currentSound = sounds[soundPaths[0]];

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
        // This shouldn't happen, but just in case.
        if (currentSound !== null && currentSound !== undefined)
        {
            shouldPlay = !currentSound.paused;
            currentSound.pause();
        }
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







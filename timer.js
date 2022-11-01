(() => {
    var timeDisplay;  // todo change to pTime or something
    var fieldDuration;
    var buttonStartPause;
    var pTimer;

    var timer = {
        endTime: null,
        timeLeft: 0,
        running: false,
        shouldRing: false
    };

    function init() {
        timeDisplay = document.getElementById('time-display');
        fieldDuration = document.getElementById('field-duration');
        buttonStartPause = document.getElementById('button-start-pause');
        pTimer = document.getElementById('p-timer');

        fieldDuration.addEventListener('keypress', onDurationKey);
        buttonStartPause.addEventListener('click', startPause);
        
        setTimeout(update, 500);
    }

    function updateTimer() {
        if (timer.running) {
            timer.timeLeft = (timer.endTime - Date.now()) / 1000;
            if (timer.timeLeft < 0) {
                timer.timeLeft = 0;
                timer.running = false;
                timer.shouldRing = true;
                buttonStartPause.value = "Start";
            }
        }
    }

    function updateDisplay() {
        timeDisplay.innerHTML = Date();
        pTimer.innerHTML = timer.timeLeft;
        if (timer.shouldRing) {
            console.log('Ring the bell!');
            timer.shouldRing = false;
        }
    }

    function update() {
        updateTimer();
        updateDisplay();
        setTimeout(update, 500);
    }

    function onDurationKey() {
        //console.log('Key pressed in duration input!');
    }

    function startPause() {
        if (buttonStartPause.value === "Start") {
            timer.timeLeft = parseInt(fieldDuration.value);
            var offsetMilli = 1000 * timer.timeLeft;
            timer.endTime = Date.now() + offsetMilli;
            timer.running = true;

            buttonStartPause.value = "Stop";

            updateDisplay();
        } else if (buttonStartPause.value === "Stop") {
            updateTimer();
            timer.running = false;

            buttonStartPause.value = "Start";
        }
    }

    window.addEventListener('load', init, false);
})()


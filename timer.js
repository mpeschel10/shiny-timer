(() => {
    var timeDisplay;
    var fieldDuration;
    var timer_start;
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
        timer_start = document.getElementById('timer-start');
        pTimer = document.getElementById('p-timer');

        fieldDuration.addEventListener('keypress', onDurationKey);
        timer_start.addEventListener('click', startTimer);
        
        setTimeout(update, 500);
    }

    function updateTimer() {
        if (timer.running) {
            timer.timeLeft = (timer.endTime - Date.now()) / 1000;
            if (timer.timeLeft < 0) {
                timer.timeLeft = 0;
                timer.running = false;
                timer.shouldRing = true;
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

    function startTimer() {
        console.log('Timer start button pressed!');
        timer.timeLeft = parseInt(fieldDuration.value);
        var offsetMilli = 1000 * timer.timeLeft;
        timer.endTime = Date.now() + offsetMilli;
        timer.running = true;
    }

    window.addEventListener('load', init, false);
})()


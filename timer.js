(() => {
    var timeDisplay;
    var fieldDuration;
    var timer_start;
    var pTimer;

    var timer = {
        endTime: null
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
        if (timer.endTime !== null) {
           pTimer.innerHTML = (timer.endTime - Date.now()) / 1000;
        }
    }

    function updateDisplay() {
        timeDisplay.innerHTML = Date();
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
        var offsetMilli = 1000 * parseInt(fieldDuration.value);
        timer.endTime = Date.now() + offsetMilli;
    }

    window.addEventListener('load', init, false);
})()


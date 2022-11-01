(() => {
    var timeDisplay;
    var timer_duration;
    var timer_start;

    var timer = {
        endTime: null
    };

    function init() {
        timeDisplay = document.getElementById('time-display');
        timer_duration = document.getElementById('timer-duration');
        timer_start = document.getElementById('timer-start');

        timer_duration.addEventListener('keypress', onDurationKey);
        timer_start.addEventListener('click', startTimer);
        
        setTimeout(update, 500);
    }

    function updateTimer() {
        if (timer.endTime === null) {
            console.log('No timer update');
        } else {
            console.log('Timer update');
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
        timer.endTime = 12;
    }

    window.addEventListener('load', init, false);
})()


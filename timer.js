(() => {
    var timer_display;
    var timer_duration;
    var timer_start;

    function init() {
        timer_display = document.getElementById('timer-display');
        timer_duration = document.getElementById('timer-duration');
        timer_start = document.getElementById('timer-start');

        timer_duration.addEventListener('keypress', onDurationKey);
        timer_start.addEventListener('click', startTimer);
        
        setTimeout(update, 500);
    }

    function update() {
        timer_display.innerHTML = Date();
        setTimeout(update, 500);
    }

    function onDurationKey() {
        console.log('Key pressed in duration input!');
    }

    function startTimer() {
        console.log('Timer start button pressed!');
    }

    window.addEventListener('load', init, false);
})()


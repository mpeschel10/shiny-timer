(() => {
    var timer_display;

    function init() {
        timer_display = document.getElementById('timer-display');

        setTimeout(update, 500);
    }

    function update() {
        timer_display.innerHTML = Date();
        setTimeout(update, 500);
    }

    window.addEventListener('load', init, false);
})()


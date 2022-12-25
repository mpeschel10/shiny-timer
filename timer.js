"use strict";

(() => {
    const reDigits = /[\d\.]/; // Hint to the user this is numbers only

    var pClock;
    var fieldHours, fieldMinutes, fieldSeconds;
    var fieldDummyBorder;
    var buttonStartPause; var buttonReset; var buttonTest;
    var comboSounds;
    let buttonSoundAdd; let fileSoundAdd; let textSoundAdd;
    let buttonSoundRemove;

    let intervalID; // Capitalize D because that's how it is in the docs

    const DB_NAME = 'shiny-timer-sounds';
    const DB_VERSION = 1;
    const DB_STORE_NAME = 'sounds';
    let database;

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

  /*"silent" is a default sound so that currentSound will never be null.
    I generated the URI using Steve Wittens' "JavaScript audio synthesizer"
     http://acko.net/files/audiosynth/index.html
    as described on his blog:
     https://acko.net/blog/javascript-audio-synthesis-with-html-5/
    The URI (I think) consists of a WAVE file consisting of a single 0.
    Since this is purely generated data, I do not believe it is subject to copyright or licensing; I am not a lawyer.
    I'm not sure if I'm being too clever with this or not.
    The alternative is to just throw in a bunch of null/undefined checks (maybe only undefined)
     every time we would access currentSound.
    That seems more robust at runtime, and also avoids hard-coding a file,
     but also more error-prone to code,
     and also would require machinery for tracking if a sound should continue to play or not while we change selections.*/
    var sounds = {
        "silent": new Audio("data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==")
    }
    var defaultSounds = {"silent":true};

    sounds["silent"].loop = true;
    var currentSound = sounds["silent"];

     /* Error function if a sound fails to load.
        Should remove the sound from the comboBox so user can't select it.
        Should not remove it from sounds since I'm worried about a race condition
         where the default sound fails to load, but still gets selected as currentSound by init()
         and then the user can fire the alarm, change currentSound, and reset() will be unable
         to turn the sound off.*/
    function hideSound(path) {
        console.log("Sound at path " + path + " failed to load. Hiding from combo-sounds...");
        for (let i = 0; i < comboSounds.length; i++) {
            if (comboSounds.options[i].value === path) {
                console.log("Deleting combosound[" + i + "]: " + comboSounds.options[i]);
                comboSounds.remove(i)
                if (i <= comboSounds.selectedIndex && comboSounds.selectedIndex > 0) {
                    comboSounds.selectedIndex -= 1;
                }
                break;
            }
        }
        updateCurrentSound();
    }

    function loadSounds() {
        for (let option of comboSounds) {
            let path = option.value;
            defaultSounds[path] = true;
            // "silent" sound is loaded immediately after <head> element; loadSounds isn't responsible.
            if (path === "silent")
                continue;
            sounds[path] = new Audio("sounds/" + path);
            sounds[path].preload = "none";
            sounds[path].addEventListener("error", () => { hideSound(path); });
            sounds[path].loop = true;
        }
    }

    function init() {
        comboSounds = document.getElementById('combo-sounds');
        loadSounds(); // Call this asap for performance
        openDatabase();

        pClock = document.getElementById('p-clock');

        fieldHours = document.getElementById('field-hours');
        fieldMinutes = document.getElementById('field-minutes');
        fieldSeconds = document.getElementById('field-seconds');
        fieldDummyBorder = document.getElementById("field-dummy-border");

        buttonStartPause = document.getElementById('button-start-pause');
        buttonReset = document.getElementById('button-reset');
        buttonTest = document.getElementById('button-test');

        buttonSoundAdd = document.getElementById('button-sound-add');
        fileSoundAdd = document.getElementById('file-sound-add');
        textSoundAdd = document.getElementById('text-sound-add');
        buttonSoundRemove = document.getElementById("button-sound-remove");

        for (let field of [fieldHours, fieldMinutes, fieldSeconds])
        {
            field.addEventListener('keypress', onKeyPress);
            field.addEventListener('keydown', onKeyDown);
        }

        buttonStartPause.addEventListener('click', onButtonStartPause);
        buttonReset.addEventListener('click', onReset);
        comboSounds.addEventListener('change', updateCurrentSound);

        fileSoundAdd.addEventListener('change', onFileSoundAddChange);
        buttonSoundAdd.addEventListener('click', onButtonSoundAdd);
        buttonSoundRemove.addEventListener('click', onButtonSoundRemove);

        // Form data may persist over reloads,
        //  so update all the boxes.
        onFileSoundAddChange();
        updateCurrentSound(); 

        try {
            applyParameters(new URLSearchParams(window.location.search));
        } catch (e) {
            console.error("Failed to apply url parameters of " + window.location.search);
            console.error(e);
        }

        // Update clock and show parameters immediately on page load
        update(); 
        intervalID = setInterval(update, 500);
    }

    function applyParameters(parameters) {
        // Problem: half the state is stored in the fieldHours etc and comboSounds,
        //  and there's no dry way to change the state AND update the UI without firing events.
        // Unfortunately, this function will have to be completely revised any time you change
        //  the state model. Hopefully you won't have to, ya?

        // Ok. This fn is a kludgy, stateful mess.
        // First select the sound, which is nice and uncoupled.
        let selectedIndex = parameters.get("selectedIndex");
        if (selectedIndex !== null) {
            selectedIndex = parseInt(selectedIndex);
            comboSounds.selectedIndex = selectedIndex;
            comboSounds.dispatchEvent(new Event("change"));
            // Note that this can produce an invalid selection, causing currentSound = undefined.
            // So I had to throw in undefined checks anyway. What a bother...
        }

        let resetTime = parameters.get("resetTime");
        if (resetTime !== null) {
            resetTime = parseInt(resetTime);
            resetTime = secondsToHoursMinutesSeconds(resetTime);
            timer.resetTime = resetTime;
            // The state stanza may invoke buttonStartPause.click(), and the fields will then
            //  override timer.resetTime.
            // It's ok bc. resetFields duplicates the state from timer.resetTime to the fields.
            resetFields();
        }

        // state parameter is handled by just faking a bunch of user inputs.
        // timeLeft stanza SHOULD be after state stanza, to override endTime set here.
        let state = parameters.get("state");
        if (state !== null) {
            if (state === "wait-for-entry") {
            } else if (state === "running") {
                buttonStartPause.click(); // running
            } else if (state === "paused") {
                buttonStartPause.click(); // running
                buttonStartPause.click(); // paused
            } else if (state === "ringing") {
                buttonStartPause.click(); // running
                timer.endTime = 0;
                updateTimer();            // ringing
            } else if (state === "rung") {
                buttonStartPause.click(); // running
                timer.endTime = 0;
                updateTimer();            // ringing
                buttonStartPause.click(); // rung
            } else {
                console.error("Bad parameter state=" + state);
            }
        }

        // timeLeft should follow state stanza, to override it if e.g. state=rung&timeLeft=14
        let timeLeft = parameters.get('timeLeft');
        if (timeLeft !== null) {
            timeLeft = parseInt(timeLeft);
            timer.timeLeft = timeLeft;
            timer.endTime = Date.now() + timeLeft * 1000;
            // updateDisplay() should be called after this applyParameters anyway...
        }

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
            let hms = secondsToHoursMinutesSeconds(timer.timeLeft);
            let fields = [fieldHours, fieldMinutes, fieldSeconds];
            // Preserve user selection while updating the field.
            for (let i = 0; i < fields.length; i++)
            {
                let field = fields[i];
                let s = field.selectionStart; let e = field.selectionEnd;
                field.value = hms[i];
                field.setSelectionRange(s, e);
            }
        }

        if (timer.state === "ringing") {
            if (currentSound) {
                if(currentSound.paused) {
                    console.log('Ring the bell!');
                    currentSound.currentTime = 0;
                    currentSound.play().catch(
                        (e) => {
                            console.log("Could not play sound " + currentSound.src);
                            console.log(e);
                            // In theory, as sounds fail to load, comboSounds will eventually
                            //  have only good sounds in it. And since hideSound() calls
                            //  updateCurrentSound, we will eventually ring, which is failing safe.
                            //  As long as silent is the last song...
                        }
                    );
                }
            }
        }
    }

    function update() {
        updateTimer();
        updateDisplay();
    }

    function updateCurrentSound() {
        var shouldPlay = false;
        if (currentSound) {
            shouldPlay = !currentSound.paused;
            currentSound.pause();
        }

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
            onReset(e, false);
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
            onReset(e, false);
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

    function resetFields() {
        fieldHours.value = timer.resetTime[0];
        fieldMinutes.value = timer.resetTime[1];
        fieldSeconds.value = timer.resetTime[2];
    }

    function onReset(e, shouldResetFields=true) {
        for (const key of Object.keys(sounds)) {
            if (sounds[key]) { // Should always be true.
                sounds[key].pause();
            }
        }
        if (currentSound) {
            currentSound.pause() // Hopefully redundant.
        };

        if (comboSounds.selectedIndex < 0) {
            comboSounds.selectedIndex = 0;
        } else if (comboSounds.selectedIndex >= comboSounds.options.length) {
            comboSounds.selectedIndex = 0; // last sound is silent, so select first sound instead.
        }

        buttonStartPause.value = "Start";
        if (shouldResetFields) {
            resetFields();
        }
        timer = makeTimer(); // timer.state = "wait_for_entry";
        updateCurrentSound();   // Hopefully redundant.
        fieldDummyBorder.style.visibility = "visible";
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
            fieldDummyBorder.style.visibility = "hidden";

            updateDisplay();
        } else if (timer.state === "running") {
            updateTimer();
            timer.state = "paused";
            fieldDummyBorder.style.visibility = "visible";

            buttonStartPause.value = "Start";
        } else if (timer.state === "ringing") {
            timer.state = "rung";
            if (currentSound)
                currentSound.pause();
            fieldDummyBorder.style.visibility = "visible";
        }
        // else if (timer.state === "rung")
    }

    function getMaxLength(a) {
        let longest = 0;
        for (let element of a)
            if (element.length > longest)
                longest = element.length;
        return longest;
    }

    function onFileSoundAddChange(e) {
        let suggestedNames = Array.from(fileSoundAdd.files).map(f => f.name);
        textSoundAdd.value = suggestedNames.join("\n");

        if (suggestedNames.length >= 1)
            textSoundAdd.rows = suggestedNames.length;
        else
            textSoundAdd.rows = 1;

        let longest = getMaxLength(suggestedNames) + 1;
        if (longest >= 20)
            textSoundAdd.cols = longest;
        else
            textSoundAdd.cols = 20;
    }

    function openDatabase() {
        let request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = function(e) {
            database = e.currentTarget.result;
            let transaction = database.transaction([DB_STORE_NAME], "readonly");
            let store = transaction.objectStore(DB_STORE_NAME);
            let request = store.getAllKeys();

            request.onsuccess = function(e) {
                let keys = e.currentTarget.result;
                let transaction = database.transaction([DB_STORE_NAME], "readonly");
                let store = transaction.objectStore(DB_STORE_NAME);
                for (let key of keys) {
                    let request = store.get(key);
                    request.onsuccess = function(e) {
                        let result = e.currentTarget.result;
                        addNamedSound(result.id, result.file);
                    };
                    request.onerror = function(e) {
                        console.log("Failed to load sound.");
                        console.error(e);
                    };
                }
            };

            request.onerror = function(e) {
                console.log("Failed to get names/keys for loading stored sounds.");
                console.error(e);
            };
        };

        request.onerror = function(e) {
            console.error("Failed to load indexedDB.");
            console.error(e.currentTarget);
        };

        request.onupgradeneeded = function(e) {
            console.log("Upgrade needed (presumably also first run of database?");
            let database = e.currentTarget.result;
            if (!database.objectStoreNames.contains(DB_STORE_NAME))
            {
                console.log("Creating store " + DB_STORE_NAME);
                let store = database.createObjectStore(DB_STORE_NAME, {keyPath:"id", autoIncrement:true});
            }
        };
    }

    function addNamedSound(name, file) {
        console.log(name, file);
        let option = document.createElement("option");
        option.appendChild(document.createTextNode(name));
        option.value = name;

        sounds[name] = new Audio(URL.createObjectURL(file));
        comboSounds.prepend(option);
        // I considered doing comboSounds.selectedIndex = 0 here
        //  but I'll prob. add a url parameter to set selected song
        //  so don't overwrite that preemptively lol.
    }

    function onButtonSoundAdd(e) {
        let names = textSoundAdd.value.split('\n');
        let files = fileSoundAdd.files;
        if (names.length != files.length) {
            alert(
                "Error: Wrong number of names.\n" +
                "Found " + names.length + " names for " + files.length + " files.\n" +
                'You should have as many names in the "Name of Sound" textarea as you have files to add.\n' +
                'Names should be separated by a "line break" by pressing the enter key.'
            );
            return;
        }

        // Iterate in reverse order,
        //  so the order in the combobox is the same as in the textarea.
        let objectStore = database.transaction([DB_STORE_NAME], "readwrite").objectStore(DB_STORE_NAME);
        for (let i = files.length - 1; i >= 0; i--) {
            let f = files[i]; let n = names[i];
            if (n in sounds) {
                alert(
                    'Error: Duplicate sound name "' + n + '".\n' +
                    "Either remove that sound first or choose a different name."
                );
                return;
            }

            let object = {id:n, file:f};
            let request = objectStore.add(object);
            request.onerror = function(e) {
                // Note if people add sounds from multiple tabs we'll get a duplicate key error.
                console.error(e);
            };
            addNamedSound(n, f);
        }
        comboSounds.selectedIndex = 0;  // since we prepend new options, first option will be new
        comboSounds.dispatchEvent(new Event("change"));

        fileSoundAdd.value = "";
        fileSoundAdd.dispatchEvent(new Event("change"));
    }

    function onButtonSoundRemove(e) {
        if (comboSounds.options.length <= 1) {
            alert(
                "Error: Only one sound left.\n" +
                "This program is not designed to handle having no sounds.\n" +
                "I refuse to discard the last one."
            )
            return;
        }

        let i = comboSounds.selectedIndex;
        if (i + 1 < comboSounds.options.length)
            comboSounds.selectedIndex = i + 1;
        else
            comboSounds.selectedIndex = i - 1;
        comboSounds.dispatchEvent(new Event("change"));

        let option = comboSounds.options[i];
        console.log("Discarding option " + option.value);
        comboSounds.remove(i);

        let id = option.value;
        sounds[id].pause(); // Should be redundant.
        delete sounds[id]; // Free up space, I hope.
        if (!(id in defaultSounds)) {
            console.log("Deleting from IndexedDB (persistent storage)...");
            let objectStore = database.transaction([DB_STORE_NAME], "readwrite").objectStore(DB_STORE_NAME);
            objectStore.delete(id).onerror = function (e) {
                console.error(e);
            };
        }

    }

    window.addEventListener('load', init, false);
})()







"use strict";

(() => {
// Hint to the user that timer inputs are numbers.
// Note that they can still input something invalid with multiple periods;
// e.g. 123.312.1321234.12
    const reDigits = /^\d*\.?\d*$/;

    const SHINY_TIMER_DEBUG = localStorage.getItem("shinyTimerDebug") === "true";
    const SHINY_TIMER_DEBUG_FAKE_KEY = "fake key for testing database error handling.\n";
    const SHINY_TIMER_DEBUG_BAD_AUDIO = "fake key for testing Audio load error handling.\n";
    const SHINY_TIMER_DEBUG_SOUND_ADD = "fake key for testing Audio persistence.";

    const SILENT_WAV = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==";
    const DIV_FIELD_PINCHER_BORDER = "1px solid grey";

    if (SHINY_TIMER_DEBUG) {
        window.shiny_timer_debug_reload_count = localStorage.getItem("reloadCount");
        if (shiny_timer_debug_reload_count === null) {
            shiny_timer_debug_reload_count = 0;
        }
        shiny_timer_debug_reload_count = +shiny_timer_debug_reload_count;
    }

    let pClock;
    let fieldHours, fieldMinutes, fieldSeconds;
    let timeFields;
    let divFieldPincher;
    let buttonStartPause, buttonReset, buttonTest;
    let comboSounds;
    let buttonSoundAdd, fileSoundAdd, textSoundAdd;
    let buttonSoundRemove;
    let buttonURL, fieldURL;

    let intervalID;
// hideSound() normally updates comboSounds.selected; forbid that during launchPlay().
    let launchPlayLock = false;

    const DB_NAME = "shiny-timer-sounds";
    const DB_VERSION = 1;
    const DB_STORE_NAME = "sounds";
    let databasePromise;

    let timer;
    function makeTimer() {
        return {
            endTime: null,
            timeLeft: 0,
            resetTime: ["", "5", ""],
            state: "wait_for_entry",
// states: wait_for_entry, running, paused, ringing, rung
// The difference between wait_for_entry and paused
//  is that paused remembers a reset value.
        };
    }
    timer = makeTimer();

/*
"silent" is a default sound so that currentSound will never be null.
I generated the URI using Steve Wittens' "JavaScript audio synthesizer"
 http://acko.net/files/audiosynth/index.html
as described on his blog:
 https://acko.net/blog/javascript-audio-synthesis-with-html-5/
The URI (I hope) consists of a WAVE file consisting of a single 0.
Since this is generated data, I think it is copyrighted; I am not a lawyer.
I don't know if this solution is too clever:
The alternative is to throw in a bunch of null/undefined checks
 every time we would access currentSound.
That seems more robust at runtime, and also avoids hard-coding a WAV file,
 but also more error-prone to write,
 and also would need us to manually track if a sound should continue to play or not
 while we change comboSound.selectedIndex.*/
    const sounds = {
        silent: new Audio(SILENT_WAV)
    }
    const defaultSounds = {silent:true};

    sounds["silent"].loop = true;
    let currentSound = sounds["silent"];

/*
Error function if a sound fails to load.
Should remove option from comboSounds so user can't select it.
Should not remove Audio from sounds,
 so onButtonReset() will always be able to pause "all" sounds.*/
    function hideSound(path) {
        if (!(SHINY_TIMER_DEBUG && path === SHINY_TIMER_DEBUG_BAD_AUDIO))
            console.warn("Sound at path " + path + " failed to load. Hiding from combo-sounds...");
        for (let i = 0; i < comboSounds.length; i++) {
            if (comboSounds.options[i].value === path) {
                if (!(SHINY_TIMER_DEBUG && path === SHINY_TIMER_DEBUG_BAD_AUDIO))
                    console.log("Deleting comboSound[" + i + "]: " + comboSounds.options[i].value);
                else
                    console.debug("Test note:     bad audio: hiding bad audio option");
                comboSounds.remove(i)
                if (!launchPlayLock && i <= comboSounds.selectedIndex && comboSounds.selectedIndex > 0) {
                    comboSounds.selectedIndex -= 1;
                }
                break;
            }
        }
        if (!launchPlayLock)
            onComboSoundsChange();
    }

    function fetchIDBKeys(database) {
        return new Promise(function (resolve, reject) {
            const request = database.transaction([DB_STORE_NAME], "readonly").objectStore(DB_STORE_NAME).getAllKeys();
            request.onsuccess = function (e) {
                resolve(e.currentTarget.result);
            };
            request.onerror = function (e) {
                console.error("Failed to get names/keys for loading stored sounds.");
                reject(e);
            };
        });
    }

// Returns a promise which will resolve when all sounds are loaded.
    function loadIDBSoundsFromKeys(database, keys) {
        const transaction = database.transaction([DB_STORE_NAME], "readonly");
        const store = transaction.objectStore(DB_STORE_NAME);
        if (SHINY_TIMER_DEBUG && window.shiny_timer_debug_reload_count === 2) {
            keys.push(SHINY_TIMER_DEBUG_FAKE_KEY);
            console.debug("Test note:     reject fake key: using keys:", keys);
        }
        return Promise.allSettled(keys.map(key => 
            new Promise(function (resolve, reject) {
                const request = store.get(key);
                request.onsuccess = function (event) {
                    try {
                        const result = event.currentTarget.result;
                        addNamedSound(result.id, getSound(result.file));
                        resolve(result.id);
                    } catch (error) {
                        if (SHINY_TIMER_DEBUG && (key === SHINY_TIMER_DEBUG_FAKE_KEY)) {
                            console.log("Test complete: reject fake key.");
                        } else {
                            console.error("Succesful transaction, but failed to load sound", key);
                            console.error(error);
                        }
                        reject(error);
                    }
                };

                request.onerror = function (e) {
                    console.error("Transaction failure while loading sound from", key);
                    console.error(e);
                    reject(e);
                };
            })
        ));
    }

// Returns a promise which will resolve when all sounds are loaded.
    async function loadIDBSounds(database) {
        const keys = await fetchIDBKeys(database);
        return loadIDBSoundsFromKeys(database, keys);
    }

    function loadDefaultSounds() {
        for (const option of comboSounds) {
            const path = option.value;
            defaultSounds[path] = true;
// "silent" sound is loaded immediately after <head> element;
//  loadSounds isn't responsible for it.
            if (path === "silent")
                continue;
            sounds[path] = new Audio("sounds/" + path);
            sounds[path].preload = "none";
            sounds[path].addEventListener("error", e => hideSound(path));
            sounds[path].loop = true;
        }
    }

    async function init() {
        if (SHINY_TIMER_DEBUG && window.shiny_timer_debug_reload_count === 2) {
            testBadAudio();
            window.shiny_timer_debug_parameters_promise = testApplyParamsDespiteErrors();
            await testSilent();
        }

        comboSounds = document.getElementById("combo-sounds");
        loadDefaultSounds();
        databasePromise = fetchDatabase();
        const loadingSoundsPromise = databasePromise.then(loadIDBSounds);

        pClock = document.getElementById("p-clock");

        fieldHours = document.getElementById("field-hours");
        fieldMinutes = document.getElementById("field-minutes");
        fieldSeconds = document.getElementById("field-seconds");
        timeFields = [fieldHours, fieldMinutes, fieldSeconds];
        divFieldPincher = document.getElementById("div-field-pincher");

        buttonStartPause = document.getElementById("button-start-pause");
        buttonReset = document.getElementById("button-reset");
        buttonTest = document.getElementById("button-test");

        buttonSoundAdd = document.getElementById("button-sound-add");
        fileSoundAdd = document.getElementById("file-sound-add");
        textSoundAdd = document.getElementById("text-sound-add");
        buttonSoundRemove = document.getElementById("button-sound-remove");

        buttonURL = document.getElementById("button-url");
        fieldURL = document.getElementById("field-url");

        for (const f of timeFields)
        {
            f.addEventListener("beforeinput", onFieldBeforeInput);
            f.addEventListener("keydown", onFieldKeyDown);
        }

        buttonStartPause.addEventListener("click", onButtonStartPause);
        buttonReset.addEventListener("click", onButtonReset);
        comboSounds.addEventListener("change", onComboSoundsChange);

        fileSoundAdd.addEventListener("change", onFileSoundAddChange);
        buttonSoundAdd.addEventListener("click", onButtonSoundAdd);
        buttonSoundRemove.addEventListener("click", onButtonSoundRemove);

        buttonURL.addEventListener("click", onButtonURL);

// Form data may persist over reloads, so update all the boxes.
        onFileSoundAddChange();
        onComboSoundsChange();

        if (SHINY_TIMER_DEBUG && window.shiny_timer_debug_reload_count === 2) {
            comboSounds.selectedIndex = 0;
            comboSounds.dispatchEvent(new Event("change"));
// Wait two cycles for onComboSoundsChange to be called.
            await new Promise(r => setTimeout(r, 1));
            await new Promise(r => setTimeout(r, 1));
            await launchPlay();
            console.assert(!currentSound.paused, "Test bad sound: Expected launchPlay to result in currentSound playing; it is not.");
            console.assert(currentSound.src.endsWith("brrrring-loop.ogg"), "Test bad sound: Expected launchPlay to result in brrring-loop.ogg to be selected; instead, got " + currentSound.src + ".");
            buttonReset.click();
            console.debug("Test bad sound complete.");
        }
// applyParameters runs after element variables (buttonReset etc) are initialized
//  and all comboSounds options are loaded.
        loadingSoundsPromise.then(loadedSounds =>
            applyParameters(new URLSearchParams(window.location.search))
        ).catch(console.error);

// Update clock and show urlParameters immediately on page load
        update();
        intervalID = setInterval(update, 500);

        if (SHINY_TIMER_DEBUG) {
            await testSoundAdd();
        }
        if (SHINY_TIMER_DEBUG && shiny_timer_debug_reload_count === 2) {
            await shiny_timer_debug_parameters_promise;
            await testSoundSwitch();
            await testSoundsAllLoad();
            await testKeepSelection();
            await testState();
        }
    }

    async function testState() {
//                 δ |startpause | reset | fieldChange | updateTimer0 |
//                   __________________________________________________
// W: Wait_for_entry |    R      |  W    |      W      |              |
// R: Running        |    P      |  W    |      W      |       I      |
// P: Pause          |    R      |  W    |      W      |              |
// I: rInging        |    G      |  W    |      W      |              |
// G: runG           |    G      |  W    |      W      |              |
// Don't bother testing every fieldChange permutation;
//  as long as onFieldChange calls buttonReset we should be fine.

        const playingCount = () => Object.values(sounds).filter(a => !a.paused).length;
        
        console.debug("Test note:     state: check ---> W");
        let sampleTime = timer.timeLeft;
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "wait_for_entry" && buttonStartPause.value === "Start" &&
            timer.timeLeft === sampleTime && playingCount() === 0,
            "Test failure:  state: expected initial state W."
        );

        console.debug("Test note:     state: check W --reset-> W");
        sampleTime = timer.timeLeft;
        buttonReset.click();
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "wait_for_entry" && buttonStartPause.value === "Start" &&
            timer.timeLeft === sampleTime && playingCount() === 0,
            "Test failure:  state: expected W --reset-> W."
        );

        console.debug("Test note:     state: check W --start-> R");
        buttonStartPause.click();
        await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 1));
        sampleTime = timer.timeLeft;
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "running" && buttonStartPause.value === "Pause" &&
            timer.timeLeft < sampleTime && playingCount() === 0,
            "Test failure:  state: expected W --start-> R."
        );

        console.debug("Test note:     state: check R --reset-> W");
        buttonReset.click();
        await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 1));
        sampleTime = timer.timeLeft;
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "wait_for_entry" && buttonStartPause.value === "Start" &&
            timer.timeLeft === sampleTime && playingCount() === 0,
            "Test failure:  state: expected R --reset-> W."
        );

        console.debug("Test note:     state: check R --start-> P");
        buttonStartPause.click();
        buttonStartPause.click();
        await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 1));
        sampleTime = timer.timeLeft;
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "paused" && buttonStartPause.value === "Start" &&
            timer.timeLeft === sampleTime && playingCount() === 0,
            "Test failure:  state: expected R --start-> P."
        );

        console.debug("Test note:     state: check P --reset-> W");
        buttonReset.click();
        await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 1));
        sampleTime = timer.timeLeft;
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "wait_for_entry" && buttonStartPause.value === "Start" &&
            timer.timeLeft === sampleTime && playingCount() === 0,
            "Test failure:  state: expected P --reset-> W."
        );

        console.debug("Test note:     state: check P --start-> R");
        buttonStartPause.click();
        buttonStartPause.click();
        buttonStartPause.click();
        await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 1));
        sampleTime = timer.timeLeft;
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "running" && buttonStartPause.value === "Pause" &&
            timer.timeLeft < sampleTime && playingCount() === 0,
            "Test failure:  state: expected P --start-> R."
        );

        console.debug("Test note:     state: check R --update-> I");
        timer.endTime = Date.now();
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "ringing" && buttonStartPause.value === "Ok" &&
            timer.timeLeft === 0 && playingCount() === 1,
            "Test failure:  state: expected R --update-> I. state " + timer.state + " value " +
            buttonStartPause.value + " timeLeft " + timer.timeLeft + " playingCount " + 
            playingCount()
        );

        console.debug("Test note:     state: check I --reset-> W");
        buttonReset.click();
        sampleTime = timer.timeLeft;
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "wait_for_entry" && buttonStartPause.value === "Start" &&
            timer.timeLeft === sampleTime && playingCount() === 0,
            "Test failure:  state: expected I --reset-> W."
        );

        console.debug("Test note:     state: check I --ok-> G");
        buttonStartPause.click();
        await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 1));
        timer.endTime = Date.now();
        await new Promise(r => setTimeout(r, 1000));
        buttonStartPause.click();
        console.assert(timer.state === "rung" && buttonStartPause.value === "Ok" &&
            timer.timeLeft === 0 && playingCount() === 0,
            "Test failure:  state: expected I --ok-> G."
        );

        console.debug("Test note:     state: check G --ok-> G");
        buttonStartPause.click();
        await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 1));
        console.assert(timer.state === "rung" && buttonStartPause.value === "Ok" &&
            timer.timeLeft === 0 && playingCount() === 0,
            "Test failure:  state: expected G --ok-> G."
        );

        console.debug("Test note:     state: check G --reset-> W");
        buttonReset.click();
        await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 1));
        sampleTime = timer.timeLeft;
        await new Promise(r => setTimeout(r, 1000));
        console.assert(timer.state === "wait_for_entry" && buttonStartPause.value === "Start" &&
            timer.timeLeft === sampleTime && playingCount() === 0,
            "Test failure:  state: expected G --reset-> W."
        );

        console.log("Test complete: state.");
    }

    async function testKeepSelection() {
        timer.resetTime = ["59", "59", "59"];
        buttonReset.click();
        buttonStartPause.click();
        await new Promise(r => setTimeout(r, 200));

        console.debug("Test note:     keep selection: fieldHours 0-1");
        fieldHours.setSelectionRange(0, 1);
        fieldHours.focus();
        await new Promise(r => setTimeout(r, 1500));

        console.assert(fieldHours.selectionStart === 0, "Test failure:  keep selection: fieldHours" +
            " selection start should be 0; is " + fieldHours.selectionStart
        );
        console.assert(fieldHours.selectionEnd === 1, "Test failure:  keep selection: fieldHours" +
            " selection end should be 1; is " + fieldHours.selectionEnd
        );
        console.assert(fieldMinutes.selectionStart === fieldMinutes.selectionEnd, "Test failure: " +
            " keep selection: fieldMinutes selectionStart should === selectionEnd, but start is " +
            fieldMinutes.selectionStart + " and end is " + fieldMinutes.selectionEnd
        );
        console.assert(fieldSeconds.selectionStart === fieldSeconds.selectionEnd, "Test failure: " +
            " keep selection: fieldSeconds selectionStart should === selectionEnd, but start is " +
            fieldSeconds.selectionStart + " and end is " + fieldSeconds.selectionEnd
        );

        console.debug("Test note:     keep selection: fieldSeconds 0-2");
        fieldHours.setSelectionRange(2, 2);
        fieldSeconds.setSelectionRange(0, 2);
        fieldSeconds.focus();
        await new Promise(r => setTimeout(r, 1500));
        console.assert(fieldHours.selectionStart === fieldHours.selectionEnd, "Test failure: " +
            " keep selection: fieldHours selectionStart should === selectionEnd, but start is " +
            fieldHours.selectionStart + " and end is " + fieldHours.selectionEnd
        );
        console.assert(fieldMinutes.selectionStart === fieldMinutes.selectionEnd, "Test failure: " +
            " keep selection: fieldMinutes selectionStart should === selectionEnd, but start is " +
            fieldMinutes.selectionStart + " and end is " + fieldMinutes.selectionEnd
        );
        console.assert(fieldSeconds.selectionStart === 0, "Test failure:  keep selection:" +
            " fieldSeconds selection start should be 0; is " + fieldSeconds.selectionStart
        );
        console.assert(fieldSeconds.selectionEnd === 2, "Test failure:  keep selection:" +
            " fieldSeconds selection end should be 1; is " + fieldSeconds.selectionEnd
        );
        
        buttonReset.click();
        console.log("Test complete: keep selection.");
    }

    async function testSoundsAllLoad() {
        const keysToCheck = Array.from(comboSounds.options).map(o => o.value);
        console.assert(
            keysToCheck.every(k => sounds[k] !== undefined),
            "Test failure:  sounds all load: some combo options are not associated with audios."
        );

        for (const key of keysToCheck) {
            if (sounds[key] === undefined)
                continue;
            const audio = sounds[key];
            try {
                await audio.play();
                await audio.pause();
            } catch (e) {
                console.error("Test failure:  sounds all load: could not play sound with key",
                    key, "due to error", e
                );
            }
        }
        console.log("Test complete: sounds all load.");
    }

    async function testSoundSwitch() {
        console.debug("Test note:     play switch: begin.");
        const playingSounds = () => Object.values(sounds).filter(sound => !sound.paused);
        console.assert(playingSounds().length === 0,
            "Test failure:  play switch: expected no sounds playing at start of test."
        );
        await launchPlay();
        console.assert(playingSounds().length === 1,
            "Test failure:  play switch: expected exactly one sound to play after launchPlay()."
        );
        console.assert(!currentSound.paused,
            "Test failure:  play switch: expected current sound to play after launchPlay()."
        );
        comboSounds.selectedIndex = 12;
        comboSounds.dispatchEvent(new Event("change"));
// Wait two cycles for onComboSoundsChange to be called.
        await new Promise(r => setTimeout(r, 1));
        await new Promise(r => setTimeout(r, 1));
        const expectedSound = sounds[comboSounds.value];
        console.assert(playingSounds().length === 1,
            "Test failure:  play switch: expected exactly one sound to play after change sound."
        );
        console.assert(!currentSound.paused,
            "Test failure:  play switch: expected current sound to pause after change sound."
        );
        console.assert(!expectedSound.paused,
            "Test failure:  play switch: expected a different sound to play after change sound."
        );
        await currentSound.pause();
        comboSounds.selectedIndex = 0;
        comboSounds.dispatchEvent(new Event("change"));
        console.log("Test complete: play switch.");
    }

    async function testSoundAdd() {
        console.debug("Test note:     sound add: begin add sound.");
        await new Promise(resolve => setTimeout(resolve, 300));
        if (shiny_timer_debug_reload_count === 0) {
            console.debug("Test note:     sound add: First reload; create file and add.");
            localStorage.setItem("reloadCount", shiny_timer_debug_reload_count + 1);
// Taken with modification from https://stackoverflow.com/a/38935990/6286797
            const arr = SILENT_WAV.split(",");
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);

            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }

// I can't figure out how to spoof a FileList for a test,
//  so just replace the whole element lol.
            fileSoundAdd = {files:[new File([u8arr], SHINY_TIMER_DEBUG_SOUND_ADD, {type:mime})]};
            onFileSoundAddChange();
            await onButtonSoundAdd();
            const sound = sounds[SHINY_TIMER_DEBUG_SOUND_ADD];
            try {
                await sound.play();
            } catch (e) {
                console.error("Test failure:  sound add: could not play" +
                    ' "silent" sound after adding it: ' + e
                );
            }
            console.assert(!(sound.paused),
                'Test failure:  sound add: "silent" sound did not play' +
                " like it was supposed to."
            );
            console.debug("Test note:     sound add: Sound:", sound);
            await sound.pause();
            console.assert(comboSounds.options[0].value === SHINY_TIMER_DEBUG_SOUND_ADD,
                "Test failure:  sound add: key string for test sound did not get added" +
                " to comboSounds: " + comboSounds.options[0].value);

            console.warn("Please reload page for sound add test to continue.");
//window.location.reload();

        } else if (shiny_timer_debug_reload_count === 1) {
            console.debug("Test note:     add sound: Second reload; play file and discard.");
            localStorage.setItem("reloadCount", shiny_timer_debug_reload_count + 1);
// Expect persistent storage to have test_silent_sound_name as a playable thing
            const sound = sounds[SHINY_TIMER_DEBUG_SOUND_ADD];
            try {
                await sound.play();
            } catch (e) {
                console.error('Test failure:  sound add: could not play "silent" sound' +
                    " after page reload: " + e
                );
            }
            if (sound !== undefined) {
                console.assert(!(sound.paused), 'Test failure:  sound add: "silent" sound' +
                    " did not play."
                );
                await sound.pause();
                console.assert(comboSounds.options[0].value === SHINY_TIMER_DEBUG_SOUND_ADD,
                    "Test failure:  sound add: key string for test sound did not persist" +
                    " over reload: " + comboSounds.options[0].value
                );

                comboSounds.selectedIndex = 0;
                comboSounds.dispatchEvent(new Event("change"));
// Wait two cycles for onComboSoundsChange to be called.
                await new Promise(r => setTimeout(r, 1));
                await new Promise(r => setTimeout(r, 1));
                await buttonSoundRemove.click();
                console.assert(comboSounds.options[0].value !== SHINY_TIMER_DEBUG_SOUND_ADD,
                    'Test failure:  sound add: apparently could not remove "silent" sound.'
                );

            }
            console.warn("Please reload page for sound add test to continue.");
//window.location.reload();

        } else if (shiny_timer_debug_reload_count >= 2) {
            console.assert(comboSounds.options[0].value !== SHINY_TIMER_DEBUG_SOUND_ADD,
                'Test failure:  sound add: could not persistently remove "silent" sound.'
            );
            console.log("Test complete: sound add.");
            localStorage.setItem("reloadCount", 0);
        }

        fileSoundAdd = document.getElementById("file-sound-add");
    }

    function testBadAudio() {
        const _comboSounds = document.getElementById("combo-sounds");
        const newOption = document.createElement("option");
        newOption.value = SHINY_TIMER_DEBUG_BAD_AUDIO
        newOption.appendChild(document.createTextNode(SHINY_TIMER_DEBUG_BAD_AUDIO));
        _comboSounds.prepend(newOption);
// Note that, because loadDefaultSounds is called after this, our bad child
//  will acquire an associated Audio element, which will be eventually discarded.
    }

    async function testSilent() {
        console.assert(sounds["silent"].paused, 'Test failure:  expected "silent" to be initially paused.');
        try {
            await sounds["silent"].play();
        } catch (e) {
            console.error('Test failure:  play "silent" failed:', e);
        }
        console.assert(!sounds["silent"].paused, 'Test failure:  expected "silent" to not be paused after playing it.');
        try {
            await sounds["silent"].pause();
        } catch (e) {
            console.error('Test failure:  pause "silent" failed:', e);
        }
        console.assert(sounds["silent"].paused, 'Test failure:  expected "silent" to be paused after pausing it.');
        console.log("Test complete: silent sound sanity.");
    }

    async function testApplyParamsDespiteErrors() {
        await new Promise(r => setTimeout(r, 1000));
        if (window.shiny_timer_debug_parameters_applied) {
            console.log("Test complete: apply parameters despite errors.");
        } else {
            console.error("Test failure:  apply parameters despite errors failed: Why have the url params not been applied yet?");
        }
    }

    function getOptionsIndex(selectedPath) {
        for (let i = 0; i < comboSounds.options.length; i++) {
            const option = comboSounds.options[i];
            if (option.value === selectedPath) {
                return i;
            }
        }
        throw "Could not find selectedPath " + selectedPath;
    }

    function applyParameters(parameters) {
        if (SHINY_TIMER_DEBUG) {
            window.shiny_timer_debug_parameters_applied = true;
        }
// Problem: half the state is stored in the fieldHours etc and comboSounds,
//  and there's no dry way to change the state AND update the UI without firing events.
// Unfortunately, this function will have to be completely revised any time you change
//  the state model. Hopefully you won't have to, ya?

// Ok. This fn is a kludgy, stateful mess.
// First select the sound, which is less coupled than the rest.
        if (!launchPlayLock) {
            const selectedPath = parameters.get("selectedPath");
            if (selectedPath !== null) {
                try {
                    const selectedIndex = getOptionsIndex(selectedPath);
                    comboSounds.selectedIndex = selectedIndex;
                    comboSounds.dispatchEvent(new Event("change"));
                } catch (e) {
                    console.error(e);
                }
            }
        }

        const resetTimeString = parameters.get("resetTime");
        if (resetTimeString !== null) {
            const resetTime = parseFloat(resetTimeString);
            resetTime = secondsToHoursMinutesSeconds(resetTime);
            timer.resetTime = resetTime;
// The state stanza may invoke buttonStartPause.click(), and the fields will then
//  override timer.resetTime.
// It's ok bc. resetFields duplicates the state from timer.resetTime to the fields.
            resetFields();
        }

// state parameter is handled by just faking a bunch of user inputs.
// timeLeft stanza SHOULD be after state stanza, to override endTime set here.
        const state = parameters.get("state");
        if (state !== null) {
            if (state === "wait_for_entry") {
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
        const timeLeftString = parameters.get("timeLeft");
        if (timeLeftString !== null) {
            const timeLeft = parseInt(timeLeftString);
            timer.timeLeft = timeLeft;
            timer.endTime = Date.now() + timeLeft * 1000;
// updateDisplay() should be called after this applyParameters anyway...
        }

    }

    function onButtonURL() {
// URL has four fields: resetTime, selectedPath, state, and timeLeft.
        const u = new URL(window.location);
        const s = u.searchParams;
        s.set("state", timer.state);
        s.set("resetTime", parseTime(timeFields));
        if (timer.timeLeft !== 0)
            s.set("timeLeft", timer.timeLeft);
        s.set("selectedPath", comboSounds.value);
        fieldURL.value = u.toString();
    }

    function secondsToHoursMinutesSeconds(seconds) {
        if (seconds < 0)
            return ["00", "00", "00"];
        seconds = Math.ceil(seconds);
        
        let hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        let minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        seconds = Math.floor(seconds)

        hours = String(hours).padStart(2, "0");
        minutes = String(minutes).padStart(2, "0");
        seconds = String(seconds).padStart(2, "0");

        return [hours, minutes, seconds];
    }

// Play a sound. Prefer currentSound, but search comboSounds.options if necessary.
    async function launchPlay() {
        try {
            launchPlayLock = true;

            if (currentSound) {
                try {
                    currentSound.currentTime = 0;
                    await currentSound.play();
                    return;
                } catch (e) {
                    if (SHINY_TIMER_DEBUG && currentSound.src !== SHINY_TIMER_DEBUG_BAD_AUDIO) {
                    } else {
                        console.error("Could not play sound:", e);
                    }
                }
            }

            const candidateSounds = Array.from(comboSounds.options).map(o => [o.value, sounds[o.value]]);
            for (const name_candidate of candidateSounds) {
                const candidate = name_candidate[1];
                if (candidate) {
                    try {
                        currentSound = candidate;
                        currentSound.currentTime = 0;
                        await currentSound.play();
                        const name = name_candidate[0];
                        const i = getOptionsIndex(name);
                        console.log("launchPlay: Selecting sound " + name + " at index " + i);
                        comboSounds.selectedIndex = i;
                        return;
                    } catch (e) {
                        if (SHINY_TIMER_DEBUG && currentSound.src !== SHINY_TIMER_DEBUG_BAD_AUDIO) {
                            console.debug("Test note:     bad audio: reject bad audio source.");
                        } else {
                            candidate.pause();
                            console.error("Could not play sound:", e);
                        }
                    }
                }
            }
        } finally {
            launchPlayLock = false;
        }
    }

    function updateTimer() {
        if (timer.state === "running") {
            timer.timeLeft = (timer.endTime - Date.now()) / 1000;
            if (timer.timeLeft < 0) {
                timer.timeLeft = 0;
                timer.state = "ringing";
                launchPlay();
                buttonStartPause.value = "Ok";
            }
        }
    }

    function updateDisplay() {
        pClock.innerHTML = Date();

// Display time in the same text inputs used to input time.
        if (timer.state !== "wait_for_entry") {
            const hms = secondsToHoursMinutesSeconds(timer.timeLeft);
// Preserve user selection while updating each field.
            for (let i = 0; i < timeFields.length; i++) {
                const f = timeFields[i];
                const s = f.selectionStart; const e = f.selectionEnd;
                f.value = hms[i];
                f.setSelectionRange(s, e);
            }
        }
    }

    function update() {
        updateTimer();
        updateDisplay();
    }

    function onComboSoundsChange() {
        if (currentSound) {
            var shouldPlay = !currentSound.paused;
            currentSound.pause();
        }

        currentSound = sounds[comboSounds.value];
        if (shouldPlay && currentSound) {
            currentSound.currentTime = 0;
// suppress nuisance "error" if the user switches sounds very fast.
// "Uncaught (in promise) DOMException: The fetching process for the media resource
//  was aborted by the user agent at the user's request.
            currentSound.play().catch(() => {});
        }
    }

    function onFieldBeforeInput(e) {
// Forbid non-digits from being typed, as a hint that this box is numbers only.
// beforeinput catches a variety of events; I think "data" is present
//  iff we are changing the value in the field?
        if ("data" in e && e.data !== null) {
            if (!reDigits.test(e.data)) {
                e.preventDefault();
            } else if (timer.state !== "wait_for_entry") {
                onButtonReset(e, false);
            }
        }
    }

    function onFieldKeyDown(e) {
// If it's an arrow key, maybe jump from box to box.
// I can't do this in onFieldBeforeInput since arrows don't fire beforeInput events.
        const field = e.target;
        const i = field.selectionStart;
        let targetField = null;
        console.log("KeyDown event", e);
        if (e.key === "Enter" ) {
            console.log("Clicking startpause")
            buttonStartPause.click();
        } else if (e.key === "ArrowLeft" && i === 0) {
            if (field === fieldMinutes) targetField = fieldHours;
            else if (field === fieldSeconds) targetField = fieldMinutes;
            else return;
            targetField.focus();
            const last = targetField.value.length;
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
            onButtonReset(e, false);
        }
    }

    function parseTime(fields) {
        try {
// Use + to convert to number because for some incomprehenisble reason,
//  "parseFloat" of empty string is NaN
            let maybeSeconds = 0;
            for (const f of fields) {
                maybeSeconds = maybeSeconds * 60 + (+f.value);
            }
// I could have written something complicated to extract
// a useable value no matter what,
//  but I think it is safer to fire the alarm immediately
//  so the user knows something is wrong.
            if (Number.isNaN(maybeSeconds)) {
                alert("Cannot parse time. Did you enter a letter somewhere?");
                return 0;
            }
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

    function onButtonReset(e, shouldResetFields=true) {
        for (const key of Object.keys(sounds)) {
// Hopefully, this undefined check is redundant.
            if (sounds[key]) { 
                sounds[key].pause();
            }
        }
        if (currentSound) {
// Hopefully redundant.
            currentSound.pause()
        };

// Ignore launchPlayLock to "fix" comboSounds.selectedIndex out of bounds.
        if (comboSounds.selectedIndex < 0 ||
            comboSounds.selectedIndex >= comboSounds.options.length
        ) {
            comboSounds.selectedIndex = 0;
        }

        buttonStartPause.value = "Start";
        if (shouldResetFields) {
            resetFields();
        }
// makeTimer() will set timer.state to "wait_for_entry"
        timer = makeTimer();
// Hopefully redundant.
        onComboSoundsChange();
        divFieldPincher.style.border = DIV_FIELD_PINCHER_BORDER;
    }

    function onButtonStartPause() {
        if (timer.state === "wait_for_entry") {
            timer.timeLeft = parseTime(timeFields);
            timer.resetTime = [
                fieldHours.value, fieldMinutes.value, fieldSeconds.value
            ];
        }
        if (timer.state === "wait_for_entry" || timer.state === "paused") {
            const offsetMilli = 1000 * timer.timeLeft;
            timer.endTime = Date.now() + offsetMilli;

            timer.state = "running";
            buttonStartPause.value = "Pause";
            divFieldPincher.style.border = "none";

            updateDisplay();
        } else if (timer.state === "running") {
            updateTimer();
            timer.state = "paused";
            divFieldPincher.style.visibility = DIV_FIELD_PINCHER_BORDER;

            buttonStartPause.value = "Start";
        } else if (timer.state === "ringing") {
            timer.state = "rung";
            if (currentSound)
                currentSound.pause();
            divFieldPincher.style.visibility = DIV_FIELD_PINCHER_BORDER;
        }
// else if (timer.state === "rung")
    }

    function getMaxLength(a) {
        let longest = 0;
        for (const element of a)
            if (element.length > longest)
                longest = element.length;
        return longest;
    }

    function onFileSoundAddChange(e) {
        const suggestedNames = Array.from(fileSoundAdd.files).map(f => f.name);
        textSoundAdd.value = suggestedNames.join("\n");

        if (suggestedNames.length >= 1)
            textSoundAdd.rows = suggestedNames.length;
        else
            textSoundAdd.rows = 1;

        const longest = getMaxLength(suggestedNames) + 1;
        if (longest >= 20)
            textSoundAdd.cols = longest;
        else
            textSoundAdd.cols = 20;
    }

    async function fetchObjectStore(mode) {
        return (await databasePromise).transaction([DB_STORE_NAME], mode).objectStore(DB_STORE_NAME);
    }

    function fetchDatabase() {
        return new Promise(function (resolve, reject) {
            const databaseRequest = indexedDB.open(DB_NAME, DB_VERSION);
            databaseRequest.onsuccess = (e) => {
                resolve(databaseRequest.result);
            };

            databaseRequest.onerror = (e) => {
                console.error("Failed to load indexedDB.");
                console.error(e.currentTarget);
                reject(e);
            };

            databaseRequest.onupgradeneeded = function (e) {
                console.log("Upgrade needed (presumably also first run of database?");
                const database = e.currentTarget.result;
                if (!database.objectStoreNames.contains(DB_STORE_NAME))
                {
                    console.log("Creating store " + DB_STORE_NAME);
                    database.createObjectStore(DB_STORE_NAME, {keyPath:"id", autoIncrement:true});
                }
            };
        });
    }

    function getSound(file) {
        return new Audio(URL.createObjectURL(file));
    }

    function addNamedSound(name, sound) {
        const option = document.createElement("option");
        option.appendChild(document.createTextNode(name));
        option.value = name;

        sounds[name] = sound;
        sound.loop = true;
        comboSounds.prepend(option);
    }

    async function onButtonSoundAdd(e) {
        const names = textSoundAdd.value.split("\n");
        const files = fileSoundAdd.files;
        if (files.length === 0) {
            alert("Error: No files selected to add. Click the browse button to add a file.");
            return;
        }
        if (names.length !== files.length) {
            alert(
                "Error: Wrong number of names.\n" +
                "Found " + names.length + " names for " + files.length + " files.\n" +
                'You should have as many names in the "Name of Sound" textarea as you have files to add.\n' +
                'Names should be separated by a "line break" by pressing the enter key.'
            );
            return;
        }

        const checkedSounds = {};
        for (let i = 0; i < names.length; i++) {
            const file = files[i];
            const name = names[i];
            if (name in sounds || name in checkedSounds) {
                alert(
                    'Error: Duplicate sound name "' + name + '".\n' +
                    "Either remove that sound first or choose a different name."
                );
                return;
            }

            const sound = getSound(file);
            try {
                await sound.play();
                await sound.pause();
            } catch (e) {
                alert(
                    'Error: Cannot play sound "' + name + '".\n' +
                    "Most browsers only understand .wav, .mp3, and .ogg,\n" +
                    "except for Safari, which does not understand .ogg."
                );
                return;
            }
            checkedSounds[name] = sound;
        }

// Iterate in reverse order,
//  so the order in the combobox is the same as in the textarea.
        try {
            var objectStore = await fetchObjectStore("readwrite");
        } catch (e) {
            console.warn("buttonSoundAdd: Could not fetch IndexedDB to add sound persistently.");
        }

        for (let i = names.length - 1; i >= 0; i--) {
            const name = names[i];
            const sound = checkedSounds[name];
            if (objectStore !== undefined) {
                const file = files[i];
                const object = {id:name, file:file};
                const request = objectStore.add(object);
                request.onerror = function (e) {
// Note if people add sounds from multiple tabs we'll get duplicate key error.
                    console.error(e);
                };
            }
            addNamedSound(name, sound);
        }

        if (!launchPlayLock) {
            comboSounds.selectedIndex = 0;  // First option will be new since we prepend sounds.
            comboSounds.dispatchEvent(new Event("change"));
        }

        fileSoundAdd.value = "";
        if (!(SHINY_TIMER_DEBUG && window.shiny_timer_debug_reload_count === 0))
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

        const i = comboSounds.selectedIndex;
        if (!launchPlayLock) {
            if (i + 1 < comboSounds.options.length)
                comboSounds.selectedIndex = i + 1;
            else
                comboSounds.selectedIndex = i - 1;
            comboSounds.dispatchEvent(new Event("change"));
        }

        const option = comboSounds.options[i];
        comboSounds.remove(i);

        const id = option.value;
// Hopefully redundant.
        sounds[id].pause();
// Hopefully free resources used by that sound.
        delete sounds[id];
        if (!(id in defaultSounds)) {
            fetchObjectStore("readwrite").then(function (objectStore) {
                objectStore.delete(id).onerror = function (e) {
                    console.error(e);
                };
            });
        }

    }

    window.addEventListener("load", init, false);
})()







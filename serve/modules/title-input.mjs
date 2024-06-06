/**
 * Match the title of the document to with the value of a text input.
 * Does not go the other way: If the document title changes,
 *  the value of the text input will not be updated.
 * 
 * @param {HTMLElement} input - The <input type='text'> to listen for text.
 * @returns {Function} An unsubscribe function.
 */
export function syncTitleWith(input) {
    const setTitleToInput = () => {
        document.title = input.value;
    }

    input.addEventListener('input', setTitleToInput);
    setTitleToInput();
    return () => input.removeEventListener('input', setTitleToInput);
}

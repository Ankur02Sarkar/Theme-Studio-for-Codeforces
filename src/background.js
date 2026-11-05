/* =============================================================================
   background.js -- sound for tabs that may not play it themselves.
   Copied from Theme Studio for LeetCode (src/background.js, the offscreen
   part), Oct 23 2026. CF: the justification string names Codeforces; the
   LeetCode-only parts (focus shortcut, lcAnimeSeen cleanup) are not copied.
============================================================================= */
/* Sound for tabs that may not play it themselves. Chrome refuses audio on a
   page the user has not clicked yet (a problem opened from the address bar),
   so src/anime/sounds.js and src/game/sounds.js hand the sound here and the
   offscreen document (src/offscreen.js) plays it. One document at most.
   When the document is already open it receives the tab's message itself;
   this only opens it and forwards the messages that arrived before it was. */
let opening = null;
function ensureOffscreen() {
  if (!chrome.offscreen) return Promise.reject(new Error('no offscreen API'));
  if (!opening) {
    opening = (async () => {
      const url = chrome.runtime.getURL('src/offscreen.html');
      const open = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
      if (open.length) return false;
      await chrome.offscreen.createDocument({
        url, reasons: ['AUDIO_PLAYBACK'],
        justification: 'Plays the theme\'s moment sounds when the Codeforces tab itself may not start audio.'
      });
      return true;
    })().finally(() => { opening = null; });
  }
  return opening;
}

/* the Guided / Compact switch is gone (Nov 1 2026): a theme decides */
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.remove('cfLayout'));

chrome.runtime.onMessage.addListener((m, sender) => {
  if (!m || m.type !== 'lcts-sound' || !sender.tab) return;
  const wasOpening = !!opening;
  ensureOffscreen()
    .then((created) => {
      /* the page did not exist when this message was broadcast: deliver it */
      if (created || wasOpening) chrome.runtime.sendMessage(Object.assign({}, m.msg, { target: 'lcts-offscreen' }));
    })
    .catch(() => {});
});

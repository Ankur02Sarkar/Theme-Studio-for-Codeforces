/* dev only: answers the iframe check button in the dev box (src/modern/spike.js) */
try { parent.postMessage({ cfm: 'ping', ok: true, origin: location.origin }, '*'); } catch (e) {}

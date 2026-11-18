// When to show the "add to home screen" hint on iPhone/iPad (#50).
// Pure module: no DOM, so node --test imports it. Same logic as game-rhyflitzer's iosinstall.js.

// iPhone/iPad/iPod say so in the user agent; iPadOS 13+ reports a Mac (MacIntel) but, unlike a real Mac, has touch
export function isIos({ ua = '', platform = '', maxTouchPoints = 0 }) {
  return /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

// only in the iOS browser: the installed app already is the goal, a dismissed hint stays gone
export function shouldShowIosHint({ ua, platform, maxTouchPoints, installed, dismissed }) {
  return isIos({ ua, platform, maxTouchPoints }) && !installed && !dismissed;
}

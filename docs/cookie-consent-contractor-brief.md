# Fresh Start cookie consent prototype — contractor brief

The GitHub Pages testimony preview contains a design and interaction prototype for
the proposed website consent banner. The combined demonstration snippet is in
`fresh-start-consent-banner-snippet.html`.

## Required behaviour

- Display a prominent modal before optional tracking starts.
- Give **Accept all** and **Reject optional** equal prominence.
- Provide **Manage choices** controls for MCAE/Pardot, Google, Meta and optional
  HubSpot cookies.
- Save the visitor's preference and provide a persistent **Cookie settings** button
  so the decision can be changed later.
- Keep necessary website features available regardless of the selection.
- Keep HubSpot live chat available after optional cookies are rejected. Configure
  HubSpot privacy settings so that optional analytics and cross-visit chat history
  remain off in that state.
- When permission is withdrawn, revoke future tracking and remove applicable
  existing tracking cookies rather than merely hiding the banner.

## Production integration contract

The prototype emits an `fs:consent-changed` browser event. Its `detail.services`
object contains four booleans:

```js
window.addEventListener("fs:consent-changed", function (event) {
  const { mcae, google, meta, hubspot } = event.detail.services;
  // Connect the four production integrations here.
});
```

The public prototype deliberately loads no real trackers. On the WordPress site,
the consent controller must execute before any optional script or tag manager.

### MCAE / Pardot

Use the current Account Engagement Tracking & Consent JavaScript API rather than
the old unconditional `pd.js` snippet. On an allowed choice, set opt-in and send
the page view. On a denied or withdrawn choice, call `revokeConsent`, which clears
the Account Engagement visitor cookies and sets the opt-in state to false.

Use the verified tracker domain `go.freshstartineducation.co.uk` and the organisation's
actual Account Engagement IDs. Do not enable MCAE's separate visible banner when
this website banner is acting as the consent interface.

### Google

Set Google Consent Mode defaults before GTM or `gtag` runs. Update at least
`analytics_storage`, `ad_storage`, `ad_user_data`, and `ad_personalization` from the
visitor's choice. For a strict/basic implementation, prevent Google tags from
loading until Google permission is granted.

### Meta

Do not initialise or fire the Meta Pixel before permission. Either delay loading
the pixel entirely, or set Meta consent to revoked before pixel initialisation and
grant it only after the visitor allows Meta. Remove any unconditional pixel or
`noscript` tracking request from the page.

### HubSpot

HubSpot chat must remain usable when optional HubSpot cookies are rejected. Use
HubSpot's Privacy & Consent and chatflow privacy settings to prevent optional
tracking and cross-visit history while leaving chat functionality available.
The website-level decision and HubSpot's internal settings must agree so visitors
are not shown conflicting consent prompts.

## Acceptance checks

Test each case in a fresh browser profile while inspecting network requests and
cookies:

1. Before a choice: no MCAE, Google, Meta or optional HubSpot tracking requests.
2. Reject optional: the site and chat remain usable, with optional trackers blocked.
3. Accept all: all four approved integrations activate once.
4. Custom selection: only the selected services activate.
5. Change an earlier choice: newly allowed services activate and withdrawn services
   stop, with applicable tracking cookies removed.
6. Reload and navigate: the saved preference remains in effect without flashing the
   first-visit modal.
7. Keyboard and mobile: focus remains inside the open dialog and all actions remain
   reachable and readable.

The final production implementation should be verified with the browser network
panel, Google Tag Assistant, Salesforce Account Engagement activity, Meta Pixel
Helper and HubSpot's own consent/chat settings.

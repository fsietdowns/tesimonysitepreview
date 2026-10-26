(function () {
  "use strict";

  var STORAGE_KEY = "fs_cookie_preferences_v1";
  var CONSENT_VERSION = 1;
  var SERVICE_NAMES = ["mcae", "google", "meta", "hubspot"];
  var layer = document.getElementById("fs-consent-layer");
  var dialog = document.getElementById("fs-consent-dialog");
  var overview = document.getElementById("fs-consent-overview");
  var managePanel = document.getElementById("fs-consent-manage-panel");
  var settingsButton = document.getElementById("fs-consent-settings");
  var toast = document.getElementById("fs-consent-toast");
  var previousFocus = null;
  var toastTimer = null;
  var savedPreferences = readPreferences();

  if (!layer || !dialog) return;

  var controls = {
    mcae: document.getElementById("fs-consent-mcae"),
    google: document.getElementById("fs-consent-google"),
    meta: document.getElementById("fs-consent-meta"),
    hubspot: document.getElementById("fs-consent-hubspot")
  };

  function emptyPreferences(value) {
    return {
      mcae: value,
      google: value,
      meta: value,
      hubspot: value
    };
  }

  function validPreferences(value) {
    if (!value || value.version !== CONSENT_VERSION || !value.services) return false;
    return SERVICE_NAMES.every(function (service) {
      return typeof value.services[service] === "boolean";
    });
  }

  function readPreferences() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      return validPreferences(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writePreferences(services) {
    var record = {
      version: CONSENT_VERSION,
      updatedAt: new Date().toISOString(),
      services: services
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (error) {
      /* Preferences still apply for this page if browser storage is unavailable. */
    }

    savedPreferences = record;
    return record;
  }

  function copyServices(services) {
    var result = {};
    SERVICE_NAMES.forEach(function (service) {
      result[service] = Boolean(services[service]);
    });
    return result;
  }

  function updateControls(services) {
    SERVICE_NAMES.forEach(function (service) {
      controls[service].checked = Boolean(services[service]);
    });
  }

  function servicesFromControls() {
    var services = {};
    SERVICE_NAMES.forEach(function (service) {
      services[service] = controls[service].checked;
    });
    return services;
  }

  function applyPreferences(services, source) {
    SERVICE_NAMES.forEach(function (service) {
      document.documentElement.setAttribute(
        "data-fs-consent-" + service,
        services[service] ? "granted" : "denied"
      );
    });

    /*
      CONTRACTOR INTEGRATION POINT

      This prototype intentionally does not load production trackers. Listen for
      this event before loading any optional script, then connect each preference:

      - MCAE: use the Tracking & Consent API (`pdt("setOptIn", true)` or
        `pdt("revokeConsent")`) and never run the old unconditional pd.js snippet.
      - Google: set Consent Mode defaults before GTM/gtag and update analytics,
        ad storage, ad user data and ad personalisation from `services.google`.
      - Meta: keep consent revoked before pixel initialisation and grant it only
        when `services.meta` is true, or do not load the pixel until then.
      - HubSpot: keep live chat available; use HubSpot's own privacy settings so
        optional analytics/history cookies follow `services.hubspot`.

      The listener must also remove/revoke existing tracking when a visitor changes
      a previously granted choice to denied.
    */
    window.dispatchEvent(new CustomEvent("fs:consent-changed", {
      detail: {
        source: source,
        services: copyServices(services)
      }
    }));
  }

  function saveAndClose(services, source) {
    var record = writePreferences(copyServices(services));
    applyPreferences(record.services, source);
    closeDialog();
    showToast("Your cookie choices have been saved.");
  }

  function showPanel(name) {
    var showManage = name === "manage";
    overview.hidden = showManage;
    managePanel.hidden = !showManage;

    if (showManage) {
      updateControls(savedPreferences ? savedPreferences.services : emptyPreferences(false));
      document.getElementById("fs-consent-back").focus();
    } else {
      document.getElementById("fs-consent-accept").focus();
    }
  }

  function openDialog(panel) {
    previousFocus = document.activeElement;
    layer.hidden = false;
    settingsButton.hidden = true;
    document.body.classList.add("fs-consent-open");
    showPanel(panel || "overview");
    window.setTimeout(function () {
      dialog.focus();
    }, 0);
  }

  function closeDialog() {
    layer.hidden = true;
    settingsButton.hidden = false;
    document.body.classList.remove("fs-consent-open");
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 3200);
  }

  function focusableElements() {
    return Array.prototype.slice.call(
      dialog.querySelectorAll(
        'button:not([disabled]):not([hidden]), a[href], input:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (element) {
      return element.offsetParent !== null;
    });
  }

  function trapFocus(event) {
    if (event.key === "Escape" && savedPreferences) {
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;

    var elements = focusableElements();
    if (!elements.length) return;
    var first = elements[0];
    var last = elements[elements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.getElementById("fs-consent-accept").addEventListener("click", function () {
    saveAndClose(emptyPreferences(true), "accept-all");
  });
  document.getElementById("fs-consent-reject").addEventListener("click", function () {
    saveAndClose(emptyPreferences(false), "reject-optional");
  });
  document.getElementById("fs-consent-manage").addEventListener("click", function () {
    showPanel("manage");
  });
  document.getElementById("fs-consent-back").addEventListener("click", function () {
    showPanel("overview");
  });
  document.getElementById("fs-consent-save").addEventListener("click", function () {
    saveAndClose(servicesFromControls(), "save-selection");
  });
  document.getElementById("fs-consent-manage-accept").addEventListener("click", function () {
    saveAndClose(emptyPreferences(true), "accept-all");
  });
  document.getElementById("fs-consent-manage-reject").addEventListener("click", function () {
    saveAndClose(emptyPreferences(false), "reject-optional");
  });
  settingsButton.addEventListener("click", function () {
    openDialog("manage");
  });
  dialog.addEventListener("keydown", trapFocus);

  window.FSConsent = {
    get: function () {
      return savedPreferences ? copyServices(savedPreferences.services) : null;
    },
    open: function () {
      openDialog("manage");
    },
    reset: function () {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        /* Ignore storage errors in the prototype. */
      }
      savedPreferences = null;
      updateControls(emptyPreferences(false));
      openDialog("overview");
    }
  };

  if (savedPreferences) {
    applyPreferences(savedPreferences.services, "page-load");
    settingsButton.hidden = false;
  } else {
    openDialog("overview");
  }
}());

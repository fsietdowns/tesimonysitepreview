(function () {
  "use strict";

  var STORAGE_KEY = "fs_cookie_preferences_v1";
  var CONSENT_VERSION = 1;
  var SERVICE_NAMES = ["mcae", "google", "meta", "hubspot"];
  var initialRecord = readPreferences();
  var initialServices = initialRecord
    ? copyServices(initialRecord.services)
    : emptyPreferences(false);

  /*
    This synchronous state must run before optional trackers. It lets WordPress,
    GTM or a dedicated adapter read the effective preference before deciding
    whether a service may load. Unknown or invalid consent is always denied.
  */
  setConsentAttributes(initialServices);
  window.FSConsentInitialState = {
    hasDecision: Boolean(initialRecord),
    services: copyServices(initialServices)
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseBanner, { once: true });
  } else {
    initialiseBanner();
  }

  function emptyPreferences(value) {
    return {
      mcae: value,
      google: value,
      meta: value,
      hubspot: value
    };
  }

  function copyServices(services) {
    var result = {};
    SERVICE_NAMES.forEach(function (service) {
      result[service] = Boolean(services && services[service]);
    });
    return result;
  }

  function validPreferences(value) {
    if (!value || value.version !== CONSENT_VERSION || !value.services) return false;
    return SERVICE_NAMES.every(function (service) {
      return typeof value.services[service] === "boolean";
    });
  }

  function parsePreferences(value) {
    if (!value) return null;
    try {
      var parsed = JSON.parse(value);
      return validPreferences(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function readPreferences() {
    try {
      return parsePreferences(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return null;
    }
  }

  function setConsentAttributes(services) {
    SERVICE_NAMES.forEach(function (service) {
      document.documentElement.setAttribute(
        "data-fs-consent-" + service,
        services[service] ? "granted" : "denied"
      );
    });
  }

  function initialiseBanner() {
    var elements = {
      layer: document.getElementById("fs-consent-layer"),
      dialog: document.getElementById("fs-consent-dialog"),
      overview: document.getElementById("fs-consent-overview"),
      managePanel: document.getElementById("fs-consent-manage-panel"),
      settingsButton: document.getElementById("fs-consent-settings"),
      toast: document.getElementById("fs-consent-toast"),
      accept: document.getElementById("fs-consent-accept"),
      reject: document.getElementById("fs-consent-reject"),
      manage: document.getElementById("fs-consent-manage"),
      back: document.getElementById("fs-consent-back"),
      save: document.getElementById("fs-consent-save"),
      manageAccept: document.getElementById("fs-consent-manage-accept"),
      manageReject: document.getElementById("fs-consent-manage-reject"),
      mcae: document.getElementById("fs-consent-mcae"),
      google: document.getElementById("fs-consent-google"),
      meta: document.getElementById("fs-consent-meta"),
      hubspot: document.getElementById("fs-consent-hubspot")
    };
    var missingElements = Object.keys(elements).filter(function (name) {
      return !elements[name];
    });

    if (missingElements.length) {
      if (window.console && typeof window.console.error === "function") {
        window.console.error(
          "Fresh Start consent banner could not start. Missing elements: " +
            missingElements.join(", ")
        );
      }
      return;
    }

    var layer = elements.layer;
    var dialog = elements.dialog;
    var overview = elements.overview;
    var managePanel = elements.managePanel;
    var settingsButton = elements.settingsButton;
    var toast = elements.toast;
    var controls = {
      mcae: elements.mcae,
      google: elements.google,
      meta: elements.meta,
      hubspot: elements.hubspot
    };
    var previousFocus = null;
    var toastTimer = null;
    var savedPreferences = readPreferences();
    var effectiveServices = savedPreferences
      ? copyServices(savedPreferences.services)
      : emptyPreferences(false);
    var subscribers = [];

    function writePreferences(services) {
      var record = {
        version: CONSENT_VERSION,
        updatedAt: new Date().toISOString(),
        services: copyServices(services)
      };

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch (error) {
        /* The choice still applies to this page if storage is unavailable. */
      }

      savedPreferences = record;
      return record;
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

    function consentDetail(source) {
      return {
        source: source,
        hasDecision: Boolean(savedPreferences),
        services: copyServices(effectiveServices)
      };
    }

    function applyPreferences(services, source) {
      effectiveServices = copyServices(services);
      setConsentAttributes(effectiveServices);

      var detail = consentDetail(source);

      /*
        CONTRACTOR INTEGRATION POINT

        This controller records and publishes choices; the WordPress integration
        must still gate each service before it loads and implement grant/revoke:

        - MCAE: use the Tracking & Consent API and remove the old unconditional
          pd.js snippet. Grant with setOptIn(true), then send the page view; deny
          or withdraw with revokeConsent().
        - Google: establish Consent Mode v2 defaults before GTM/gtag and update
          analytics_storage, ad_storage, ad_user_data and ad_personalization.
        - Meta: remove the unconditional JavaScript and noscript PageView request.
          Do not load or initialise the Pixel until Meta permission is granted,
          or initialise it in a revoked state and grant only after permission.
        - HubSpot: keep live chat available, while HubSpot privacy/chat settings
          prevent optional analytics and cross-visit history without permission.

        Adapters must be registered before optional trackers, must be idempotent,
        and must remove or revoke applicable tracking when a grant is withdrawn.
      */
      window.dispatchEvent(new CustomEvent("fs:consent-changed", {
        detail: detail
      }));

      subscribers.slice().forEach(function (subscriber) {
        try {
          subscriber(detail);
        } catch (error) {
          if (window.console && typeof window.console.error === "function") {
            window.console.error("Fresh Start consent subscriber failed.", error);
          }
        }
      });
    }

    function saveAndClose(services, source) {
      var record = writePreferences(services);
      applyPreferences(record.services, source);
      closeDialog();
      showToast("Your cookie choices have been saved.");
    }

    function showPanel(name, moveFocus) {
      var showManage = name === "manage";
      overview.hidden = showManage;
      managePanel.hidden = !showManage;

      if (showManage) {
        dialog.setAttribute("aria-labelledby", "fs-consent-manage-title");
        dialog.removeAttribute("aria-describedby");
        updateControls(savedPreferences ? savedPreferences.services : emptyPreferences(false));
        if (moveFocus) elements.back.focus();
      } else {
        dialog.setAttribute("aria-labelledby", "fs-consent-title");
        dialog.setAttribute("aria-describedby", "fs-consent-description");
        if (moveFocus) elements.accept.focus();
      }
    }

    function openDialog(panel) {
      if (layer.hidden) previousFocus = document.activeElement;
      layer.hidden = false;
      settingsButton.hidden = true;
      document.body.classList.add("fs-consent-open");
      showPanel(panel || "overview", false);
      window.setTimeout(function () {
        if (!layer.hidden) dialog.focus();
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
      toast.hidden = false;
      toast.textContent = "";
      window.setTimeout(function () {
        toast.textContent = message;
      }, 0);
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

      var focusable = focusableElements();
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var currentIndex = focusable.indexOf(document.activeElement);

      if (currentIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    elements.accept.addEventListener("click", function () {
      saveAndClose(emptyPreferences(true), "accept-all");
    });
    elements.reject.addEventListener("click", function () {
      saveAndClose(emptyPreferences(false), "reject-optional");
    });
    elements.manage.addEventListener("click", function () {
      showPanel("manage", true);
    });
    elements.back.addEventListener("click", function () {
      showPanel("overview", true);
    });
    elements.save.addEventListener("click", function () {
      saveAndClose(servicesFromControls(), "save-selection");
    });
    elements.manageAccept.addEventListener("click", function () {
      saveAndClose(emptyPreferences(true), "accept-all");
    });
    elements.manageReject.addEventListener("click", function () {
      saveAndClose(emptyPreferences(false), "reject-optional");
    });
    settingsButton.addEventListener("click", function () {
      openDialog("manage");
    });
    dialog.addEventListener("keydown", trapFocus);

    window.addEventListener("storage", function (event) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;

      var incoming = parsePreferences(event.newValue);
      if (incoming) {
        savedPreferences = incoming;
        updateControls(incoming.services);
        applyPreferences(incoming.services, "storage-sync");
        if (!layer.hidden) closeDialog();
      } else {
        savedPreferences = null;
        updateControls(emptyPreferences(false));
        applyPreferences(emptyPreferences(false), "storage-reset");
        openDialog("overview");
      }
    });

    window.FSConsent = {
      get: function () {
        return savedPreferences ? copyServices(savedPreferences.services) : null;
      },
      getEffective: function () {
        return copyServices(effectiveServices);
      },
      open: function () {
        openDialog("manage");
      },
      reset: function () {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          /* Continue with an in-memory reset if storage is unavailable. */
        }
        savedPreferences = null;
        updateControls(emptyPreferences(false));
        applyPreferences(emptyPreferences(false), "reset");
        openDialog("overview");
      },
      subscribe: function (callback) {
        if (typeof callback !== "function") {
          throw new TypeError("FSConsent.subscribe requires a function.");
        }
        subscribers.push(callback);
        callback(consentDetail("subscribe"));
        return function () {
          subscribers = subscribers.filter(function (subscriber) {
            return subscriber !== callback;
          });
        };
      }
    };

    applyPreferences(
      effectiveServices,
      savedPreferences ? "page-load" : "default-denied"
    );

    if (savedPreferences) {
      settingsButton.hidden = false;
    } else {
      openDialog("overview");
    }
  }
}());

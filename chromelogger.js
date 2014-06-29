/* globals alert, chrome */
(function () {
    'use strict';

    var active = false;
    var inactiveSuffix = ' (inactive)';

    // list of all tabs with chrome logger enabled
    var tabsWithExtensionEnabled = [];

    /**
     * determines if this tab is a chrome tab in which case the extension cannot run
     */
    function _tabIsChrome(tab) {
        return tab.url.indexOf('https://chrome.google.com/extensions') === 0 || tab.url.indexOf('chrome://') === 0;
    }

    /**
     * Handles a click on the extension icon.
     *
     * @param   object  tab (https://developer.chrome.com/extensions/tabs#type-Tab)
     *
     * @return  void
     */
    function _handleIconClick(tab) {
        if (_tabIsChrome(tab)) {
            alert('You cannot use Chrome Logger on this page.');
            return;
        }
        _toggleActivity(tab);
    }

    /**
     * Switch the current tab from active to inactive or vice-versa.
     *
     * @param   object  tab (https://developer.chrome.com/extensions/tabs#type-Tab)
     *
     * @return  void
     */
    function _toggleActivity(tab) {
        var host = _getHost(tab.url);

        if (_hostIsActive(host)) {
            delete localStorage['host::' + host];
            _deactivate(tab.id);
            return;
        }
        localStorage['host::' + host] = 'true';
        _activate(tab.id);
    }

    /**
     * Get the host (domain+port) from a url.
     * ported from http://stackoverflow.com/questions/4826061/what-is-the-fastest-way-to-get-the-domain-host-name-from-a-url
     *
     * @param   string  url
     *
     * @return  string
     */
    function _getHost(url) {
        if (!url) {
            return "";
        }

        var doubleslash = url.indexOf("//");
        doubleslash += (doubleslash == -1) ? 1 : 2;

        var end = url.indexOf('/', doubleslash);
        end = end >= 0 ? end : url.length;

        // Use this if we don't want port. But we do want port.
        // var port = url.indexOf(':', doubleslash);
        // end = (port > 0 && port < end) ? port : end;

        return url.substring(doubleslash, end);
    }

    /**
     * Test to determine if a given host is active
     *
     * @param   string  host
     *
     * @return  boolean
     */
    function _hostIsActive(host) {
        if (typeof localStorage['host::' + host] === 'undefined') {
            return false;
        } else {
            return localStorage.hosts['host::' + host] === 'true';
        }
    }

    function _activate(tabId) {
        active = true;

        if (tabsWithExtensionEnabled.indexOf(tabId) === -1) {
            tabsWithExtensionEnabled.push(tabId);
        }

        _enableIcon();
        _activateTitle(tabId);
    }

    function _deactivate(tabId) {
        active = false;

        var index = tabsWithExtensionEnabled.indexOf(tabId);
        if (index !== -1) {
            tabsWithExtensionEnabled.splice(index, 1);
        }

        _disableIcon();
        _deactivateTitle(tabId);
    }

    function _activateTitle(tabId) {
        chrome.browserAction.getTitle({tabId: tabId}, function(title) {
            chrome.browserAction.setTitle({
                title: title.replace(inactiveSuffix, ''),
                tabId: tabId
            });
        });
    }

    function _deactivateTitle(tabId) {
        chrome.browserAction.getTitle({tabId: tabId}, function(title) {
            chrome.browserAction.setTitle({
                title: title.indexOf(inactiveSuffix) === -1 ? title + inactiveSuffix : title,
                tabId: tabId
            });
        });
    }

    function _enableIcon() {
        chrome.browserAction.setIcon({
            path: "icon38.png"
        });
    }

    function _disableIcon() {
        chrome.browserAction.setIcon({
            path: "icon38_disabled.png"
        });
    }

    function _handleTabUpdate(activeInfo) {
        var tabId = activeInfo.tabId;

        chrome.tabs.get(tabId, function (tab) {
            if (_tabIsChrome(tab)) {
                return _deactivate(tabId);
            }

            var domain = _getHost(tab.url);
            if (_hostIsActive(domain)) {
                return _activate(tabId);
            }

            _deactivate(tabId);
        });
    }

    function _addListeners() {
        var queuedRequests = [];
        chrome.browserAction.onClicked.addListener(_handleIconClick);
        chrome.tabs.onSelectionChanged.addListener(_handleTabUpdate);
        chrome.tabs.onActivated.addListener(_handleTabUpdate);

        chrome.webRequest.onResponseStarted.addListener(function(details) {
            if (tabsWithExtensionEnabled.indexOf(details.tabId) !== -1) {
                chrome.tabs.sendMessage(details.tabId, {name: "header_update", details: details}, function(response) {
                    if (!response) {
                        queuedRequests.push(details);
                    }
                });
            }
        }, {urls: ["<all_urls>"]}, ["responseHeaders"]);

        chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
            if (request === "localStorage") {
                return sendResponse(localStorage);
            }

            if (request === "isActive") {
                return sendResponse(active);
            }

            if (request === "ready") {
                sendResponse(queuedRequests);
                queuedRequests = [];
                return;
            }
        });
    }

    _addListeners();
}) ();

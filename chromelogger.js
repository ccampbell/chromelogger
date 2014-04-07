/* globals alert, chrome */
(function () {
    'use strict';

    var active = false;
    var inactiveSuffix = ' (inactive)';

    // list of all tabs with chrome logger enabled
    var tabsWithExtensionEnabled = [];

    // A chrome tab in which the extension cannot run
    var disabledUrls = [
        'https://chrome.google.com/extensions',
        'chrome://'
    ];

    /**
     * determines if this tab is a chrome tab in which case the extension cannot run
     */
    function _tabIsChrome(tab) {
        return disabledUrls.some(function (url) {
            return tab.url.indexOf(url) === 0;
        });
    }

    /**
     * handles a click on the extension icon
     */
    function _handleIconClick(tab) {
        if (_tabIsChrome(tab)) {
            alert('You cannot use Chrome Logger on this page.');
            return;
        }
        _toggleDomain(tab);
    }

    function _toggleDomain(tab) {
        var host = _getHost(tab.url);

        if (_domainIsActive(host)) {
            delete localStorage['host::' + host];
            _deactivate(tab.id);
            return;
        }
        localStorage['host::' + host] = 'true';
        _activate(tab.id);
    }

    // ported from http://stackoverflow.com/questions/4826061/what-is-the-fastest-way-to-get-the-domain-host-name-from-a-url
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

    function _domainIsActive(host) {
        return localStorage['host::' + host] === 'true';
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

    function _handleTabActivated(activeInfo) {
        // This is sometimes undefined but an integer is required for chrome.tabs.get
        if (typeof activeInfo.tabId != 'number') {
            return;
        }

        chrome.tabs.get(activeInfo.tabId, _handleTabEvent);
    }

    function _handleTabUpdated(tabId, changeInfo, tab) {
        _handleTabEvent(tab);
    }

    function _handleTabEvent(tab) {
        var id = (typeof tab.id === 'number') ? tab.id : tab.sessionID;

        if (!tab.active) {
            return;
        }

        if (typeof id === 'undefined') {
            return;
        }

        if (_tabIsChrome(tab)) {
            _deactivate(id);
            return;
        }

        return _domainIsActive(_getHost(tab.url)) ? _activate(id) : _deactivate(id);
    }

    function _addListeners() {
        var queuedRequests = [];
        chrome.browserAction.onClicked.addListener(_handleIconClick);
        chrome.tabs.onCreated.addListener(_handleTabEvent);
        chrome.tabs.onActivated.addListener(_handleTabActivated);
        chrome.tabs.onUpdated.addListener(_handleTabUpdated);

        chrome.webRequest.onResponseStarted.addListener(function(details) {
            if (details.tabId < 0 || !_domainIsActive(_getHost(details.url))) {
                return;
            }

            chrome.tabs.sendMessage(details.tabId, {name: "header_update", details: details}, function(response) {
                if (!response) {
                    queuedRequests.push(details);
                }
            });
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

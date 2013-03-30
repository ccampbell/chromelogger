// globals alert, chrome
(function () {
    'use strict';

    var active = false;
    var inactiveSuffix = ' (inactive)';

    /**
     * determines if this tab is a chrome tab in which case the extension cannot run
     */
    function _tabIsChrome(tab) {
        return tab.url.indexOf('https://chrome.google.com/extensions') === 0 || tab.url.indexOf('chrome://') === 0;
    }

    /**
     * handles a click on the extension icon
     */
    function _handleIconClick(tab) {
        if (_tabIsChrome(tab)) {
            return alert('You cannot use Chrome Logger on this page.');
        }
        _toggleDomain(tab);
    }

    function _toggleDomain(tab) {
        var url = tab.url;
        url = _getTopLevelDomain(url);
        if (_domainIsActive(url)) {
            localStorage[url] = false;
            _deactivate(tab.id);
            return;
        }
        localStorage[url] = true;
        _activate(tab.id);
    }

    function _getTopLevelDomain(url) {
        url = url.replace(/^(https?:\/\/)/, '', url);
        var host = url.split('/')[0];
        var bits = host.split('.');
        var tld = bits.pop();
        host = bits.pop();
        return host + '.' + tld;
    }

    function _domainIsActive(url) {
        return localStorage[url] === "true";
    }

    function _activate(tabId) {
        active = true;
        _enableIcon();
        _activateTitle(tabId);
    }

    function _deactivate(tabId) {
        active = false;
        _disableIcon();
        _deactivateTitle(tabId);
    }

    function _activateTitle(tabId)
    {
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
            path: "icon48.png"
        });
    }

    function _disableIcon() {
        chrome.browserAction.setIcon({
            path: "icon48_disabled.png"
        });
    }

    function _handleTabUpdate(tabId) {
        chrome.tabs.get(tabId, function (tab) {
            if (_tabIsChrome(tab)) {
                return _deactivate(tabId);
            }

            var domain = _getTopLevelDomain(tab.url);
            if (_domainIsActive(domain)) {
                return _activate(tabId);
            }

            _deactivate(tabId);
        });
    }

    function _addListeners() {
        chrome.browserAction.onClicked.addListener(_handleIconClick);
        chrome.tabs.onSelectionChanged.addListener(_handleTabUpdate);
        chrome.tabs.onUpdated.addListener(_handleTabUpdate);

        chrome.webRequest.onResponseStarted.addListener(function(details) {
            chrome.tabs.getSelected(null, function(tab) {
                chrome.tabs.sendRequest(tab.id, {name: "header_update", details: details});
            });
        }, {urls: ["<all_urls>"]}, ["responseHeaders"]);

        chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
            if (request === "localStorage") {
                return sendResponse(localStorage);
            }

            if (request === "isActive") {
                return sendResponse(active);
            }
        });
    }

    _addListeners();
}) ();

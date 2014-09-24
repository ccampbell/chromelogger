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

    /**
     * A tab has become active.
     * https://developer.chrome.com/extensions/tabs#event-onActivated
     *
     * @param   {[type]}  activeInfo
     *
     * @return  void
     */
    function _handleTabActivated(activeInfo) {
        // This is sometimes undefined but an integer is required for chrome.tabs.get
        if (typeof activeInfo.tabId != 'number') {
            return;
        }

        chrome.tabs.get(activeInfo.tabId, _handleTabEvent);
    }

    /**
     * A tab was updated.
     * https://developer.chrome.com/extensions/tabs#event-onUpdated
     *
     * @param   integer  tabId
     * @param   object   changeInfo
     * @param   object   tab
     *
     * @return  void
     */
    function _handleTabUpdated(tabId, changeInfo, tab) {
        _handleTabEvent(tab);
    }

    /**
     * Handle an event for any tab. Activate or deactivate the extension for the current tab.
     *
     * @param   object  tab
     *
     * @return  void
     */
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

        _domainIsActive(_getTopLevelDomain(tab.url)) ? _activate(id) : _deactivate(id);
    }

    function _addListeners() {
        var queuedRequests = [];
        chrome.browserAction.onClicked.addListener(_handleIconClick);
        chrome.tabs.onActivated.addListener(_handleTabActivated);
        chrome.tabs.onCreated.addListener(_handleTabEvent);
        chrome.tabs.onUpdated.addListener(_handleTabUpdated);

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

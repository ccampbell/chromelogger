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

    function _handleTabUpdate(activeInfo) {
        var tabId = activeInfo.tabId;

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

    function _modHeaders(header_array, p_name, p_value) {
     var did_set = false;
     for(var i in header_array) {
         var header = header_array[i];
         var name = header.name;
         var value = header.value;

         // If the header is already present, change it:
         if(name == p_name) {
             header.value = p_value;
             did_set = true;
         }
     }
     // if it is not, add it:
     if(!did_set) { header_array.push( { name : p_name , value : p_value } ); }
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
        chrome.webRequest.onBeforeSendHeaders.addListener(function(details){
          if (tabsWithExtensionEnabled.indexOf(details.tabId) !== -1) {
            _modHeaders(details.requestHeaders, 'x-chromelogger-enabled', 'true');
          }
          return {requestHeaders: details.requestHeaders};
        },{urls:  ["<all_urls>"]}, ["requestHeaders", "blocking"]);
    }

    _addListeners();
}) ();

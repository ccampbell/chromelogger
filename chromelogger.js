window.ChromePhp = (function () {
    var active = false;
    var inactiveSuffix = ' (inactive)';

    /**
     * determines if this tab is a chrome tab in which case the extension cannot run
     */
    function _tabIsChrome(tab) {
        return tab.url.indexOf("https://chrome.google.com/extensions") == 0 || tab.url.indexOf("chrome://") == 0;
    }

    /**
     * handles a click on the extension icon
     */
    function _handleIconClick(tab) {
        if (_tabIsChrome(tab)) {
            return alert('You cannot use ChromePHP on this page.');
        }
        _toggleDomain(tab);
    }

    function _toggleDomain(tab)
    {
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

    function _getTopLevelDomain(url)
    {
        var pattern = /^(https?:\/\/)/;
        url = url.replace(pattern, '', url);
        domain = url.split('/')[0];
        bits = domain.split('.');
        ext = bits.pop();
        domain = bits.pop();
        return domain + "." + ext;
    }

    function _domainIsActive(url)
    {
        return localStorage[url] == "true";
    }

    function _activate(tabId)
    {
        console.log('activate', tabId);
        active = true;
        _enableIcon(tabId);
        _activateTitle(tabId);
    }

    function _deactivate(tabId)
    {
        console.log('deactivate', tabId);
        active = false;
        _disableIcon(tabId);
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

    function _deactivateTitle(tabId)
    {
        chrome.browserAction.getTitle({tabId: tabId}, function(title) {
            chrome.browserAction.setTitle({
                title: title.indexOf(inactiveSuffix) === -1 ? title + inactiveSuffix : title,
                tabId: tabId
            });
        });
    }

    function _enableIcon(tabId)
    {
        chrome.browserAction.setIcon({
            path: "icon48.png",
            tabId: tabId
        });
    }

    function _disableIcon(tabId)
    {
        chrome.browserAction.setIcon({
            path: "icon48_disabled.png",
            tabId: tabId
        });
    }

    function _handleTabUpdate(tabId)
    {
        chrome.tabs.get(tabId, function (tab) {
            if (_tabIsChrome(tab)) {
                return _deactivate(tabId);
            }

            domain = _getTopLevelDomain(tab.url);
            if (_domainIsActive(domain)) {
                return _activate(tabId);
            }

            _deactivate(tabId);
        })
    }

    function _addListeners()
    {
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

    return {
        init: function() {
            _addListeners();
        }
    }
}) ();

window.ChromePhp.init();
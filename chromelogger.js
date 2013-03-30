window.ChromePhp = (function () {
    active = false;

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
            _deactivate();
            return;
        }
        localStorage[url] = true;
        _activate();
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

    function _activate()
    {
        active = true;
        _enableIcon();
    }

    function _deactivate()
    {
        active = false;
        _disableIcon();
    }

    function _enableIcon()
    {
        chrome.browserAction.setIcon({
            path: "new48.png"
        });
    }

    function _disableIcon()
    {
        chrome.browserAction.setIcon({
            path: "new48_disabled.png"
        });
    }

    function _handleTabUpdate(tab_id)
    {
        chrome.tabs.get(tab_id, function (tab) {
            if (_tabIsChrome(tab)) {
                return _deactivate();
            }

            domain = _getTopLevelDomain(tab.url);
            if (_domainIsActive(domain)) {
                return _activate();
            }

            _deactivate();
        })
    }

    function _addListeners()
    {
        chrome.browserAction.onClicked.addListener(_handleIconClick);
        chrome.tabs.onSelectionChanged.addListener(_handleTabUpdate);
        chrome.tabs.onUpdated.addListener(_handleTabUpdate);

        chrome.webRequest.onResponseStarted.addListener(function(details) {
            console.log(details);
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
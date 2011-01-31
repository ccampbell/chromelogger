/**
 * singleton class for handling all the logging magic
 *
 * @author Craig Campbell <iamcraigcampbell@gmail.com>
 */
var ChromePhpLogger = function()
{
    /**
     * @var string
     */
    var cookie_name = "chromephp_log";

    /**
     * @var object
     */
    var local_storage = null;

    /**
     * @var array
     */
    var request_times = [];

    /**
     * gets the current version of chrome
     *
     * @return int
     */
    var _getChromeVersion = function()
    {
        /Chrome\/(.*)\s/.test(navigator.userAgent);
        return RegExp.$1.split(".")[0];
    };

    /**
     * determine if we should use the chrome cookie api
     *
     * @return bool
     */
    var _useCookieApi = function()
    {
        return _getChromeVersion() >= 6;
    };

    /**
     * cleans up a cookie value by base 64 decoding it or url decoding it
     *
     * @param string
     * @return string
     */
    var _cleanUpCookie = function(cookie)
    {
        cookie = decodeURIComponent(cookie);

        // old style of cookies < 0.1475
        if (Util.strpos(cookie, "\"version") !== false) {
            return cookie;
        }

        return Base64.decode(cookie);
    };

    /**
     * converts a string to json
     *
     * @param string cookie
     * @return Object
     */
    var _convertToJson = function(cookie)
    {
        data = JSON.parse(cookie);

        // double encoding going on - fixed in version 2.2
        if (typeof data === "string") {
            data = JSON.parse(data);
        }

        return data;
    };

    /**
     * makes an ajax request to the specified url to get the json data and log it to the console
     *
     * @param string url
     * @return void
     */
    var _logDataFromUrl = function(url)
    {
        var request = new XMLHttpRequest();
        request.open("GET", url + "?time=" + new Date().getTime());
        request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

        request.onreadystatechange = function(e) {
            if (request.readyState == 4) {
                switch (request.status) {
                    case 200:
                        response = request.responseText;
                        // content was encoded in older versions
                        if (data.version < "0.1475") {
                            response = decodeURIComponent(response);
                        }
                        data = JSON.parse(response);
                        return _logData(data);
                    case 404:
                        console.warn('404 Page Not Found', url);
                        break;
                    case 403:
                        console.warn('403 Forbidden', url);
                        break;
                }
            }
        };
        return request.send();
    };

    /**
     * searches for a cookie and passes it off to the cookie handler
     *
     * @return void
     */
    var _lookForCookie = function()
    {
        // in Chrome < 6 we need to get cookies the old fashioned way
        if (!_useCookieApi()) {
            cookie = Util.getCookie(cookie_name);
            return _handleCookie(cookie);
        }

        request = {
            name : "cookie",
            url : document.location.href,
            cookie_name : cookie_name
        };

        chrome.extension.sendRequest(request, function(cookie) {
            if (cookie === null) {
                return _handleCookie(null);
            }
            return _handleCookie(cookie.value);
        });
    };

    /**
     * should we show line numbers?
     *
     * @return bool
     */
    var _showLineNumbers = function()
    {
        return local_storage.show_line_numbers == "true";
    };

    /**
     * should we show upgrade notification messages?
     *
     * @return bool
     */
    var _showUpgradeMessages = function()
    {
        if (local_storage.show_upgrade_messages === undefined) {
            return true;
        }
        return local_storage.show_upgrade_messages == "true";
    };

    /**
     * logs nicely formatted data in new format
     *
     * @param Object
     * @return void
     */
    var _logCleanData = function(data, callback)
    {
        column_map = {};
        for (key in data.columns) {
            column_name = data.columns[key];
            column_map[column_name] = key;
        }

        var rows = data.rows;
        for (i = 0; i < rows.length; ++i) {
            row = rows[i];
            backtrace = row[column_map.backtrace];
            label = row[column_map.label];
            log = row[column_map.log];
            type = row[column_map.type];

            if (_showLineNumbers() && backtrace !== null) {
                console.log(backtrace);
            }

            var show_label = label && typeof label === "string";

            switch (type) {
                case 'group':
                    console.group(log);
                    break;
                case 'groupEnd':
                    console.groupEnd(log);
                    break;
                case 'groupCollapsed':
                    console.groupCollapsed(log);
                    break;
                case 'warn':
                    if (show_label) {
                        console.warn(label, log);
                        break;
                    }
                    console.warn(log);
                    break;
                case 'error':
                    if (show_label) {
                        console.error(label, log);
                        break;
                    }
                    console.error(log);
                    break;
                default:
                    if (show_label) {
                        console.log(label, log);
                        break;
                    }
                    console.log(log);
                    break;
            }
        }
        callback();
    };

    /**
     * logs data in old format
     *
     * @param Object data
     * @param callback
     * @return void
     */
    var _logDirtyData = function(data, callback)
    {
        values = data["data"];
        backtrace_values = data["backtrace"];
        label_values = data["labels"];

        var last_backtrace = null;
        if (values.length) {
            for (i = 0; i < values.length; ++i) {
                if (_showLineNumbers() && backtrace_values[i] !== null && last_backtrace != backtrace_values[i]) {
                    last_backtrace = backtrace_values[i];
                    console.log(backtrace_values[i]);
                }
                if (label_values[i] && typeof label_values[i] === "string") {
                    console.log(label_values[i], values[i]);
                } else {
                    console.log(values[i]);
                }
            }
        }
        callback();
    };

    /**
     * handles data logging and determining which method to use to log data
     *
     * @param Object data
     * @return void
     */
    var _logData = function(data)
    {
        if (_showUpgradeMessages() && data.version < "2.2.1") {
            console.warn("you are using version " + data.version + " of the ChromePHP Server Side Library.\nThe latest version is 2.2.1.\nIt is recommended that you upgrade at http://www.chromephp.com");
        }
        if (data.version > "0.147") {
            return _logCleanData(data, _complete);
        }
        return _logDirtyData(data, _complete);
    };

    /**
     * called when logging is complete
     *
     * @return void
     */
    var _complete = function()
    {
        if (!_useCookieApi()) {
            Util.eatCookie(cookie_name);
            return;
        }

        request = {
            name : "eatCookie",
            url : document.location.href,
            cookie_name : cookie_name
        };

        chrome.extension.sendRequest(request);
    };

    /**
     * handles a cookie value
     *
     * @param string
     * @return void
     */
    var _handleCookie = function(cookie)
    {
        if (cookie === null) {
            return;
        }

        data = _cleanUpCookie(cookie);
        data = _convertToJson(data);

        // if there is a uri that means the log data is stored in a file server side
        // we will make an ajax request to get that data
        if (data.uri) {
            if (Util.inArray(data.time, request_times)) {
                return;
            }
            request_times.push(data.time);
            return _logDataFromUrl(data.uri);
        }

        return _logData(data);
    };

    var _listenForCookies = function()
    {
        chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {

            // if this is not a cookie update don't do anything
            if (request.name != "cookie_update") {
                return;
            }

            // if this is a cookie being deleted
            if (request.info.removed) {
                return sendResponse("done");
            }

            // a different cookie is being modified
            if (request.info.cookie.name != cookie_name) {
                return sendResponse("done");
            }

            // if we are here that means this is the ChromePHP cookie and we are good to log
            _handleCookie(request.info.cookie.value);
            sendResponse("done");
        });
    }

    return {
        /**
         * public run method
         *
         * @return void
         */
        run : function()
        {
            return _lookForCookie();
        },

        /**
         * set up local storage
         *
         * @return void
         */
        initStorage : function()
        {
            chrome.extension.sendRequest("localStorage", function(response) {
                local_storage = response;
                if (_useCookieApi()) {
                    _listenForCookies();
                }
                ChromePhpLogger.run();
            });
        },

        /**
         * public init method
         *
         * @return void
         */
        init : function()
        {
            chrome.extension.sendRequest("isActive", function(response) {
                if (response === false) {
                    return;
                }
                return ChromePhpLogger.initStorage();
            });
        }
    };
} ();

/**
 * utility functions used by the logger stuff
 */
var Util = {
    /**
     * trims spaces from either end of a string
     *
     * @param string
     * @return string
     */
    trim : function(text)
    {
        return (text || "").replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, "");
    },

    /**
     * gets string position for a piece of a string
     *
     * @param string haystack
     * @param string needle
     * @param int offset - start searching only after this point in the string
     * @return int or false
     */
    strpos : function(haystack, needle, offset)
    {
        var i = (haystack+'').indexOf(needle, (offset || 0));
        return i === -1 ? false : i;
    },

    /**
     * gets a cookie by name
     *
     * @param string name of cookie
     * @return value
     */
    getCookie : function(name)
    {
        var cookie_value = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = this.trim(cookies[i]);

                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookie_value = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookie_value;
    },

    /**
     * deletes a cookie by name
     *
     * @param string name of cookie
     * @return void
     */
    eatCookie : function(name)
    {
        document.cookie = name + '=; expires=Thu, 01-Jan-70 00:00:01 GMT;';
    },

    /**
     * checks if a value is in an array
     *
     * @param mixed needle
     * @param array haystack
     */
     inArray : function(needle, haystack)
     {
        for (key in haystack) {
            if (haystack[key] == needle) {
                return true;
            }
        }
        return false;
     }
};

ChromePhpLogger.init();

/**
 *
 *  Base64 encode / decode
 *  http://www.webtoolkit.info/
 *
 */
var Base64 = {

    // private property
    _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    // public method for encoding
    encode : function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        input = Base64._utf8_encode(input);

        while (i < input.length) {

            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output = output +
            this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
            this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

        }

        return output;
    },

    // public method for decoding
    decode : function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length) {

            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }

        }

        output = Base64._utf8_decode(output);

        return output;

    },

    // private method for UTF-8 encoding
    _utf8_encode : function (string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    },

    // private method for UTF-8 decoding
    _utf8_decode : function (utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;

        while ( i < utftext.length ) {

            c = utftext.charCodeAt(i);

            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            }
            else if((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i+1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i+1);
                c3 = utftext.charCodeAt(i+2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    }
}
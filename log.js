/**
 * singleton class for handling all the logging magic
 *
 * @author Craig Campbell <iamcraigcampbell@gmail.com>
 */
var ChromePhpLogger = function ()
{
    /**
     * @var string
     */
    var HEADER_NAME = "x-chromephp-data";

    /**
     * @var object
     */
    var local_storage = null;

    /**
     * @var array
     */
    var request_times = [];

    /**
     * @var array
     */
    var queue = [];

    /**
     * @var bool
     */
    var use_queue = true;

    /**
     * should we show line numbers?
     *
     * @return bool
     */
    function _showLineNumbers()
    {
        return local_storage.show_line_numbers == "true";
    }

    function _expandObject()
    {
        return local_storage.expand_object == 'true';
    }

    /**
     * should we show upgrade notification messages?
     *
     * @return bool
     */
    function _showUpgradeMessages()
    {
        if (local_storage.show_upgrade_messages === undefined)
        {
            return true;
        }
        return local_storage.show_upgrade_messages == "true";
    }

    /**
     * logs nicely formatted data in new format
     *
     * @param Object
     * @return void
     */
    function _logCleanData(data, callback)
    {
        column_map = {};
        for (var key in data.columns)
        {
            column_name = data.columns[key];
            column_map[column_name] = key;
        }

        var rows = data.rows,
            i = 0,
            length = rows.length;

        for (i = 0; i < length; ++i)
        {
            var row = rows[i],
                backtrace = row[column_map.backtrace],
                label = row[column_map.label],
                log = row[column_map.log],
                type = row[column_map.type] || 'log';

            if (_showLineNumbers() && backtrace !== null)
            {
                console.log(backtrace);
            }

            var show_label = label && typeof label === "string";

            if (!label)
            {
                label = "";
            }

            if (log && typeof log === 'object' && log['___class_name'])
            {
                show_label = true;

                if (label)
                {
                    label += " ";
                }

                label += log['___class_name'] + ':';
                delete log['___class_name'];
            }

            if (_expandObject())
            {
                log = _dumpObject(log);
            }
d
            switch (type)
            {
                case 'group':
                case 'groupEnd':
                case 'groupCollapsed':
                    console[type](log);
                    break;
                default:
                    type = 'log';
                case 'warn':
                case 'error':
                case 'info':
                case 'log':
                    if (show_label)
                    {
                        console[type](label, log);
                        break;
                    }
                    console[type](log);
                    break;
            }
        }

        callback();
    }


    function _addSpaces(depth)
    {
        var spaces = "";
        for (var i = 0; i < depth; i++)
        {
            spaces += "  ";
        }
        return spaces;
    }

    function _dumpObject(object, depth, addNewLine)
    {
        depth = depth || 0;
        addNewLine = addNewLine || false;
        var newline = false, 
            dump = '',
            content = '',
            item,
            key;

        if (typeof(object) == "undefined")
        {
            dump += "undefined";
        }
        else if (typeof(object) == "boolean" || typeof(object) == "number")
        {
            dump += object.toString();
        }
        else if (typeof(object) == "string")
        {
            dump += '"' + object + '"';
        }
        else if (object == null)
        {
            dump += "null"
        }
        else if (object instanceof(Array))
        {
            if (object.length > 0)
            {
                if (addNewLine)
                {
                    newline = true
                } 
                for (item in object)
                {
                    if (object.hasOwnProperty(item))
                    {
                        content += _dumpObject(object[item], depth + 1) + ",\n" + _addSpaces(depth + 1);
                    }
                }
                content = content.replace(/,\n\s*$/, "").replace(/^\s*/, "");
                dump += "[ " + content + "\n" + spacer(depth) + "]";
            } else {
                dump += "[]"
            }
        }
        else if (typeof(object) == "object")
        {
            if (Object.keys(object).length > 0)
            {
                if (addNewLine)
                {
                    newline = true
                }
                for (key in object)
                {
                    if (object.hasOwnProperty(key))
                    {
                        content += spacer(depth + 1) + key.toString() + ": " + _dumpObject(object[key], depth + 2, true) + ",\n";
                    }
                }
                content = content.replace(/,\n\s*$/, "").replace(/^\s+/, "");
                dump += "{ " + content + "\n" + spacer(depth) + "}";
            } else {
                dump += "{}";
            }
        }
        else
        {
            dump += object.toString()
        }

        return ((newline ? "\n" + spacer(depth) : "") + dump)
    }

    /**
     * handles data logging and determining which method to use to log data
     *
     * @param Object data
     * @return void
     */
    function _logData(data)
    {
        if (data.version < "3.0")
        {
            console.warn("You are using version " + data.version + " of the ChromePHP Server Side Library.  The latest version of the extension requires version 3.0 or later.  Please upgrade at http://www.chromephp.com.");
            return;
        }

        return _logCleanData(data, _complete);
    }

    function _complete()
    {
    }

    function _processQueue(callback)
    {
        for (var i = 0; i < queue.length; ++i)
        {
            _process(queue[i]);
        }

        queue = [];
        callback();
    }

    /**
     * converts a string to json
     *
     * @param string cookie
     * @return Object
     */
    function _jsonDecode(json_string)
    {
        data = JSON.parse(json_string);
        return data;
    }

    function _decode(header)
    {
        return _jsonDecode(Base64.decode(header));
    }

    function _process(details)
    {
        var headers = details.responseHeaders,
            match = false,
            header = '';

        for (var i = 0; i < headers.length; ++i)
        {
            if (headers[i].name.toLowerCase() == HEADER_NAME)
            {
                header = headers[i].value;
                match = true;
                break;
            }
        }

        if (!match)
        {
            return;
        }

        data = _decode(header);
        _logData(data);
    }

    function _handleHeaderUpdate(request, sender, sendResponse)
    {
        // if this is not a cookie update don't do anything
        if (request.name != "header_update")
        {
            return;
        }

        if (use_queue)
        {
            queue.push(request.details);
            return sendResponse("done");
        }

        _process(request.details);
        return sendResponse("done");
    }

    function _listenForLogMessages()
    {
        chrome.extension.onRequest.addListener(_handleHeaderUpdate);
    }

    function _stopListening()
    {
        chrome.extension.onRequest.removeListener(_handleHeaderUpdate);
    }

    return {
        /**
         * public run method
         *
         * @return void
         */
        run:function ()
        {
            _processQueue(function ()
            {
                use_queue = false;
            });
        },

        /**
         * set up local storage
         *
         * @return void
         */
        initStorage:function ()
        {
            chrome.extension.sendRequest("localStorage", function (response)
            {
                local_storage = response;
                ChromePhpLogger.run();
            });
        },

        /**
         * public init method
         *
         * @return void
         */
        init:function ()
        {
            _listenForLogMessages();
            chrome.extension.sendRequest("isActive", function (response)
            {
                if (response === false)
                {
                    return _stopListening();
                }
                return ChromePhpLogger.initStorage();
            });
        }
    };
}();

ChromePhpLogger.init();

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
    trim:function (text)
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
    strpos:function (haystack, needle, offset)
    {
        var i = (haystack + '').indexOf(needle, (offset || 0));
        return i === -1 ? false : i;
    },

    /**
     * gets a cookie by name
     *
     * @param string name of cookie
     * @return value
     */
    getCookie:function (name)
    {
        var cookie_value = null;
        if (document.cookie && document.cookie != '')
        {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++)
            {
                var cookie = this.trim(cookies[i]);

                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '='))
                {
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
    eatCookie:function (name)
    {
        document.cookie = name + '=; expires=Thu, 01-Jan-70 00:00:01 GMT;';
    },

    /**
     * checks if a value is in an array
     *
     * @param mixed needle
     * @param array haystack
     */
    inArray:function (needle, haystack)
    {
        for (var key in haystack)
        {
            if (haystack[key] == needle)
            {
                return true;
            }
        }
        return false;
    }
};

/**
 *
 *  Base64 encode / decode
 *  http://www.webtoolkit.info/
 *
 */
var Base64 = {

    // private property
    _keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    // public method for encoding
    encode:function (input)
    {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        input = Base64._utf8_encode(input);

        while (i < input.length)
        {

            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2))
            {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3))
            {
                enc4 = 64;
            }

            output = output +
                this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

        }

        return output;
    },

    // public method for decoding
    decode:function (input)
    {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length)
        {

            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64)
            {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64)
            {
                output = output + String.fromCharCode(chr3);
            }

        }

        output = Base64._utf8_decode(output);

        return output;

    },

    // private method for UTF-8 encoding
    _utf8_encode:function (string)
    {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++)
        {

            var c = string.charCodeAt(n);

            if (c < 128)
            {
                utftext += String.fromCharCode(c);
            }
            else if ((c > 127) && (c < 2048))
            {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else
            {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    },

    // private method for UTF-8 decoding
    _utf8_decode:function (utftext)
    {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;

        while (i < utftext.length)
        {

            c = utftext.charCodeAt(i);

            if (c < 128)
            {
                string += String.fromCharCode(c);
                i++;
            }
            else if ((c > 191) && (c < 224))
            {
                c2 = utftext.charCodeAt(i + 1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else
            {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    }
};
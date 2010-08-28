var cookie_name = "chromephp_log";
var running = true;


/**
*
*  Base64 encode / decode
*  http://www.webtoolkit.info/
*
**/
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


function trim(text)
{
    return (text || "").replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, "");
}

function strpos (haystack, needle, offset) {
    var i = (haystack+'').indexOf(needle, (offset || 0));
    return i === -1 ? false : i;
}

function getCookie(name)
{
    var cookie_value = null;
    if (document.cookie && document.cookie != '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = trim(cookies[i]);

            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) == (name + '=')) {
                cookie_value = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookie_value;
}

function deleteCookie(name)
{
    document.cookie = name + '=; expires=Thu, 01-Jan-70 00:00:01 GMT;';
}

function logCleanData(json)
{
    chrome.extension.sendRequest("getLocalStorage", function(response) {
        var show_line_numbers = response.show_line_numbers == "true" ? true : false;

        column_map = {};
        for (key in json.columns) {
            column_name = json.columns[key];
            column_map[column_name] = key;
        }

        var rows = json.rows;
        for (i = 0; i < rows.length; ++i) {
            row = rows[i];
            backtrace = row[column_map.backtrace];
            label = row[column_map.label];
            log = row[column_map.log];

            if (show_line_numbers && backtrace !== null) {
                console.log(backtrace);
            }

            if (label && typeof label === "string") {
                console.log(label, log);
            } else {
                console.log(log);
            }

        }
        deleteCookie(cookie_name);
    });
    running = false;
}

function run()
{
    running = true;
    var values = [];
    var backtrace_values = [];
    var label_values = [];

    var cookie = getCookie(cookie_name);
    if (!cookie) {
        running = false;
        return;
    }

    // old style of cookies < 0.1475
    if (strpos(cookie, "\"version") !== false) {
        cookie = decodeURIComponent(cookie);
    } else {
        cookie = Base64.decode(cookie);
    }

    data = JSON.parse(cookie);

    // not sure why this is happening
    if (typeof data === "string") {
        data = JSON.parse(data);
    }

    if (data.uri) {
        var request = new XMLHttpRequest();
        request.open("GET", data.uri);
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
                        return logData(data);
                    case 404:
                        console.warn('404 Page Not Found', data.uri);
                        break;
                    case 403:
                        console.warn('403 Forbidden', data.uri);
                        break;
                }
            }
        };

        request.send(data);
        return;
    }

    logData(data);
}

chrome.extension.sendRequest("isActive", function(response) {
    if (response === false) {
        return;
    }
    run();
});

// hack for now until we can get real listeners for XHR
function checkForCookie()
{
    var i = 0;
    (function () {
        ++i;
        if (!running && getCookie(cookie_name)) {
            run();
        } else {
            if (i < 20) {
                setTimeout(arguments.callee, 100);
            }
        }
    }) ();
}

function logData(data)
{
    var version = data["version"];
    if (version >= '0.147') {
        return logCleanData(data);
    }
    values = data["data"];
    backtrace_values = data["backtrace"];
    label_values = data["labels"];

    chrome.extension.sendRequest("getLocalStorage", function(response) {
        var show_line_numbers = response.show_line_numbers == "true" ? true : false;

        var last_backtrace = null;
        if (values.length) {
            for (i = 0; i < values.length; ++i) {
                if (show_line_numbers && backtrace_values[i] !== null && last_backtrace != backtrace_values[i]) {
                    last_backtrace = backtrace_values[i];
                    console.log(backtrace_values[i]);
                }
                if (label_values[i] && typeof label_values[i] === "string") {
                    console.log(label_values[i], values[i]);
                } else {
                    console.log(values[i]);
                }
            }
            deleteCookie(cookie_name);
        }
        running = false;
    });
}

(function init()
{
    window.addEventListener("click", function(event) {
        if (event.target.type == "submit" || event.target.type == "button" || event.target.localName == "a") {
            checkForCookie();
        }
    });
}) ();

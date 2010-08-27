var cookie_name = "chromephp_log";
var running = true;
function trim(text)
{
    return (text || "").replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, "");
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

            if (backtrace !== null) {
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

    data = JSON.parse(decodeURIComponent(cookie));

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
                        data = JSON.parse(decodeURIComponent(request.responseText));
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

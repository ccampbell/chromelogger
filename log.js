var cookie_name = "chromephp_log";

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

(function run()
{
    var values = [];
    var backtrace_values = [];
    var label_values = [];

    if (cookie = getCookie(cookie_name)) {
        data = JSON.parse(decodeURIComponent(cookie));
        values = data["data"];
        backtrace_values = data["backtrace"];
        label_values = data["labels"];
    }

    chrome.extension.sendRequest("getLocalStorage", function(response) {
        var show_line_numbers = response.show_line_numbers == "true" ? true : false;

        var last_backtrace = null;
        if (values.length) {
            for (i = 0; i < values.length; ++i) {
                if (show_line_numbers && last_backtrace != backtrace_values[i]) {
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
    });
}) ();

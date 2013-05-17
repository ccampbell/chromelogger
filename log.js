// global chrome, console, Base64
/**
 * code for handling all the logging magic
 *
 * @author Craig Campbell <iamcraigcampbell@gmail.com>
 */
(function() {
    'use strict';

    /**
     * @var string
     */
    var HEADER_NAMES = ['x-chromelogger-data', 'x-chromephp-data'];

    /**
     * @var object
     */
    var local_storage = null;
    var color1 = '#888';
    var color2 = '#0563ad';
    var toastCount = 0;


    var ALLOWED_TYPES = {
        'group': 1,
        'groupEnd': 1,
        'groupCollapsed': 1,
        'warn': 1,
        'error': 1,
        'info': 1,
        'log': 1
    };

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
        return local_storage.show_line_numbers === "true";
    }


    function _toastWarnings()
    {
        return local_storage.toast_warnings === "true";
    }

    function _toastErrors()
    {
        return local_storage.toast_errors === "true";
    }

    function _maxToastCount()
    {
        return parseInt(local_storage.max_toast_count);
    }

    function _toast(type, logs) {

        if (toastCount++ < _maxToastCount()) {
            var message = logs[logs.length - 1].substr(0, 50);
            chrome.extension.sendMessage({type: 'toast', toastType: type, message: message});
        }
    }

    /**
     * logs nicely formatted data in new format
     *
     * @param data Object
     * @param callback function
     * @return void
     */
    function _logData(data, callback)
    {
        var column_map = {};
        var column_name;

        for (var key in data.columns) {
            if (data.columns.hasOwnProperty(key)) {
                column_name = data.columns[key];
                column_map[column_name] = key;
            }
        }

        var rows = data.rows,
            i,
            length = rows.length;

        for (i = 0; i < length; i++) {
            var row = rows[i],
                backtrace = row[column_map.backtrace],
                label = row[column_map.label],
                log = row[column_map.log],
                type = row[column_map.type] || 'log';

            if (_showLineNumbers() && backtrace !== null) {
                console.log('%c' + backtrace, 'color: ' + color1 + '; font-weight: bold;');
            }



            // new version without label
            var new_version = false;
            if (data.columns.indexOf('label') === -1) {
                new_version = true;
            }

            // if this is the old version do some converting
            if (!new_version) {
                var show_label = label && typeof label === "string";

                log = [log];

                if (show_label) {
                    log.unshift(label);
                }
            }

            var logs = [];
            var current_log;
            var last_log;
            var new_string;

            // loop through logs to add in any class name labels that should be here
            for (var j = 0; j < log.length; j++) {
                current_log = log[j];
                last_log = logs[logs.length - 1];


                if (current_log && typeof current_log === 'object' && current_log['___class_name']) {
                    new_string = '%c' + current_log['___class_name'];

                    if (typeof last_log === 'string') {

                        // if the last log was a string we need to append to it
                        // in order for the coloring to work correctly
                        logs[logs.length - 1] = last_log + ' ' + new_string;
                    } else {

                        // otherwise just push the new string to the end of the list
                        logs.push(new_string);
                    }

                    logs.push('color: ' + color2 + '; font-weight: bold;');
                    delete log[j]['___class_name'];
                }

                logs.push(current_log);
            }

            if (!(type in ALLOWED_TYPES)) {
                type = 'log';
            }

            console[type].apply(console, logs);
            if (type == 'warn' && _toastWarnings()) {
                _toast('Warning', logs)
            } else if (type == 'error' && _toastErrors()) {
                _toast('Error', logs)
            }
        }

        if (typeof callback === 'function') {
            callback();
        }
    }


    function _processQueue(callback)
    {
        for (var i = 0; i < queue.length; ++i) {
            _process(queue[i]);
        }

        queue = [];
        callback();
    }

    /**
     * converts a string to json
     *
     * @param json_string string
     * @return Object
     */
    function _jsonDecode(json_string)
    {
        return JSON.parse(json_string);
    }

    function _decode(header) {
        return _jsonDecode(Base64.decode(header));
    }

    function _process(details) {
        var headers = details.responseHeaders,
            match = false,
            header = '';

        for (var i = 0; i < headers.length; i++) {
            if (HEADER_NAMES.indexOf(headers[i].name.toLowerCase()) !== -1) {
                header = headers[i].value;
                match = true;
                break;
            }
        }

        if (!match) {
            return;
        }

        var data = _decode(header);

        _logData(data);
    }

    function _handleHeaderUpdate(request, sender, sendResponse) {
        // if this is not a header update don't do anything
        if (request.name != "header_update") {
            return;
        }

        if (use_queue) {
            queue.push(request.details);
            return sendResponse("done");
        }

        _process(request.details);
        return sendResponse("done");
    }

    function _listenForLogMessages() {
        chrome.extension.onMessage.addListener(_handleHeaderUpdate);
    }

    function _stopListening() {
        chrome.extension.onMessage.removeListener(_handleHeaderUpdate);
    }

    function _run() {
        _processQueue(function() {
            use_queue = false;
        });
    }

    function _initStorage() {
        chrome.extension.sendMessage({type: "localStorage"}, function(response) {
            local_storage = response;
            color1 = 'color1' in local_storage ? local_storage['color1'] : color1;
            color2 = 'color2' in local_storage ? local_storage['color2'] : color2;
            _run();
        });
    }

    function _init() {
        _listenForLogMessages();
        chrome.extension.sendMessage({type: "isActive"}, function(response) {
            if (response === false) {
                return _stopListening();
            }
            return _initStorage();
        });
    }

    _init();
}) ();

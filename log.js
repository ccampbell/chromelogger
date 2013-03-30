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

    /**
     * should we show upgrade notification messages?
     *
     * @return bool
     */
    function _showUpgradeMessages()
    {
        if (local_storage.show_upgrade_messages === undefined) {
            return true;
        }
        return local_storage.show_upgrade_messages === "true";
    }

    /**
     * logs nicely formatted data in new format
     *
     * @param Object
     * @return void
     */
    function _logData(data, callback)
    {
        var column_map = {};
        var column_name;

        for (var key in data.columns) {
            column_name = data.columns[key];
            column_map[column_name] = key;
        }

        var rows = data.rows,
            i = 0,
            length = rows.length;

        for (i = 0; i < length; ++i) {
            var row = rows[i],
                backtrace = row[column_map.backtrace],
                label = row[column_map.label],
                log = row[column_map.log],
                type = row[column_map.type] || 'log';

            if (_showLineNumbers() && backtrace !== null) {
                console.log(backtrace);
            }

            var show_label = label && typeof label === "string";

            if (!label) {
                label = "";
            }

            if (log && typeof log === 'object' && log['___class_name']) {
                show_label = true;

                if (label) {
                    label += " ";
                }

                label += log['___class_name'] + ':';
                delete log['___class_name'];
            }

            switch (type) {
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
                    if (show_label) {
                        console[type](label, log);
                        break;
                    }
                    console[type](log);
                    break;
            }
        }

        if (typeof callback === 'function') {
            callback();
        }
    }

    function _complete() {}

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
     * @param string cookie
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
        chrome.extension.onRequest.addListener(_handleHeaderUpdate);
    }

    function _stopListening() {
        chrome.extension.onRequest.removeListener(_handleHeaderUpdate);
    }

    function _run() {
        _processQueue(function() {
            use_queue = false;
        });
    }

    function _initStorage() {
        chrome.extension.sendRequest("localStorage", function(response) {
            local_storage = response;
            _run();
        });
    }

    function _init() {
        _listenForLogMessages();
        chrome.extension.sendRequest("isActive", function(response) {
            if (response === false) {
                return _stopListening();
            }
            return _initStorage();
        });
    }

    _init();
}) ();

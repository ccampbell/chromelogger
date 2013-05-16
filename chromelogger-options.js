// global localStorage
(function() {
    'use strict';

    var defaults = {
        show_upgrade_messages: true,
        show_line_numbers: false,
        toast_warnings: false,
        toast_errors: false,
        max_toast_count: 4,
        color1: "#888",
        color2: "#0563ad"
    };

    function getInputs() {
        var checkboxes = document.querySelectorAll('input');
        return Array.prototype.slice.call(checkboxes);
    }

    function showMessage(message) {
        var info_div = document.getElementById("info");
        info_div.innerHTML = message;
        info_div.style.display = "block";
        setTimeout(function() {
            info_div.style.display = "none";
        }, 2500);

    }

    function saveOptions(e) {
        e.preventDefault();

        getInputs().forEach(function(input) {
            if (input.type == 'text') {
                localStorage[input.name] = _getColorFromValue(input.value);
                return;
            }
            localStorage[input.name] = input.checked;
        });

        showMessage('your settings have been saved');
    }

    function _getColorFromValue(value) {
        if (value.indexOf('#') === 0) {
            return value;
        }

        var colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white', 'black'];
        if (colors.indexOf(value) !== -1) {
            return value;
        }

        return '#' + value;
    }

    function _setInputValue(input, value) {
        input.value = value.indexOf('#') === 0 ? value.substring(1) : value;

        input.parentNode.querySelector('.swatch').style.background = _getColorFromValue(value);
    }

    function restoreDefaults(e) {
        e.preventDefault();

        getInputs().forEach(function(input) {
            var value = defaults[input.name];

            localStorage[input.name] = value;

            if (input.type == 'text') {
                _setInputValue(input, value);
                return;
            }

            input.checked = value;
        });

        showMessage('settings have been restored to the defaults');
    }

    function _handleColorChange(e) {
        if (e.target.tagName === 'INPUT' && e.target.type == 'text') {
            _setInputValue(e.target, e.target.value);
        }
    }

    function init() {
        getInputs().forEach(function(input) {
            if (input.type == 'text') {
                _setInputValue(input, input.name in localStorage ? localStorage[input.name] : defaults[input.name]);
                return;
            }
            input.checked = input.name in localStorage ? localStorage[input.name] === "true" : defaults[input.name];
        });

        document.getElementById('save').addEventListener('click', saveOptions, false);
        document.getElementById('restore').addEventListener('click', restoreDefaults, false);
        document.addEventListener('input', _handleColorChange, false);
    }

    document.addEventListener('DOMContentLoaded', init, false);
}) ();

// global localStorage
(function() {
    'use strict';

    var defaults = {
        show_upgrade_messages: true,
        show_line_numbers: false,
        color1: "#888888",
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
            localStorage[input.name] = input.type == 'checkbox' ? input.checked : input.value;
        });

        showMessage('your settings have been saved');
    }

    function _setInputValue(input, value) {
        if (input.type === 'checkbox') {
            input.checked = value && value !== 'false';
            return;
        }

        if (input.type === 'color' && !/#\d{6}/.test(value)) {
            value = defaults[input.name];
        }

        input.value = value;
    }

    function restoreDefaults(e) {
        e.preventDefault();

        getInputs().forEach(function(input) {
            var value = defaults[input.name];

            localStorage[input.name] = value;
            _setInputValue(input, value);
        });

        showMessage('settings have been restored to the defaults');
    }

    function init() {
        getInputs().forEach(function(input) {
            _setInputValue(input, input.name in localStorage ? localStorage[input.name] : defaults[input.name]);
        });

        document.getElementById('save').addEventListener('click', saveOptions, false);
        document.getElementById('restore').addEventListener('click', restoreDefaults, false);
    }

    document.addEventListener('DOMContentLoaded', init, false);
}) ();

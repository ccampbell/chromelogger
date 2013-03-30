// global localStorage
(function() {
    'use strict';

    function saveOptions() {
        var line_numbers = document.getElementById("show_line_numbers");
        localStorage.show_line_numbers = line_numbers.checked;

        var upgrade_messages = document.getElementById("show_upgrade_messages");
        localStorage.show_upgrade_messages = upgrade_messages.checked;

        var info_div = document.getElementById("info");
        info_div.innerHTML = "your settings have been saved";
        info_div.style.display = "block";
        setTimeout(function() {
            info_div.style.display = "none";
        }, 2000);
    }

    function restoreDefaults() {
        var line_numbers = document.getElementById("show_line_numbers");
        localStorage.show_line_numbers = false;
        line_numbers.checked = localStorage.show_line_numbers === "true" ? true : false;

        var upgrade_messages = document.getElementById("show_upgrade_messages");
        localStorage.show_upgrade_messages = true;
        upgrade_messages.checked = localStorage.show_upgrade_messages === "true" ? true : false;
    }

    function init() {
        var line_numbers = document.getElementById("show_line_numbers");
        line_numbers.checked = localStorage.show_line_numbers === "true" ? true : false;

        var upgrade_messages = document.getElementById("show_upgrade_messages");
        upgrade_messages.checked = localStorage.show_upgrade_messages === "true" ? true : false;

        if (localStorage.show_upgrade_messages === undefined) {
            upgrade_messages.checked = true;
        }

        document.getElementById('save').addEventListener('click', saveOptions, false);
        document.getElementById('restore').addEventListener('click', restoreDefaults, false);
    }

    document.addEventListener('DOMContentLoaded', init, false);
}) ();

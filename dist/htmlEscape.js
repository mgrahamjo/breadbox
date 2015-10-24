"use strict";

String.prototype.customReplaceAll = function (str1, str2, ignore) {
    return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|<\>\-\&])/g, "\\$&"), ignore ? "gi" : "g"), typeof str2 === "string" ? str2.replace(/\$/g, "$$$$") : str2);
};

function htmlEscape(str) {
    return String(str).customReplaceAll("&", "&amp;").customReplaceAll("<", "&lt;").customReplaceAll(">", "&gt;").customReplaceAll("\"", "&quot;").customReplaceAll("'", "&#39;");
}

htmlEscape.reverse = function (str) {
    return String(str).customReplaceAll("&amp;", "&").customReplaceAll("&lt;", "<").customReplaceAll("&gt;", ">").customReplaceAll("&quot;", "\"").customReplaceAll("&#39;", "'");
};

module.exports = htmlEscape;

'use strict';

String.prototype.customReplaceAll = function(str1, str2, ignore) {
    return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)==="string")?str2.replace(/\$/g,"$$$$"):str2);
};

module.exports = str => {
    return String(str)
        .customReplaceAll('&', '&amp;')
        .customReplaceAll('<', '&lt;')
        .customReplaceAll('>', '&gt;')
        .customReplaceAll('"', '&quot;')
    	.customReplaceAll('\'', '&#39;');
};
'use strict';

function replaceAll(str, str1, str2) {
    return str.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|<\>\-\&])/g,"\\$&"),"g"),(typeof(str2)==="string")?str2.replace(/\$/g,"$$$$"):str2);
}

module.exports = function(str) {
    return replaceAll(
	    	replaceAll(
	    		replaceAll(
	    			replaceAll(
	    				replaceAll(str, '\'', '&#39;'), 
	    			'"', '&quot;'),
	    		'>', '&gt;'),
	    	'<', '&lt;'),
	    '&', '&amp;');
};
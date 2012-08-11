var serverURL = "http://127.0.0.1:8000/biographer";
var debug = true;

// If debugging or testing code
if(debug) {
  var errors = '';
  // Capture JS errors in selenium
  window.onerror = function(message, url, lineNumber) {
    errors += url + ':' + lineNumber + ' ' + message + '\n';
    $('body').attr('JSError', errors);
  }

  // Capture JS errors from js files called using the $.getScript function
  $.extend({
    getScript: function(url, callback) {
      var head = document.getElementsByTagName("head")[0];
      var script = document.createElement("script");
      script.src = url;
      // Handle Script loading
      {
        var done = false;
        // Attach handlers for all browsers
        script.onload = script.onreadystatechange = function(){
          if ( !done && (!this.readyState || this.readyState == "loaded"
            || this.readyState == "complete") ) {
            done = true;
            if (callback)
              callback();
            // Handle memory leak in IE
            script.onload = script.onreadystatechange = null;
          }
        };
      }
      head.appendChild(script);
      // We handle everything using the script element injection
      return undefined;
    },
  });
}

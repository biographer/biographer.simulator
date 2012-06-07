// Array Remove - By John Resig (MIT Licensed)

Array.drop = function(from, to) {
		  var rest = this.slice((to || from) + 1 || this.length);
		  this.length = from < 0 ? this.length + from : from;
		  return this.push.apply(this, rest);
		};

Array.push = function(el) {				// kind of a bugfix, because arr.push doesn't work (in Chromium)
		this = this.concat([el]);
		}

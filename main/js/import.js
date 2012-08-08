var serverURL;
/**
 * Representation of Graphs using nodes and edges arrays. Used as
 * a placeholder for importing graphs into biographer-ui. 
 * @constructor
 */
var jSBGN = function () { 
  this.nodes = [];
  this.edges = [];
};

/**
 * Imports the x and y coordinates of all the nodes into the bui graph.
 * @param {bui.Graph} graph The bui graph instance.
 */
jSBGN.prototype.redraw = function (graph) {
  var all_drawables = graph.drawables();
  var i, j;
  // Node positions updated first
  for (i = 0; i < this.nodes.length; i++) {
    j = this.nodes[i];
    all_drawables[j.id].absolutePositionCenter(j.x, j.y);
  }
  // Recalculating edges coordinates based on the new nodes coordinates
  for (i = 0; i < this.edges.length; i++) {
    j = this.edges[i];
    all_drawables[j.id].recalculatePoints();
  }
};

/**
 * Substitutes the node id's in source and target properties 
 * of edges with the actual node objects, as required for the d3
 * layouter.
 */
jSBGN.prototype.connect = function () {
  var i, j;
  for (i in this.edges) {
    for (j in this.nodes) {
      if (this.edges[i].source == this.nodes[j].id)
        this.edges[i].source = this.nodes[j];
      if (this.edges[i].target == this.nodes[j].id)
        this.edges[i].target = this.nodes[j];
    }
  }
};

/**
 * Customised d3 force layouter.
 * @param {bui.Graph} graph The bui graph instance.
 */          
jSBGN.prototype.layout = function(graph) {
  // Give a canvas to the d3 layouter with the dimensions of the window
  var ratio = $(window).width()/$(window).height();
  var w = 1e6;
  var h = w / ratio;
  var force = d3.layout.force()
    // Charge is proportional to the size of the label
    .charge(function(node) { 
      var size = 0;
        if(typeof(node.data.label) !== 'undefined')
          size = node.id.length;
        return -2000-500*size; 
      })
    /*Link distance depends on two factors: The length of the labels of 
    the source and target and the number of nodes connected to the source */
    .linkDistance(function(edge) { 
      var size = 0;
      if(typeof(edge.source.data.label) !== 'undefined')
        size = edge.source.id.length + edge.target.id.length;
      return 100 + 30*(edge.source.weight) + 5*size; 
    })
    .linkStrength(1)
    .gravity(0.1)
    .nodes(this.nodes)
    .links(this.edges)
    .size([w, h]);
  // Run the d3 layouter synchronously, alpha cut-off 0.005
  force.start();
  while(force.alpha() > 0.005)
    force.tick();
  force.stop();
};

/** 
 * Import an SBML file into the jSBGN object. 
 * @param {File} file The file object of the SBML file.
 * @param {string} data The data contained in the SBML file.
 */
jSBGN.prototype.importSBML = function(file, data) {
  
  // File submitted to server using a form
  var formData = new FormData();
  formData.append('file', file);
  
   
  // The SBML File is uploaded to the server so that it can be opened by
  // libscopes which runs on the server 
  $.ajax({
    url: serverURL + '/Put/UploadSBML',
    type: 'POST',
    data: formData,
    contentType: false,
    processData: false,
    async: false
  });
  
  // Use libSBGN.js's SBML reader
  var reader = new sb.io.SbmlReader();
  var doc = reader.parseText(data);
  var jsbgn = JSON.parse(sb.io.write(doc, 'jsbgn'));
  
  this.nodes = jsbgn.nodes;
  this.edges = jsbgn.edges;
  this.rules = {};
          
  // Disable rules for nodes that are of type compartment or process
  var i;
  for (i in this.nodes) {
    var node = this.nodes[i];
    node.data.label = node.id;
    if ((node.sbo === sb.sbo.NodeTypeMapping[sb.NodeType.Compartment]) || 
        (node.sbo === sb.sbo.NodeTypeMapping[sb.NodeType.Process]))
      this.rules[node.id] = '';
    else
      this.rules[node.id] = 'update';
  }
};

/** 
 * Import a GINML file into the jSBGN object. 
 * @param {string} data The data contained in the GINML file.
 */
jSBGN.prototype.importGINML = function(data) {
  
  // Use jQuery's XML parser
  var xml = $.parseXML(data);
  var nodes = $(xml).find('node');
  var edges = $(xml).find('edge');
  
  // Set the SBGN language to Activity Flow
  var doc = new sb.Document();
  doc.lang(sb.Language.AF);
  
  // Extract all nodes in the XML file
  var id;
  $(nodes).each(function() {
    id = $(this).attr('id');
    doc.createNode(id).type(sb.NodeType.Macromolecule).label(id);
  });
  
  // Extract all edges taking care of the sign
  $(edges).each(function() {
    var sign, type;
    id = $(this).attr('id');
    sign = $(this).attr('sign');
    if (typeof(sign) !== 'undefined') {
      if (sign === 'positive')
        type = sb.ArcType.PositiveInfluence;
      else if (sign === 'negative')
        type = sb.ArcType.NegativeInfluence;
    }
    else
      type = sb.ArcType.UnknownInfluence;
    doc.createArc(id).type(type).source($(this).attr('from')).target($(this).attr('to'));  
  });
  
  // Generate rules from the GINML file
  // There are two types of rules, the rule defined by the connecting
  // arcs and the other rule defined by the parameter tag for each node.
  var rules = {};
  $(nodes).each(function() {
    var i, rule;
    var arcs = doc.arcs(), incoming;
    id = $(this).attr('id');
    incoming = [];
    // Create the rule given by the edges
    rule = 'false';
    for(i in arcs) {
      if(arcs[i].target().id() === id) {
        rule += '||' + arcs[i].source().id();
        incoming.push(arcs[i].id());
      }
    }
    rules[id] = '(' + Boolean(parseInt($(this).attr('basevalue'), 10)) +
     '&&!(' + rule + '))||((' + rule + ')&&(false';
    
    // Add rules derived from the Active Interations for a node.
    $(this).find('parameter').each(function() {
      var i, links;
      links = $(this).attr('idActiveInteractions').split(' ');
      incoming = incoming.filter(function(i) {return (links.indexOf(i) < 0);});
      
      rule = 'true';
      for (i in links)
        rule += '&&' + doc.arc(links[i]).source().id();
      for (i in incoming) 
        rule += '&&!' + doc.arc(incoming[i]).source().id();
        
      rules[id] += '||(' + rule + ')';
    });
    rules[id] += '))';
  });
  
  // Export the SBGN to jSBGN
  var jsbgn = JSON.parse(sb.io.write(doc, 'jsbgn'));
  this.nodes = jsbgn.nodes;
  this.edges = jsbgn.edges;
  this.rules = rules;
};

/** 
 * Import a Boolean Net file(R/Python) into the jSBGN object. 
 * @param {string} data The data contained in the Boolean Net file.
 * @param {string} splitKey The character separating the LHS and RHS of
 * a update rule.
 */
jSBGN.prototype.importBooleanNetwork = function (data, splitKey) {
  
  var targetNode, sourceNode;
  var targetID, sourceID, edgeID;
  var rules = {}, ruleNodes, rule;
  
  var doc = new sb.Document();
  doc.lang(sb.Language.AF);
  
  // The file consists of multiple lines with each line representing 
  // the update rule for a node
  var lines, cols, i, j, trimmed;
  lines = data.split('\n');	
  for (i = 0; i < lines.length; i++) {
    trimmed = lines[i].trim();
    // Skip empty lines
    if (trimmed.length === 0)
      continue;
    if (trimmed[0] != '#') {
      
      // Extract the columns using the split key which is different
      // for R and Python Boolean Net
      cols = trimmed.split(splitKey);
      if (cols.length != 2)
        console.error('Error in input file, line ' + i + ': Broken update rule');
      targetID = cols[0].trim();
      // Replace R/Python's logical operators with JS logical operators.
      rule = cols[1].replace(/[&]/g, '&&').replace(/[|]/g, '||')
                    .replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!')
                    .trim();
      
      if(targetID === 'targets' && splitKey === ',')
        continue;
      
      if (targetID[targetID.length-1] == '*')
        targetID = targetID.substring(0, targetID.length-1);
      
      // Create the node if it does not exist
      if (!(targetID in rules))
        targetNode = doc.createNode(targetID).type(sb.NodeType.Macromolecule).label(targetID);  
      rules[targetID] = rule;
      
      if (rule === 'True' || rule === 'False') {
        rules[targetID] = rule.toLowerCase();
        continue;
      }
      // Extract all the node id's in the update rule
      ruleNodes = rules[targetID].match(/[A-Za-z0-9_]+/g);
      
      for (j in ruleNodes) {
        sourceID = ruleNodes[j];
        // Create the node if it does not exist
        if (!(sourceID in rules)) {
          rules[sourceID] = sourceID;
          sourceNode = doc.createNode(sourceID).type(sb.NodeType.Macromolecule).label(sourceID);
        }
        // Connect the source and target and create the edge
        edgeID = sourceID + ' -> ' + targetID;
        if (doc.arc(edgeID) == null) 
          doc.createArc(edgeID).type(sb.ArcType.LogicArc).source(sourceID).target(targetID);
      }
		}
  }
  
  var jsbgn = JSON.parse(sb.io.write(doc, 'jsbgn'));
  this.nodes = jsbgn.nodes;
  this.edges = jsbgn.edges;
  this.rules = rules;
};



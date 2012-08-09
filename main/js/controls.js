var controls, simulator = null;
var jSBGN, Simulator;

$(document).ready(function() {
  // Load up the UI
  controls = new Controls();
  controls.initialise();
});

/**
 * The Controls class hosts all the variables related to the UI, the 
 * event handlers for the various jQuery UI components and additional 
 * functions to fetch scripts and import networks into graphs.
 * @constructor
 */
var Controls = function() {
  // Private variables to hold the bui.Graph instances
  var network = null, transition = null;
  var file = null;
  var obj = this;
  
  /**
   * Initialise all the UI components and fetch the extra js files.
   */
  this.initialise = function() {
    // Load the jQuery UI tabs
    $('#tabs').tabs();
    $('#tabs').tabs('select', '#graphNetwork');
    $('#tabs').bind('tabsselect', tabChange);
    
    // Initialise all the jQuery UI components
    $('#sliderZoom').slider({ step: 0.1, max: 2, stop: zoomGraph});
    $('#buttonSimulate').button({icons: {primary: "ui-icon-play" }});
    $('#buttonAnalyse').button({icons: {primary: "ui-icon-gear" }});
    $('#buttonImportDialog').button({icons: {primary: "ui-icon-folder-open" }});
    $('#buttonExportDialog').button({icons: {primary: "ui-icon-disk" }});
    $('#dialogImport').dialog({ autoOpen: false, minWidth: 600, modal: true });
    $('#dialogExport').dialog({ autoOpen: false, minWidth: 400, modal: true });
    $('#dialogEdit').dialog({ autoOpen: false, minWidth: 400, modal: true });
    $('#circleProgress').hide();
    
    addListeners();
    
    getScripts();
  };

  /** Bind functions to the respective listeners.
   */
  var addListeners = function() {
    $('#buttonImportDialog').click(importDialog);
    $('#fileNetwork')[0].addEventListener('change', readFile, false);
    $('#dropFile')[0].addEventListener('drop', dropFile, false);
    $('#dropFile')[0].addEventListener('dragenter', dragEnter, false);
    $('#dropFile')[0].addEventListener('dragleave', dragExit, false);
    $('#dropFile')[0].addEventListener('dragover', dnd, false);
    $('#buttonImportFile').click(importFile);
    
    $('#buttonExportDialog').click(exportDialog);
    $('#buttonExportFile').click(exportFile);
  };

  /** Fetch all the scripts not essential to UI asynchronously.
   */
  var getScripts = function() {
    // Ensure that the files are fetched as JS.
    $.ajaxSetup({
      cache: true,
      beforeSend: function(xhr) {
        xhr.overrideMimeType("text/javascript");
      }
    });
    
    $.getScript("lib/jquery.simulate.js");
    $.getScript("lib/biographer-ui.min.js", function() {
      bui.settings.css.stylesheetUrl = 'css/visualization-svg.css';
    });
    $.getScript("lib/interact.js");
    $.getScript("lib/d3.v2.min.js");
    $.getScript("lib/libSBGN.min.js");
    $.getScript("lib/rickshaw.min.js");

    $.getScript("js/import.js");
    $.getScript("js/simulator.js");
    
    $.ajaxSetup({
      beforeSend: null
    });
  };

  /** 
   * The event handler for a change in the value of the Graph Zool slider.
   * @param {Event} event The event object containing information about the 
   * type of event.
   * @param {UI} ui Contains the value of the slider.
   */
  var zoomGraph = function(event, ui) {
    // Get the index of the selected tab.
    var i = $('#tabs').tabs('option', 'selected');
    
    // Get the correct bui.Graph instance depending on the current tab.
    if(i === 0) {
      if (network === null)
        return;
      graph = network;
    }
    else if(i === 1) {
      if (transition === null)
        return;
      graph = transition;
    }
    
    // Scale the bui graph to the value set by the slider
    graph.scale(ui.value);
    graph.reduceTopLeftWhitespace();
  };

  /** 
   * The event handler for a tab change.
   * @param {Event} event The event object containing information about the 
   * type of event.
   * @param {UI} ui Contains the index of the selected tab.
   */
  var tabChange = function(event, ui) {
    // Get the current tab index
    var i = ui.index;
    
    if(i === 0) {
      if (network === null)
        return;
      graph = network;
    }
    else if(i === 1) {
      if (transition === null)
        return;
      graph = transition;
    }
    else
      return;
    
    // Set the slider's value to the current graph's scale 
    $('#sliderZoom').slider('option', 'value', graph.scale());
  };

  /** 
   * The event handler for clicking the choose file box.
   * @param {Event} event The event object containing information about the 
   * type of event. Contains the file list.
   */
  var readFile = function(event) {
    // Get the file object from the event
    file = event.target.files[0];
  };

  /** 
   * Prevent the default events from triggering for the drag and drop box.
   * @param {Event} event The event object containing information about the 
   * type of event. 
   */
  var dnd = function(event) {
    event.stopPropagation();
    event.preventDefault();
  };

  /** 
   * The event handler for dropping a file in the box.
   * @param {Event} event The event object containing information about the 
   * type of event. Contains the file list.
   */
  var dropFile = function(event) {
    dnd(event);
    // Get the file object and set the file name
    file = event.dataTransfer.files[0];
    $('#dropFile span').html(file.name);
  }

  /** 
   * The event handler for entering a file into the box space.
   * @param {Event} event The event object containing information about the 
   * type of event. 
   */
  var dragEnter = function(event) {
    dnd(event);
    // Change the box to reflect the new state.
    $('#dropFile span').html('Drop File now');
  };

  /** 
   * The event handler for exiting the box space.
   * @param {Event} event The event object containing information about the 
   * type of event. 
   */
  var dragExit = function(event) {
    dnd(event);
    $('#dropFile span').html('Drag and Drop File');
  };

  /** 
   * The event handler for opening the import dialog box.
   */
  var importDialog = function() {
    // If the simulator is running stop it.
    if(simulator !== null) 
      simulator.stop();
      
    // Set all values to their initial states.
    file = null;
    $('#fileNetwork').attr({ value: '' });
    $('#dropFile span').html('Drag and Drop File');
    $('#dialogImport').dialog('open');
  };

  /** 
   * The event handler for the import file button in the import file dialog
   * box.
   */  
  var importFile = function() {
    $('#dialogImport').dialog('close');
    
    if (file === null)
      return;
    
    // Create an instance of the file reader and jSBGN.
    var reader = new FileReader();
    var data, jsbgn = new jSBGN();
    
    // This event handler is called when the file reading task is complete
    reader.onload = function(read) {
      // Get the data contained in the file
      data = read.target.result;
      
      // Depending on the file type option checked in the import dialog box
      // call the appropriate importer
      if($('#formatRBoolNet').attr('checked'))
        jsbgn.importBooleanNetwork(data, ',');
      else if($('#formatPyBooleanNet').attr('checked'))
        jsbgn.importBooleanNetwork(data, '=');
      else if($('#formatGINML').attr('checked'))
        jsbgn.importGINML(data);
      else 
        jsbgn.importSBML(file, data);
        
      $('#graphStateTransition').html('');
      
      // Import the jSBGN object into a bui.Graph instance
      obj.importNetwork(jsbgn, '#graphNetwork');
      $('#tabs').tabs('select', '#graphNetwork');
      $('#textIteration').text(0);
      
      // Delete any previous instance of the Simulator and initialise a new one
      if(simulator !== null) 
        simulator.destroy();
      simulator = new Simulator();
      if($('#formatSBML').attr('checked'))
        simulator.scopes = true;  
      var settings = { 
        simDelay: 500, 
        guessSeed: $('#seedGuess').attr('checked'),
        oneClick: $('#optionsOneClick').attr('checked')
      };
      simulator.initialise(jsbgn, settings);
    };
    reader.readAsText(file);
  };

  /** 
   * Import a jSBGN object into the Network tab by creating a new bui.Graph
   * instance.
   * @param {jSBGN} jsbgn The network in the form of a jSBGN object.
   * @param {string} tab The tab in which to display the graph.
   * @returns {bui.Graph} The graph for the network.
   */
  this.importNetwork = function(jsbgn, tab) {
    $(tab).html('');
    var graph = new bui.Graph($(tab)[0]);
    
    var importHandle = graph.suspendRedraw(20000);
    bui.importFromJSON(graph, jsbgn);
    // Do the layouting
    jsbgn.connect();
    jsbgn.layout(graph);
    jsbgn.redraw(graph);
    // Center the graph and optionally scale it
    graph.reduceTopLeftWhitespace();
    if($('#optionsScale').attr('checked')) 
      graph.fitToPage();
    graph.unsuspendRedraw(importHandle);
    $('#sliderZoom').slider('option', 'value', graph.scale());
    $('#tabs').tabs('select', tab);
    
    if (tab === '#graphStateTransition')
      transition = graph;
    else
      network = graph;
  };

  /** 
   * Get the seed to be given initially to the network.
   * @returns {Boolean} The seed for the node in the network. 
   */
  this.getInitialSeed = function() {
    if($('#seedTrue').attr('checked')) 
      return true;
    else if ($('#seedFalse').attr('checked')) 
      return false;
    else if ($('#seedRandom').attr('checked')) 
      return Boolean(Math.round(Math.random()));
    else
      return true;
  }

  /** 
   * The event handler for opening the export dialog.
   */
  var exportDialog = function() {
    if(simulator !== null) 
      simulator.stop();
    $('#dialogExport').dialog('open');
  };

  /** 
   * The event handler for clicking the export file button of the export
   * file dialog box.
   */
  var exportFile = function() {
    $('#dialogExport').dialog('close');
    
    // Get the bui.Graph instance of the select graph to export
    var graph;
    if ($('#exportNetwork').attr('checked'))
      graph = network;
    else if ($('#exportStateTransition').attr('checked'))
      graph = transition;
    else {
      // Export the update rules to a Boolean Net format file.
      if(!$('#formatSBML').attr('checked')) {
        if ($('#exportNetworkRBoolNet').attr('checked'))
          var bn = simulator.exportRBoolNet();
        else
          var bn = simulator.exportPythonBooleanNet();
        var content = "data:text/plain," + encodeURIComponent(bn);
        window.open(content, 'tmp');
      }
      return;
    }
    
    // Check the file format to which the graph has to be exported
    if ($('#graphSBGN').attr('checked')) {
      var jsbgn = graph.toJSON();
      var sbgn = null;
      alert('Wait for Lian to finish his jsbgn reader');
    }
    else if ($('#graphjSBGN').attr('checked')) {
      var jsbgn = JSON.stringify(graph.toJSON());
      var content = "data:text/plain," + encodeURIComponent(jsbgn);
      window.open(content, 'tmp');
    }
    else if ($('#graphSVG').attr('checked')) {
      var svg = graph.rawSVG();
      var content = "data:image/svg+xml," + encodeURIComponent(svg);
      window.open(content, 'tmp');
    }
  };
};

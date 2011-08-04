# -*- coding: utf-8 -*-

import sys

hardcoded = request.folder + "/modules"
if not hardcoded in sys.path:
	sys.path.append(hardcoded)
import biographer

from copy import deepcopy

def index():							# show DEBUG messages, JSON & BioLayout
	if session.bioGraph is not None:
		session.bioGraph.exportJSON()
		session.bioGraph.export_to_Layouter()
	return dict()

def JSON():							# called from Workbench/index
	if session.bioGraph is not None:
		session.bioGraph.exportJSON()
	return dict()

def Layout():							# called from Workbench/index
	if session.bioGraph is not None:
		session.bioGraph.export_to_Layouter()
	return dict()

def Editor():							# Node: add / delete / rename, Edge: create / remove
	if session.bioGraph is None:
		session.flash = "Unable to edit: No graph is loaded. Import a model from BioModels.net ?"
		return redirect( URL(r=request, c="Import", f="BioModels")+"?returnto="+URL(r=request, c="Workbench", f="Editor") )
	return dict()

def Cutter():							# interface to use the Dijkstra algorithm
	if request.env.method == "GET":
		return dict()

	if request.env.method == "POST":
		if session.bioGraph is None:
			session.flash = "Unable to cut, because no graph is loaded"
			return redirect( URL(r=request, c="Workbench", f="index") )
		if request.vars.ID is None:
			session.flash = "Unable to cut, because no Node was specified"
			return redirect( URL(r=request, c="Workbench", f="index") )
		if request.vars.distance is None:
			session.flash = "Unable to cut, because no maximum distance was specified"
			return redirect( URL(r=request, c="Workbench", f="index") )

		bioGraph = deepcopy( session.bioGraph )
		bioGraph.Dijkstra( session.bioGraph.getNodeByID(request.vars.ID), request.vars.distance )
		session.bioGraph = bioGraph
		session.flash = "Graph cut successfully"

		return redirect( URL(r=request, c="Workbench", f="index") )


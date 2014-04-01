//////////////////////////////////////////////////////////////
// Logic for the logic execution plan
//
// This file contains all the code required to display
// the logic execution tree on the right of the page.
//
// This code will be of interest only if you plan on
// using the rules summary.


var Kahuna = {LogicPlan: {}}; // Namespace

// Display the logic tree
// elementSelector: a jQuery expression pointing to the container for the tree, e.g. '#myLogicDiv'
// logic: the JSON array returned by Kahuna (the value of the logic property)
Kahuna.LogicPlan.displayLogic = function(elementSelector, logic, selectHandler) {
	
	// Destroy previous tree, if it exists
	var oldTree = jQuery.jstree._reference(elementSelector);
	if (oldTree)
		oldTree.destroy();
	
	var evtLevels = [];
	var topContainer = [];
	var currentContainer = topContainer;
	var shortNames = {
			"AFTER_PARENT_COPY": "Parent copy",
			"AFTER_FORMULA": "Formula",
			"AFTER_AGGREGATE": "Aggregate",
			"AFTER_CONSTRAINT": "Constraint",
			"BEFORE_ACTION": "Begin action",
			"AFTER_ACTION": "End action",
			"BEFORE_COMMIT": "Before commit",
			"AFTER_COMMIT": "After commit"
	};
	for (var i = 0; i < logic.length; i++) {
		var evt = logic[i];
		evt.shortName = shortNames[evt.type];
		if (evt.type == "LOGIC_RUNNER") {
			if (evt.subtype.substring(0, 5) == "BEGIN") {
				var newContainer = [];
				evtLevels.push(currentContainer);
				var node = {
						"data": "Logic for " + evt.pk,
						"metadata": {"event" : evt},
						"state": "open",
						"children": newContainer
				};
				currentContainer.push(node);
				currentContainer = newContainer;
			}
			else if (evt.subtype.substring(0, 3) == "END") {
				currentContainer = evtLevels.pop();
			}
		}
		else if (evt.type == "BEFORE_COMMIT" || evt.type == "AFTER_COMMIT") {
			currentContainer.push({"data": evt.shortName, "attr": {"event": evt}});
		} 
		else {
			var node = {
				"data": evt.shortName + ": " + (evt.CopyAttribute?evt.CopyAttribute:"") + " " + evt.pk,
				"metadata": {"event" : evt}
			};
			currentContainer.push(node);
		}
	}
	
	$(elementSelector)
	.bind("select_node.jstree", function (event, dat) {
		var evt = dat.rslt.obj.data("event");
		selectHandler(evt);
	})
	.jstree({
		core : { "animation": 150 },
		themes: {theme: "classic"},
		json_data: {"data": topContainer},
		plugins : [ "themes", "json_data", "ui"]
	});
};

// Given an event, return HTML containing a table that describes the event.
Kahuna.LogicPlan.formatEvent = function(evt) {
	var res = "<table class='EventPropTable'>\n";
	res += "<tr><td class='EventPropName'>Event type</td><td class='EventPropValue'>" + evt.type + "</td></tr>\n";
	res += "<tr><td class='EventPropName'>Entity</td><td class='EventPropValue'>" + evt.entity + " " + evt.pk + "</td></tr>\n";
	if (evt.CopyAttribute)
		res += "<tr><td class='EventPropName'>Attribute</td><td>" + evt.CopyAttribute + "</td></tr>\n";
	if (evt.ruleId)
		res += "<tr><td class='EventPropName'>Rule ID</td><td>" + evt.ruleId + "</td></tr>\n";
	if (evt.expression)
		res += "<tr><td class='EventPropName'>Expression</td><td>: " + evt.expression + "</td></tr>\n";
	if (evt.predicate)
		res += "<tr><td class='EventPropName'>Predicate</td><td>" + evt.predicate + "</td></tr>\n";
	if (evt.roleName)
		res += "<tr><td class='EventPropName'>Role name</td><td>" + evt.roleName + "</td></tr>\n";
	if (evt.summedAttribute)
		res += "<tr><td class='EventPropName'>Summed attribute</td><td>" + evt.summedAttribute + "</tr></tr>\n";
	if (evt.watchedAttribute)
		res += "<tr><td class='EventPropName'>Watched attribute</td><td>" + evt.watchedAttribute + "</td></tr>\n";
	if (evt.properties) {
		for (var prop in evt.properties) {
			res += "<tr><td class='EventPropName'>" + prop + "</td><td>" + evt.properties[prop] + "</td></tr>\n";
		}
	}
	res += "</table>\n";
	return res;
};

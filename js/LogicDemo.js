//////////////////////////////////////////////////////////////
// Presentation logic for Espresso Logic demo
//
// Please note that this is *not* intended as a model of how to write
// a JavaScript app. A lot of things could be done more elegantly with
// a framework like AngularJS, but the purpose of this app is to 
// show what can be done with Espresso Logic.
//
// The orders and line items are retrieved in one request by using the OneCustomer
// resource, which covers customers, orders, and line items.
// This resource was created in the Logic Designer without any code or SQL.
// To see it, go to the Espresso Logic tab and select Resources in the left navigation bar.

// The URL to the demo project
var baseUrl="https://livedemo.espressologic.com/rest/demo/Demo_H7odd/v1/";

// The API key use to access the demo project
var currentApiKey = "1Y1QA6OXYVatXI7";


// All calls to the logic server go through this
// type: GET, POST, PUT or DELETE
// url: the URL fragment, e.g. OneCustomer/123
// data: the JSON payload for POST or PUT
// params: additional parameters for REST call
// doneFunction: function to be called with the result
function makeCall(type, url, data, params, async, doneFunction) {
	
	// First, make sure we're not tripping on ourselves. If there is an update in progress,
	// ignore this update.
	if (type != "GET" && updateInProgress) {
		console.log('Update already in progress -- ignoring this one.');
		return;
	}
	if (type != "GET")
		updateInProgress = true;

	if (url.substring(0, 4) != "http") // If it's not a complete URL, complete it
		url = baseUrl + url;
	
	// Build up the parameter string if params were provided
	var args = "";
	if (params) {
		for (var name in params) {
			if ( ! params.hasOwnProperty(name))
				continue;
			args += args.length == 0 ? "?" : "&";
			args += name + "=" + escape(params[name]);
		}
	}
	if ($("#showTxSummary").attr("checked")) {
		args += args.length == 0 ? "?" : "&";
		args += "ruleSummary=true";
	}
	if (type != "GET") {
		args += args.length == 0 ? "?" : "&";
		args += "changeSummary=true";
	}
	var hdrs = {"Authorization": "Espresso " + currentApiKey + ":1"};
	
	// For GET, we put the authentication on the URI, that saves an OPTIONS request
	if (type == "GET") {
		args += args.length == 0 ? "?" : "&";
		args += "auth=" + currentApiKey + ":1";
		hdrs = {};
	}
	url += args;

	// Make the REST call
	jQuery.support.cors = true;
	$.ajax({		// $ ==> jQuery
		type: type,
		url: url,
		headers: hdrs,
		dataType: "json",
		data: data,
		async: async,
		error: function(jqXHR, textStatus, errorThrown) {
			updateInProgress = false;
			if (jqXHR.responseText && jqXHR.responseText[0] == '{') {
				var errorObj = eval('(' + jqXHR.responseText + ')');
				if (errorObj.errorMessage)
					alert(errorObj.errorMessage);
				else
					alert("Ajax failed : " + errorThrown);
			}
			else
				alert("Ajax failed : " + errorThrown);
		}
	}).done(function(d){
		updateInProgress = false;
		doneFunction(d);
	});
}

// If the user changes data very quickly, we could have updates that run into each other.
// To avoid that, we make sure that only one update happens at a time.
// This is likely to happen only with the line item quantity because it's very easy to change it rapidly.
var updateInProgress = false; // True when an update is in progress

// Get a list of all customers, for the select at the top
function loadCustomerList() {
	$('#custNameControl').children().remove();
	makeCall("GET", "AllCustomers", null, null, true, function(data){
		for (var i = 0; i < data.length; i++) {
			var cust = data[i];
			$('#custNameControl').append("<option value='" + cust.customer_ident + "'>" + cust.name + "</option>");
		}
		refreshCustomer();
	});
}

// Get the details for one customer (and their orders and line items)
var currentCustomer;
function refreshCustomer() {
	var custIdent = $('#custNameControl').val();
	makeCall("GET", "OneCustomer/" + custIdent,
			null, null, true, function(data) {
				currentCustomer = data[0];
				refreshCustomerWithData();
				$('#ordersTable').html("");
				refreshOrders();
			});
}

// Update the current customer with the latest currentCustomer
function refreshCustomerWithData() {
	$('#customerName').html(currentCustomer.name);
	$('#custBalanceTd').html(currentCustomer.balance.toFixed(2));
	$('#creditLimit').val(currentCustomer.credit_limit.toFixed(2));
}

// Update the orders list with the latest
function refreshOrders() {
	var orders = currentCustomer.Orders;
	for (var i = 0; i < orders.length; i++) {
		var order = orders[i];
		order.getReassignCustomerSelect = (function() {
			var orderNum = order.order_number;
			return function() { return getReassignCustomerSelect(orderNum); };
		})();
		$('#orderRow' + order.order_number).remove();
		var html = templates.orderTemplate(order);
		$('#ordersTable').prepend(html);
		getLineitems(order);
	}
}

// Refresh an order from received data
function refreshOrderWithData(order) {
	$('#amountTotal' + order.order_number).html('$' + order.amount_total.toFixed(2));
}

// Refresh the line items for an order
var currentLineitems = {};
function getLineitems(order) {
	var items = order.Lineitems;
	for (var i = 0; i < items.length; i++) {
		var lineitemId = items[i].lineitem_id;
		currentLineitems[lineitemId] = items[i];
		var theItem = items[i];
		items[i].getProductSelect = (function() { // Note the closure, since we're in a loop, and variables are shared
			var prodNum = theItem.product_number;
			var itemId = theItem.lineitem_id;
			return function(){return getProductSelect(itemId, prodNum);};
		})();
		var html = templates.lineitemTemplate(items[i]);
		$('#itemsForOrder' + order.order_number).prepend(html);
	}
}

// Refresh an individual line item
function refreshLineitemWithData(lineitem) {
	$('#productPrice' + lineitem.lineitem_id).val('$' + lineitem.product_price.toFixed(2));
	$('#amount' + lineitem.lineitem_id).html('$' + lineitem.amount.toFixed(2));
}

// Get a select control for Products
// ItemNum: the ident of the line item for which this select is created
// ProductNumber: the number of the product that should be selected by default
var products;
function getProductSelect(ItemNum, ProductNumber) {
	if (products == null) {
		makeCall("GET", "Products", null, null, false, function(data) {
			products = data;
		});
	}
	var html = templates.productSelectTemplate({ItemNum: ItemNum, ProductNumber: ProductNumber, products: products});
	return html;
}

// This is a bit of Handlebar magic that allows us to generate the product select
Handlebars.registerHelper('prodSelect', function(items, options) {
	var html = "";
	var prodNum = options.fn({});
	for (var i = 0, l = items.length; i < l; i++) {
		var item = items[i];
		html = html + "<option value='" + item.product_number + "'";
		if (item.product_number == prodNum)
			html = html + " selected";
		html = html + ">" + item.name + "\n";
	  }
	return html;
});

// Returns a select control for reassigning an order to another customer.
// orderId: the ident of the order for which the select is being created
var customers;
function getReassignCustomerSelect(orderId) {
	if (customers == null) {
		makeCall("GET", "AllCustomers", null, null, false, function(data) {
			customers = data;
		});
	}
	var optionsHtml = "";
	for (var i = 0; i < customers.length; i++) {
		var cust = customers[i];
		if (escape(cust.customer_ident) == $('#custNameControl').val())
			continue;
		optionsHtml += "<option value='" + cust.customer_ident + "'>" + cust.name + "\n";
	}
	var obj = {orderId: orderId, options: optionsHtml};
	var html = templates.reassignCustomerSelectTemplate(obj);
	return html;
}

// Move an order from one customer to another
// orderId: the ident of the order to reassign
// custName: the name of the customer receiving the order. This is used in the notification.
// custIdent: the ident of the customer receiving the order.
function reassignOrder(orderId, custName, custIdent) {
	var order = getOrder(orderId);
	var data = JSON.stringify({order_number: orderId, customer_ident: custIdent, '@metadata': {checksum: order['@metadata'].checksum}});
	makeCall("PUT", order['@metadata'].href, data, {}, true, function(response) {
		refreshAfterUpdate(response);
		$('#messageDiv').html("Order " + orderId + " has been reassigned to customer " + custName);
		$('#messageDiv').slideDown(500).delay(3000).slideUp(500);
	});
}

// Create a new order for the current customer
function createOrder() {
	var data = JSON.stringify({customer_ident: currentCustomer.customer_ident, paid: false});
	makeCall("POST", "OneCustomer.Orders", data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Switch an order's paid status
function flipOrderPaid(orderId, checked) {
	var order = getOrder(orderId);
	var data = JSON.stringify({order_number: orderId, '@metadata': {checksum: order['@metadata'].checksum}, paid: checked});
	makeCall("PUT", order['@metadata'].href, data, {}, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Delete the specified order
function deleteOrder(orderId) {
	if ( ! confirm('Delete this order?'))
		return;
	var order = getOrder(orderId);
	makeCall("DELETE", order['@metadata'].href, null, {checksum: order['@metadata'].checksum}, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Find the index of an order in the collection of all orders
function getOrderIndex(order) {
	for (var i = 0; i < currentCustomer.Orders.length; i++) {
		var ord = currentCustomer.Orders[i];
		if (ord.order_number == order.order_number) {
			return i;
		}
	}
	return -1;
}

// Find an order based on its order_number
function getOrder(orderId) {
	for (var i = 0; i < currentCustomer.Orders.length; i++) {
		var ord = currentCustomer.Orders[i];
		if (ord.order_number == orderId) {
			return ord;
		}
	}
}

// Update the notes for an order
function updateNotes(orderId, notes) {
	var order = getOrder(orderId);
	var data = JSON.stringify({order_number: orderId, '@metadata':{checksum: order['@metadata'].checksum}, notes: notes});
	makeCall("PUT", order['@metadata'].href, data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Update the current customer's credit limit
function updateCreditLimit(newValue) {
	var data = JSON.stringify({customer_ident: currentCustomer.customer_ident, 
		'@metadata': {checksum: currentCustomer['@metadata'].checksum}, credit_limit: trim(newValue)});
	makeCall("PUT", currentCustomer['@metadata'].href, data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Update a line item's quantity
function updateQuantity(lineitemId, newValue) {
	var lineitem = currentLineitems[lineitemId];
	var data = JSON.stringify({lineitem_id: lineitemId, 
		'@metadata':{checksum: lineitem['@metadata'].checksum}, qty_ordered: trim(newValue)});
	makeCall("PUT", lineitem['@metadata'].href, data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Update a line item's unit price
function updatePrice(lineitemId, newPrice) {
	newPrice = newPrice.replace(/\$|,/g, '');
	newPrice = parseFloat(newPrice);
	var lineitem = currentLineitems[lineitemId];
	var data = JSON.stringify({lineitem_id: lineitemId, 
		'@metadata': {checksum: lineitem['@metadata'].checksum}, product_price: trim(newPrice)});
	makeCall("PUT", lineitem['@metadata'].href, data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Change a line item from one product to another product
function updateProduct(lineitemId, newProductNum) {
	var lineitem = currentLineitems[lineitemId];
	var data = JSON.stringify({lineitem_id: lineitemId, 
		'@metadata': {checksum: lineitem['@metadata'].checksum}, product_number: newProductNum});
	makeCall("PUT", lineitem['@metadata'].href, data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Create a new line item
function createLineitem(orderId) {
	var data = JSON.stringify({product_number:1, order_number: orderId, qty_ordered: 1});
	makeCall("POST", "OneCustomer.Orders.Lineitems/", data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Delete a line item
function deleteLineitem(lineitemId) {
	if ( ! confirm('Delete this line item?'))
		return;
	var lineitem = currentLineitems[lineitemId];
	var data = JSON.stringify({lineitem_id: lineitemId});
	makeCall("DELETE", lineitem['@metadata'].href, data, {checksum: lineitem['@metadata'].checksum}, true, function(response) {
		refreshAfterUpdate(response);
	});
}

//////////////////////////////////////////////////////
// Based on the transaction summary received after any insert/update/delete, refresh
// whatever needs refreshing on the page.
function refreshAfterUpdate(response) {
	var data = response.txsummary;
	if ( ! data)
		return;
	for (var i = 0; i < data.length; i++) {
		var obj = data[i];
		var objType = obj['@metadata'].resource;
		if (objType == "OneCustomer" && obj.customer_ident == currentCustomer.customer_ident) {
			if (currentCustomer.balance != obj.balance)
				allChanges.push('custBalanceTd');
			currentCustomer.balance = obj.balance;
			currentCustomer.credit_limit = obj.credit_limit;
			currentCustomer['@metadata'].checksum = obj['@metadata'].checksum;
			refreshCustomerWithData();
		}
		else if (objType == "OneCustomer.Orders") {
			if (obj['@metadata'].verb == "DELETE") {
				currentCustomer.Orders.splice(getOrderIndex(obj), 1);
				$('#orderRow' + obj.order_number).remove();
			}
			else if (obj['@metadata'].verb == "UPDATE") {
				if (obj.customer_ident != currentCustomer.customer_ident) { // Reassigned order
					var orderIdx = getOrderIndex(obj);
					if (orderIdx != -1)
						currentCustomer.Orders.splice(orderIdx, 1);
					$('#orderRow' + obj.order_number).remove();
				}
				else {
					// Swap in the new values for the updated order and refresh
					for (var j = 0; j < currentCustomer.Orders.length; j++) {
						if (currentCustomer.Orders[j].order_number == obj.order_number) {
							if (currentCustomer.Orders[j].amount_total != obj.amount_total)
								allChanges.push('amountTotal' + currentCustomer.Orders[j].order_number);
							currentCustomer.Orders[j].amount_total = obj.amount_total;
							currentCustomer.Orders[j].paid = obj.paid;
							currentCustomer.Orders[j].notes = obj.notes;
							currentCustomer.Orders[j].customer_ident = obj.customer_ident;
							currentCustomer.Orders[j]['@metadata'].checksum = obj['@metadata'].checksum;
							break;
						}
					}
					refreshOrderWithData(obj);
				}
			}
			else if (obj['@metadata'].verb == "INSERT") {
				currentCustomer.Orders.push(obj);
				obj.getReassignCustomerSelect = (function() {
					var orderNum = obj.order_number;
					return function() { return getReassignCustomerSelect(orderNum); };
				})();
				var html = templates.orderTemplate(obj);
				$('#ordersTable').prepend(html);
			}
		}
		else if (objType == "OneCustomer.Orders.Lineitems") {
			if (obj['@metadata'].verb == "DELETE") {
				delete currentLineitems[obj.lineitem_id];
				$('#lineitemRow' + obj.lineitem_id).remove();
			}
			else if (obj['@metadata'].verb == "UPDATE") {
				if (currentLineitems[obj.lineitem_id].amount != obj.amount)
					allChanges.push('amount' + obj.lineitem_id);
				if (currentLineitems[obj.lineitem_id].product_price != obj.product_price)
					allChanges.push('productPrice' + obj.lineitem_id);
				currentLineitems[obj.lineitem_id] = obj;
				refreshLineitemWithData(obj);
			}
			else if (obj['@metadata'].verb == "INSERT") {
				currentLineitems[obj.lineitem_id] = obj;
				obj.getProductSelect = function(){return getProductSelect(obj.lineitem_id, obj.product_number);};
				var html = templates.lineitemTemplate(obj);
				$('#itemsForOrder' + obj.order_number).prepend(html);
				allChanges.push('amount' + obj.lineitem_id);
				allChanges.push('productPrice' + obj.lineitem_id);
			}
		}
	}
	
	// We have to set up the tooltips every time because the templates may have created
	// some new rows.
	destroyTooltip();
	setupTooltip();
	highlightChanges();
	
	
	/// Show the logic summary if it was in the response
	var logic = response.rulesummary;
	if (logic) {		
		Kahuna.LogicPlan.displayLogic('#eventsTree', logic, function(evt){
			if (evt)
				$('#eventDetails').html("<b>Details</b>: " + Kahuna.LogicPlan.formatEvent(evt));
			else
				$('#eventDetails').html("Select a node in the tree");
		});
		$('#eventDetails').html("Select a node in the tree");
		$('#txSummary').show();
	}
	else {
		$('#txSummary').hide();
	}
}

// A simple function to check whether an input is a valid number.
function isNumber(str) {
	if (str.length == 0)
		return false;

	str = trim(str);
	numdecs = 0; // Number of decimal points -- should be max 1, obviously
	for (var i = 0; i < str.length; i++) {
		mychar = str.charAt(i);
		if ((mychar >= "0" && mychar <= "9") || mychar == "." || mychar == "$" || mychar == ",") {
			if (mychar == ".")
				numdecs++;
		}
		else 
			return false;
	}
	if (numdecs > 1) {
		return false;
	}
	return true;
}

// Given a string, return the same string, stripped of any leading or trailing blank characters (space, tab, etc)
function trim(str) {
	return ("" + str).replace(/^\s+|\s+$/gm, '');
}

///////////////////////////////////////////////////////////////////
// Deal with Mustache templates and other mundate things

var templates = {};

// See whether the browser supports CORS
function checkCorsSupport() {
	var xhr = new XMLHttpRequest();
	if ("withCredentials" in xhr)
		return true;
	else if (typeof XDomainRequest != "undefined")
		return true;
	else
		return false;
}

var qtipApi = null;

// This gets executed by jQuery as soon as the page is loaded and ready.
$(function () {
	
	if ( ! checkCorsSupport()) {
		alert("This browser does not support Cross-Origin Resource Sharing (CORS) and therefore " +
				"cannot run this application. We suggest using a modern browser such as Firefox or Chrome.");
		return;
	}
	
	// Load the Mustache templates, which are stored in the page as scripts
	var scripts = document.getElementsByTagName('script');
	var trash = [];
	$.each(scripts, function(index, script) {
		if (script && script.innerHTML && script.id && script.type === "text/html") {
			templates[script.id] = Handlebars.compile(script.innerHTML);
			trash.unshift(script);
		}
	});
	// And remove the templates from the document
	for (i = 0, l = trash.length; i < l; i++) {
		trash[i].parentNode.removeChild(trash[i]);
	}
 
	// Set the default for all Ajax calls
	$.ajaxSetup({
		contentType: "application/json"
	});

	loadCustomerList();
});

function setupTooltip() {
	$(".ttBottom").tooltip({
		placement: 'bottom'
	});

	$(".ttTop").tooltip({
		placement: 'top'
	});
}

function destroyTooltip() {
	$(".ttBottom").tooltip("destroy");
	$(".ttTop").tooltip("destroy");
}

var tooltipHide = [];
var allChanges = [];
function highlightChanges() {
	// If we have to highlight changes before the previous highlights have
	// timed out, we time them out immediately before highlighting anything else.
	for (var k = 0; k < tooltipHide.length; k++) {
		clearTimeout(tooltipHide[k].timeoutId);
		tooltipHide[k].f();
	}
	tooltipHide = [];
	for (var j = 0; j < allChanges.length; j++) {
		$("#" + allChanges[j]).css("background-color", "#AAFFAA");
		$("#" + allChanges[j]).tooltip("show");
		(function(){
			var id = "#" + allChanges[j];
			var hideEntry = {id: id};
			hideEntry.f = function() {
				//console.log("Hiding tooltips now");
				$(id).css("background-color", "");
				$(id).tooltip("hide");
				for (var m = 0; m < tooltipHide.length; m++) {
					if (tooltipHide[m].id == id) {
						tooltipHide.splice(m, 1);
						break;
					}
				}
			};
			hideEntry.timeoutId = setTimeout(hideEntry.f, 5000);
			tooltipHide.push(hideEntry);
		})();
	}
	allChanges = [];
}

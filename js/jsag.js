/**
 * Usage:
 *
 *  * JSAG.create_form(node,id,schema,data);
 *  	Will insert a form based on the schema defaulted with the data
 *  @param {node} node: reference to a node element which will contain the generated <FORM>
 *      Note that all existing contents of the node element will be erased
 *  @param {string} id: ID property of the generated form.
 *  @param {Object} schema: object containing the JSONschema describing the form structure.
 *  @param {Object=} data: object containing the current data content of the form (optional).
 *      It is highly recommended to NOT communicate clear content of password fields (replace with genetic values as ****)
 */

;JSAG = {

	SIMPLE_TYPES: ['string','password','choices','integer','hostname','boolean','file','email'],
	SCHEMA: {},
	VALUES: {},

	getType: function (input_schema,path)
	{
		if (typeof(path) === "undefined")
			path = [];
		configParser = input_schema;
		if (path.length > 0)
		{
			$.each(path,function(index,level)
			{
				if (level === parseInt(level,10))
					configParser = configParser["items"]; 
				else
					configParser = configParser["properties"][level];
			});
		}

		if ('type' in configParser)
			return configParser['type'];
		if ('format' in configParser)
			return configParser['format'];
		if ('$def' in configParser)
		{
			defRegex = /^#\/def\/(\w+)/i;
			myType = defRegex.exec(configParser['$def']);
			if (myType)
			{
				return myType[1];
		 	}
			else
			{
				defRegex = /^#\/choices\/(\w+)$/i;
				myType = defRegex.exec(configParser['$def']);
				if (myType)
					return "choices";
			}
		}
		return "";
	},


	form_generate: function (id,schema,required,config,str_format,level)
	{
		if (typeof(required) === "undefined")
			required = false
		if (typeof(str_format) === "undefined")
			str_format = '%s: '
		if (typeof(level) === "undefined")
			level = 0;

		myDefault = (typeof(config) === "undefined") ? (('default' in schema) ? schema['default'] : '') : config;

		var node;
		if (JSAG.getType(schema)=='object')
		{
			node = $("<fieldset>")
					.attr('id',id)
					.append($("<legend>").html(str_format.replace('%s',schema['title'])));
			sortedItems = [];
			$.each(schema['properties'],function(index,item)
			{
				sortedItems.push({'id':index,'order':item['order'],'item':item});
			});

			sortedItems = sortedItems.sort(function (a, b) {
				if (!('order' in a)) a['order'] = 0;
				if (!('order' in b)) b['order'] = 0;
			
				return a['order']> b['order'] ;
			});

			map = [];
			$.each(sortedItems,function(index,item)
			{
				item_id = JSAG.full_id(id,item['id']);
				required = ('required' in schema && schema['required'].indexOf(item['id'])> -1);
				value = (typeof(config) !== "undefined" && item['id'] in config) ? config[item['id']] : undefined;

				nodeItem = JSAG.form_generate(item_id,item['item'],required,value,'%s',level+1);
				node.append(nodeItem);
				map[item['id']] = item_id;
			});
			return node;
		}
		else if (JSAG.getType(schema) == 'array')
		{
			node = $("<fieldset>")
					.attr('id',id)
					.append($("<legend>").html(str_format.replace('%s',schema['title'])));
			newNode = $('<a href></a>')
						.html('Add %s'.replace('%s',schema['title']))
						.attr('id','new_' + id)
						.addClass('new')
						.on('click',function(event) {
							event.preventDefault();
							defRegex = /^(.*)_([0-9]+)$/i;
							myID = defRegex.exec($('#'+event.target.id).prev()[0].id);
							JSAG.updateValuesCache(event.target.closest('form'));
							JSAG.getFromJSON(JSAG.VALUES,id).push(
								JSAG.getFromJSON(
										$('<form>')
										.append(JSAG.form_generate(id + '_',schema['items'],true,undefined,'Add %s',level+1))
										.serializeObject()
									,id+'_0')
								);
							JSAG.updateForms();
						});
			node.append(newNode);
			return node;
		}
		else if (JSAG.getType(schema) == 'password')
		{
			node = $("<div>")
					.append($("<label>")
						.html(str_format.replace('%s',schema['title']))
						.addClass('nv'+level)
						.attr('for',id)
						)
					.append($("<input>")
						.attr("type","password")
						.attr("placeholder",schema['placeholder'])
						.attr("name",JSAG.idToName(id))
						.attr("id",id)
						.prop("required",required));
			return node;
		}
		else if (JSAG.getType(schema) == 'integer')
		{
			inputNode = $("<input>")
						.attr("type","number")
						.attr("placeholder",schema['placeholder'])
						.attr("name",JSAG.idToName(id))
						.attr("id",id)
						.prop("required",required);
			if ('minimum' in schema)
				inputNode.attr("min",('exclusiveMinimum' in schema && schema['exclusiveMinimum']) ? parseInt(schema['minimum']) + 1 : schema['minimum']);
			
			if ('maximum' in schema)
				inputNode.attr("max",('exclusiveMaximum' in schema && schema['exclusiveMaximum']) ? parseInt(schema['maximum']) - 1 : schema['maximum']);
	
	
			node = $("<div>")
					.append($("<label>").html(str_format.replace('%s',schema['title']))
						.addClass('nv'+level)
						.attr('for',id)
						)
					.append(inputNode);
			return node;
		}
		else if (JSAG.getType(schema) == 'email')
		{
			node = $("<div>")
					.append($("<label>").html(str_format.replace('%s',schema['title']))
						.addClass('nv'+level)
						.attr('for',id)
						)
					.append($("<input>")
						.attr("type","email")
						.attr("placeholder",schema['placeholder'])
						.attr("name",JSAG.idToName(id))
						.attr("id",id)
						.prop("required",required));
			return node;
		}
		else if (JSAG.getType(schema) == 'boolean')
		{
			nodeSelect = $("<input>")
						.attr('type','checkbox')
						.attr("name",JSAG.idToName(id))
						.attr("id",id);

			node = $("<div>")
					.append($("<label>").html(str_format.replace('%s',schema['title']))
						.addClass('nv'+level)
						.attr('for',id)
						)
					.append(nodeSelect);
			return node;
		}
		else if (JSAG.getType(schema) == 'choices')
		{
			nodeSelect = $("<select>")
						.attr("name",JSAG.idToName(id))
						.attr("id",id)
						.prop("required",required);
					
			nodeSelect.append($("<option>")
						.attr("value","")
						.html(schema['description'])
						);

			defRegex = /^#\/choices\/(\w+)/i;
			myType = defRegex.exec(schema['$def']);
			if (myType)
			{
				choices = schema['choices'][myType[1]];
				$.each(choices,function(key,value) {
					nodeSelect.append($("<option>")
								.attr("value",key)
								.html(value)
								);
				});
			}
			node = $("<div>")
					.append($("<label>").html(str_format.replace('%s',schema['title']))
						.addClass('nv'+level)
						.attr('for',id)
						)
					.append(nodeSelect);
			return node;
		}
		else if (JSAG.SIMPLE_TYPES.indexOf(JSAG.getType(schema))>-1)
		{
			node = $("<div>")
					.append($("<label>").html(str_format.replace('%s',schema['title']))
						.addClass('nv'+level)
						.attr('for',id)
						)
					.append($("<input>")
						.attr("name",JSAG.idToName(id))
						.attr("id",id)
						.attr("placeholder",schema['placeholder'])
						.prop("required",required));
			return node
		}
	},

	form_setValue: function (id,schema,config,level)
	{
		if (typeof(level) === "undefined")
			level = 0;

		myDefault = (typeof(config) === "undefined") ? (('default' in schema) ? schema['default'] : '') : config;

		var node;
		if (JSAG.getType(schema)=='object')
		{
			sortedItems = [];
			$.each(schema['properties'],function(index,item)
			{
				sortedItems.push({'id':index,'order':item['order'],'item':item});
			});

			sortedItems = sortedItems.sort(function (a, b) {
				if (!('order' in a)) a['order'] = 0;
				if (!('order' in b)) b['order'] = 0;
			
				return a['order']> b['order'] ;
			});

			$.each(sortedItems,function(index,item)
			{
				item_id = JSAG.full_id(id,item['id']);
				value = (typeof(config) !== "undefined" && item['id'] in config) ? config[item['id']] : undefined;

				JSAG.form_setValue(item_id,item['item'],value,level+1);
			});
		}
		else if (JSAG.getType(schema) == 'array')
		{
			$('#' + id +'>:not(.new):not(legend)').remove();
			if (config != undefined)
			{
				node = $('#' + id +'>.new');
				$.each(config,function(index,item) {
					node.before(
						JSAG.form_generate(id + '_' + index,schema['items'],true,item,'%s '+(index+1),level+1)
							.append($('<input>')
								.attr('type','button')
								.attr('value','Delete')
								.on('click',function(event) {
										$('#'+id + '_' + index).parent().remove();
										JSAG.updateValuesCache(event.target.closest('form'));
										JSAG.updateForms();
									})
							)
					);
				});
		
				$.each(config,function(index,item) {
					JSAG.form_setValue(id + '_' + (index),schema['items'],item,level+1);
				});
			}
		}
		else if (JSAG.getType(schema) == 'password')
		{
			$('#' + id ).val(myDefault);
		}
		else if (JSAG.getType(schema) == 'integer')
		{
			$('#' + id ).val(myDefault);
		}
		else if (JSAG.getType(schema) == 'email')
		{
			$('#' + id ).val(myDefault);
		}
		else if (JSAG.getType(schema) == 'boolean')
		{
			nodeSelect = $('#' + id );
			nodeSelect.prop("checked",myDefault);
		}
		else if (JSAG.getType(schema) == 'choices')
		{
			nodeSelect = $('#' + id );
			nodeSelect.val(myDefault);
		}
		else if (JSAG.SIMPLE_TYPES.indexOf(JSAG.getType(schema))>-1)
		{
			$('#' + id ).val(myDefault);
		}
	},

	create_events: function(id,schema,config)
	{
		var max_left;
		var cut_left;
		if (JSAG.getType(schema)=='object')
		{
			max_left = 0;
			sortedItems = [];
			$.each(schema['properties'],function(index,item)
			{
				sortedItems.push({'id':index,'order':item['order'],'item':item});
			});

			sortedItems = sortedItems.sort(function (a, b) {
				if (!('order' in a)) a['order'] = 0;
				if (!('order' in b)) b['order'] = 0;
			
				return a['order']> b['order'] ;
			});

			map = [];
			$.each(sortedItems,function(index,item)
			{
				value = (typeof(config) !== "undefined" && item['id'] in config) ? config[item['id']] : undefined;
				item_id = JSAG.full_id(id,item['id']);
				cur_left = JSAG.create_events(item_id,item['item'],value);
				max_left = (max_left < cur_left) ? cur_left : max_left;
				map[item['id']] = item_id;
			});

			if ("conditions" in schema)
			{
				$.each(schema['conditions'],function(key,val) 										  
				{
					myevent = Object.create(val);
					myevent['if_val'] = val['if_val'].slice(0);
					index = myevent['if_val'].indexOf(null)
					if (index!=-1)
					{
						myevent['if_val'][index] = "";
					}
					myevent['map'] = map;
					myevent['if_prop'] = JSAG.full_id(id,myevent['if_prop']);
					myevent['then_prop'] = JSAG.full_id(id,myevent['then_prop']);
					$('#'+myevent['if_prop']).on("change",myevent,JSAG.show_hide);
					JSAG.show_hide({"data":myevent});
				});
			}
			return max_left;
		}
		else if (JSAG.getType(schema) == 'array')
		{
			max_left = 0;
			if (config != undefined)
			{
				$.each(config,function(index,item) {
					cur_left = JSAG.create_events(id + '_' + (index),schema['items'],item);
					max_left = (max_left < cur_left) ? cur_left : max_left;
				});
			}
		}
		else
		{
			return $('#'+id).offset()['left'];
		}
	},

	create_form: function (node,id,schema,config)
	{
		if (typeof(config) === 'undefined')
			config = {};
		node.html('');
		formNode = $("<form>")
				.append(JSAG.form_generate(id,schema,false,config))
				.append($('<input>')
					.attr('type','submit')
					.attr('id',id + '_submit')
					);
		node.append(formNode);
		JSAG.SCHEMA[id] = schema;
		if (jQuery.isEmptyObject(config))
		{
			if (JSAG.getType(schema) == 'object')
				JSAG.VALUES[id] = {};
			else if (JSAG.getType(schema) == 'array')
				JSAG.VALUES[id] = [];
			else
				JSAG.VALUES[id] = '';
		}
		else
		{
			JSAG.VALUES[id] = config;
		}
		
		JSAG.updateForms();
		
		return formNode;
	},
	
	updateValuesCache: function(form)
	{
		JSAG.VALUES = $(form).serializeObject();
	},
	
	updateForms: function()
	{
		for (key in JSAG.VALUES)
		{
			JSAG.form_setValue(key,JSAG.SCHEMA[key],JSAG.VALUES[key]);
			JSAG.create_events(key,JSAG.SCHEMA[key],JSAG.VALUES[key]);
			JSAG.align_values(JSAG.SCHEMA[key],JSAG.VALUES[key]);
		}
	},
	
	show_hide: function(event)
	{
		var if_field = $('#'+event.data['if_prop'])[0];
		value = if_field.type == 'checkbox' ? if_field.checked : if_field.value;
	
		if(event.data['if_val'].indexOf(value)>-1)
		{
			$('#'+event.data['then_prop']).hide();
			$('#'+event.data['then_prop'] + " *[required]").addClass("hidden_required_field");
			$('#'+event.data['then_prop'] + " .hidden_required_field").prop('required',false);
		} else
		{
			$('#'+event.data['then_prop'] + " .hidden_required_field").prop('required',true);
			$('#'+event.data['then_prop'] + " .hidden_required_field").removeClass("hidden_required_field");
			$('#'+event.data['then_prop']).show();
		}
	},

	align_values: function (schema,config)
	{
		var maxLabelNv = Array(9);
		for(var i = 1 ; i < 10 ; i++)
			$("label.nv" + i.toString()).css('width','auto');
		var maxInput = JSAG.maxLeft("input,select");
		for(var i = 1 ; i < 10 ; i++)
			maxLabelNv[i] = JSAG.maxLeft("label.nv" + i.toString());
		$("label").css('display','inline-block');
		for(var i = 1 ; i < 10 ; i++)
			$("label.nv" + i.toString()).css('width',maxInput-maxLabelNv[i]+10);
	},

	maxLeft: function (selector)
	{
		return Math.max.apply(null, $(selector).map(function ()
		{
			return $(this).offset()['left'];
		}).get());
	},

	full_id: function (path,id)
	{
		return path + ((path.length>0) ? "_" + id : id)
	},
	
	idToName: function(myString) 
	{
		while(myString!=myString.replace(new RegExp("^([^_]+)_([^_]*)(.*)$"),"$1[$2]$3")) 
			myString=myString.replace(new RegExp("^([^_]+)_([^_]*)(.*)$"),"$1[$2]$3");
		return myString 
	},
	
	getFromJSON: function(json,myString) 
	{
		regex_str = "^([^_]+)_(.*)$";
	
		result = json;
		var reg = myString.match(new RegExp(regex_str));
		while(reg) 
		{
			myString=myString.replace(new RegExp(regex_str),"$2");
			result = result[reg[1]];
			reg = myString.match(new RegExp(regex_str));
		}
		if (!(myString in result))
			result[myString] = []
		return result[myString];
	}
};
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

define([
  "app",

  "api",
  "addons/fauxton/components",
  "addons/documents/resources",
  "addons/databases/resources",

  //Views
  "addons/documents/views-sidebar",
  "addons/documents/views-advancedopts",
  // Libs
  "addons/fauxton/resizeColumns",
  //plugins
  "plugins/prettify"
],

function(app, FauxtonAPI, Components, Documents, Databases, Views, QueryOptions,
         resizeColumns, prettify) {

  function showError (msg) {
    FauxtonAPI.addNotification({
      msg: msg,
      type: 'error',
      clear:  true
    });
  }

  Views.RightAllDocsHeader = FauxtonAPI.View.extend({
    className: "header-right",
    template: "addons/documents/templates/header_alldocs",
    events: {
      'click .toggle-select-menu': 'selectAllMenu',
      'click .all': 'toggleSelectAllDocs',
      'click #collapse': 'collapse',
      'click .js-bulk-delete': 'initBulkDelete'
    },

    initialize: function(options){
      //adding the database to the object
      this.database = options.database;
      this.selectVisible = false;
      this.selectAllDocs = false;
      FauxtonAPI.Events.on('advancedOptions:updateView', this.updateAllDocs, this);
      FauxtonAPI.Events.on('documents:success-bulk-delete', this.selectAllMenu, this);
      FauxtonAPI.Events.on('documents:toggle-trash', this.toggleTrash, this);
    },

    cleanup:function(){
      FauxtonAPI.Events.unbind('advancedOptions:updateView');
      FauxtonAPI.Events.unbind('success:bulkDelete');
    },

    collapse: function (event) {
      event.preventDefault();
      FauxtonAPI.Events.trigger('documents:collapse');
    },

    toggleTrash: function (show) {
      if (show) {
        this.$('.js-bulk-delete').removeClass('disabled');
      } else {
        this.$('.js-bulk-delete').addClass('disabled');
      }
    },
    
    toggleSelectAllDocs: function (event) {
      event.preventDefault();
      this.selectAllDocs = !this.selectAllDocs;
      FauxtonAPI.Events.trigger('documents:select-all-docs', this.selectAllDocs);
    },

    initBulkDelete: function (event) {
      event.preventDefault();
      FauxtonAPI.Events.trigger('documents:bulk-delete');
    },

    selectAllMenu: function(event){
      event.preventDefault();
      var $selectOptions = $('#select-options'),
          visible = !$selectOptions.is(':visible');

      $selectOptions.toggle('fast');
      FauxtonAPI.Events.trigger("documents:show-select-all", visible);
    },

    addAllDocsMenu: function(){
      //search docs
      this.headerSearch = this.insertView("#header-search", new Views.JumpToDoc({
        database: this.database,
        collection: this.database.allDocs
      }));
      //insert queryoptions
      //that file is included in require() above and the argument is QueryOptions
      // and it wants all these params:
      /* Sooooo I searched this file for where Advanced options was originally inserted to see what the hell
         is happening.  and it's in AllDocsLayout.  So I'm going to move some of those functions over here

        These are required:
        this.database = options.database;
        this.updateViewFn = options.updateViewFn;
        this.previewFn = options.previewFn;

        these are booleans:
        this.showStale = _.isUndefined(options.showStale) ? false : options.showStale;
        this.hasReduce = _.isUndefined(options.hasReduce) ? true : options.hasReduce;

        these you only need for view indexes, not all docs because they are about
        specific views and design docs (ddocs, also views live inside a ddoc):
        this.viewName = options.viewName;
        this.ddocName = options.ddocName;
      */

      /*this.queryOptions = this.insertView("#query-options", new QueryOptions.AdvancedOptions({
        database: this.database,
        hasReduce: false,
        showPreview: false,
      }));*/

      //Moved the apibar view into the components file so you can include it in your views
      this.apiBar = this.insertView("#header-api-bar", new Components.ApiBar({}));
    },

    updateApiUrl: function(api){
      //this will update the api bar when the route changes
      //you can find the method that updates it in components.js Components.ApiBar()
      this.apiBar && this.apiBar.update(api);
    },

    serialize: function() {
      //basically if you want something in a template, You can define it here
      return {
        database: this.database.get('id')
      };
    },

    beforeRender:function(){
      this.addAllDocsMenu();
    },

    //moved from alldocs layout
    updateAllDocs: function (event, paramInfo) {
      event.preventDefault();

      var errorParams = paramInfo.errorParams,
          params = paramInfo.params;

      if (_.any(errorParams)) {
        _.map(errorParams, function(param) {
          return FauxtonAPI.addNotification({
            msg: "JSON Parse Error on field: "+param.name,
            type: "error",
            clear:  true
          });
        });
        FauxtonAPI.addNotification({
          msg: "Make sure that strings are properly quoted and any other values are valid JSON structures",
          type: "warning",
          clear:  true
        });

        return false;
      }

      var fragment = window.location.hash.replace(/\?.*$/, '');

      if (!_.isEmpty(params)) {
        fragment = fragment + '?' + $.param(params);
      }

      FauxtonAPI.navigate(fragment, {trigger: false});
      FauxtonAPI.triggerRouteEvent('updateAllDocs', {allDocs: true});
    }
  });

  Views.DeleteDBModal = Components.ModalView.extend({
    template: "addons/documents/templates/delete_database_modal",

    events: {
      "click #delete-db-btn": "deleteDatabase",
      "submit #delete-db-check": "deleteDatabase"
    },

    deleteDatabase: function (event) {
      event.preventDefault();
      var enterredName = this.$('#db_name')[0].value;
      if (this.database.id != enterredName) {
        this.set_error_msg(enterredName + " does not match database id - are you sure you want to delete " + this.database.id + "?");
        return;
      }
      this.hideModal();
      var databaseName = this.database.id;
      FauxtonAPI.addNotification({
        msg: "Deleting your database...",
        type: "error",
        clear: true
      });

      this.database.destroy().then(function () {
        FauxtonAPI.navigate('#/_all_dbs');
        FauxtonAPI.addNotification({
          msg: 'The database <code>' + _.escape(databaseName) + '</code> has been deleted.',
          clear: true,
          escape: false // beware of possible XSS when the message changes
        });
      }).fail(function (rsp, error, msg) {
        FauxtonAPI.addNotification({
          msg: 'Could not delete the database, reason ' + msg + '.',
          type: 'error',
          clear: true
        });
      });
    }
  });

  Views.Document = FauxtonAPI.View.extend({
    template: "addons/documents/templates/all_docs_item",
    className: "all-docs-item doc-row",

    initialize: function (options) {
      this.checked = options.checked;
      this.expanded = options.expanded;
      this.showSelect = false;
      this.expanded = true;

      FauxtonAPI.Events.on("documents:show-select-all", this.showSelectBox, this);
      FauxtonAPI.Events.on("documents:collapse", this.collapse, this);
      FauxtonAPI.Events.on("documents:select-all-docs", this.selectAll, this);
    },

    cleanup: function(){
      FauxtonAPI.Events.unbind("documents:show-select-all");
      FauxtonAPI.Events.unbind("documents:collapse");
      FauxtonAPI.Events.unbind("documents:select-all-docs");
    },

    showSelectBox: function(bool){
      this.$el.toggleClass('showSelect');
    },

    selectAll: function(checked){
      this.$("input:checkbox").prop('checked', checked);
      this.toggleSelect();
    },

    collapse: function(){
      this.expanded = !this.expanded;
      this.$('.doc-data').toggle(this.expanded);
    },

    events: {
      "click button.delete": "destroy",
      "dblclick pre.prettyprint": "edit",
      "click .js-row-select": "toggleSelect"
    },

    toggleSelect: function (event) {
      var selected = this.$('input').prop('checked'), 
          doc = {
            _id: this.model.id,
            _rev: this.model.get('_rev')
          };

      FauxtonAPI.Events.trigger('documents:selected-doc', selected, doc);
    },

    serialize: function() {
      return {
        docID: this.model.id,
        doc: this.model,
        checked: this.checked,
        url: this.model.url('web-index')
      };
    },

    establish: function() {
      return [this.model.fetch()];
    },

    edit: function(event) {
      event.preventDefault();
      FauxtonAPI.navigate("#" + this.model.url('web-index'));
    },

    destroy: function(event) {
      event.preventDefault();
      var that = this;

      if (!window.confirm("Are you sure you want to delete this doc?")) {
        return false;
      }

      var storeID = this.model.id;

      this.model.destroy().then(function(resp) {
        FauxtonAPI.addNotification({
          msg: "Doc " + storeID + " has been deleted.",
          type: "error",
          clear:  true
        });
        that.$el.fadeOut(function () {
          that.remove();
        });

        that.model.collection.remove(storeID);
        if (!!storeID.match('_design')) {
          FauxtonAPI.triggerRouteEvent('reloadDesignDocs');
        }
      }, function(resp) {
        FauxtonAPI.addNotification({
          msg: "Failed to deleted your doc!",
          type: "error",
          clear:  true
        });
      });
    }
  });

  Views.Row = FauxtonAPI.View.extend({
    template: "addons/documents/templates/all_docs_item",
    className: 'all-docs-item doc-row',

    events: {
      "click button.delete": "destroy"
    },

    destroy: function (event) {
      event.preventDefault();

      window.alert('Cannot delete a document generated from a view.');
    },

    serialize: function() {
      return {
        doc: this.model,
        url: this.model.url('app'),
        checked: false,
        docID: this.model.get('id')
      };
    }
  });


  Views.AllDocsNumber = FauxtonAPI.View.extend({
    template: "addons/documents/templates/all_docs_number",

    initialize: function (options) {
      this.newView = options.newView || false;
      this.pagination = options.pagination;
      _.bindAll(this);

      this._perPage = options.perPageDefault || 20;
      this.listenTo(this.collection, 'totalRows:decrement', this.render);
    },

    events: {
      'change #select-per-page': 'updatePerPage'
    },

    updatePerPage: function (event) {
      this._perPage = parseInt(this.$('#select-per-page :selected').val(), 10);
      this.pagination.updatePerPage(this.perPage());
      FauxtonAPI.triggerRouteEvent('perPageChange', this.pagination.documentsLeftToFetch());
    },

    afterRender: function () {
      this.$('option[value="' + this.perPage() + '"]').attr('selected', "selected");
    },

    serialize: function () {
       var totalRows = 0,
          updateSeq = false,
          pageStart = 0,
          pageEnd = 20;

      if (!this.newView) {
        totalRows = this.collection.length;
        updateSeq = this.collection.updateSeq();
      }

      if (this.pagination) {
        pageStart = this.pagination.pageStart();
        pageEnd =  this.pagination.pageEnd();
      }

      return {
        database: app.utils.safeURLName(this.collection.database.id),
        updateSeq: updateSeq,
        totalRows: totalRows,
        pageStart: pageStart,
        pageEnd: pageEnd
      };
    },

    perPage: function () {
      return this._perPage;
    },

    setCollection: function (collection) {
      this.collection = collection;
    }

  });

  Views.AllDocsLayout = FauxtonAPI.View.extend({
    template: "addons/documents/templates/all_docs_layout",

    initialize: function (options) {
      this.database = options.database;
      this.params = options.params;
    },

    events: {
      'click #toggle-query': "toggleQuery"
    },

    toggleQuery: function (event) {
      $('#dashboard-content').scrollTop(0);
      this.$('#query').toggle('slow');
    },

    beforeRender: function () {
      this.advancedOptions = this.insertView('#query', new QueryOptions.AdvancedOptions({
        updateViewFn: this.updateAllDocs,
        previewFn: this.previewView,
        hasReduce: false,
        showPreview: false,
        database: this.database,
      }));

      //disable for now. Will enable with new documents PR that will come next
      /*this.toolsView = this.setView(".js-search", new Views.JumpToDoc({
        database: this.database,
        collection: this.database.allDocs
        }));*/
    },

    afterRender: function () {
      if (this.params) {
        this.advancedOptions.updateFromParams(this.params);
      }
    },

    updateAllDocs: function (event, paramInfo) {
      event.preventDefault();

      var errorParams = paramInfo.errorParams,
          params = paramInfo.params;

      if (_.any(errorParams)) {
        _.map(errorParams, function(param) {

          // TODO: Where to add this error?
          // bootstrap wants the error on a control-group div, but we're not using that
          //$('form.view-query-update input[name='+param+'], form.view-query-update select[name='+param+']').addClass('error');
          return FauxtonAPI.addNotification({
            msg: "JSON Parse Error on field: "+param.name,
            type: "error",
            selector: ".advanced-options .errors-container",
            clear:  true
          });
        });
        FauxtonAPI.addNotification({
          msg: "Make sure that strings are properly quoted and any other values are valid JSON structures",
          type: "warning",
          selector: ".advanced-options .errors-container",
          clear:  true
        });

        return false;
      }

      var fragment = window.location.hash.replace(/\?.*$/, '');

      if (!_.isEmpty(params)) {
        fragment = fragment + '?' + $.param(params);
      }

      FauxtonAPI.navigate(fragment, {trigger: false});
      FauxtonAPI.triggerRouteEvent('updateAllDocs', {allDocs: true});
    },

    previewView: function (event) {
      event.preventDefault();
    }

  });

  Views.AllDocsList = FauxtonAPI.View.extend({
    template: "addons/documents/templates/all_docs_list",
    events: {
      "click #js-end-results": "scrollToQuery"
    },

    initialize: function (options) {
      this.nestedView = options.nestedView || Views.Document;
      this.rows = {};
      this.viewList = !!options.viewList;

      if (options.ddocInfo) {
        this.designDocs = options.ddocInfo.designDocs;
        this.ddocID = options.ddocInfo.id;
      }
      this.newView = options.newView || false;
      this.docParams = options.docParams || {};
      this.params = options.params || {};
      this.expandDocs = true;
      this.perPageDefault = this.docParams.limit || 20;

      // some doclists don't have an option to delete
      if (!this.viewList) {
        this.bulkDeleteDocsCollection = options.bulkDeleteDocsCollection;
      }

      FauxtonAPI.Events.on('documents:selected-doc', this.toggleDocument, this);
      FauxtonAPI.Events.on('documents:bulk-delete', this.bulkDelete, this);
    },

    removeDocuments: function (ids) {
      _.each(ids, function (id) {
        this.removeDocument(id);
      }, this);

      this.pagination.updatePerPage(parseInt(this.$('#select-per-page :selected').val(), 10));
      FauxtonAPI.triggerRouteEvent('perPageChange', this.pagination.documentsLeftToFetch());
    },

    removeDocument: function (id) {
      var view = this.rows[id];

      if (!view) {
        return;
      }

      view.$el.fadeOut('slow', function () {
        view.remove();
      });
    },

    showError: function (ids) {
      if (ids) {
        showError('Failed to delete: ' + ids.join(', '));
        return;
      }

      showError('Failed to delete your doc!');
    },

    toggleDocument: function (selected, doc) {
      var docId = doc._id;

      if (selected) {
        doc._deleted = true;
        this.bulkDeleteDocsCollection.add(doc);
      } else {
        this.bulkDeleteDocsCollection.remove(this.bulkDeleteDocsCollection.get(docId));
      }

      this.toggleTrash();
    },

    toggleTrash: function () {
      if (this.bulkDeleteDocsCollection && this.bulkDeleteDocsCollection.length > 0) {
        FauxtonAPI.Events.trigger('documents:toggle-trash', true);
      } else {
        FauxtonAPI.Events.trigger('documents:toggle-trash', false);
      }
    },

    scrollToQuery: function () {
      $('#dashboard-content').animate({ scrollTop: 0 }, 'slow');
    },

    establish: function() {
      if (this.newView) { return null; }

      return this.collection.fetch({
        reset: true,
        success:  function() { },
        error: function(model, xhr, options){
          // TODO: handle error requests that slip through
          // This should just throw a notification, not break the page
          FauxtonAPI.addNotification({
            msg: "Bad Request",
            type: "error",
            clear:  true
          });

          //now redirect back to alldocs
          FauxtonAPI.navigate(model.database.url("index") + "?limit=100");
        }
      });
    },

    serialize: function() {
      return {
        viewList: this.viewList,
        resizeLayout: "", //this.viewList ? "-half":"",
        expandDocs: this.expandDocs,
        endOfResults: !this.pagination.canShowNextfn()
      };
    },

    bulkDelete: function() {
     var documentsLength = this.bulkDeleteDocsCollection.length,
         msg;
      
      if (documentsLength === 0) { return; }

      if (documentsLength === 1) {
        msg = "Are you sure you want to delete this document?"; 
      } else {
        msg = "Are you sure you want to delete these " + documentsLength + " documents?";
      }

      if (!window.confirm(msg)) {
        return false;
      }

      this.bulkDeleteDocsCollection.bulkDelete();
    },

    addPagination: function () {
      this.pagination = new Components.IndexPagination({
        collection: this.collection,
        scrollToSelector: '#dashboard-content',
        docLimit: this.params.limit,
        perPage: this.perPageDefault
      });
    },

    cleanup: function () {
      FauxtonAPI.Events.unbind('documents:selected-doc');
      FauxtonAPI.Events.unbind('documents:bulk-delete');
      this.pagination && this.pagination.remove();
      this.allDocsNumber && this.allDocsNumber.remove();
      _.each(this.rows, function (row) {row.remove();});
    },

    removeNestedViews: function () {
      _.each(this.rows, function (row) {
        row.remove();
      });
      this.rows = {};
    },

    beforeRender: function() {
      var docs;

      if (!this.pagination) {
        this.addPagination();
      }

      this.insertView('#documents-pagination', this.pagination);

      if (!this.allDocsNumber) {
        this.allDocsNumber = new Views.AllDocsNumber({
          collection: this.collection,
          newView: this.newView,
          pagination: this.pagination,
          perPageDefault: this.perPageDefault
        });
      }

      this.setView('#item-numbers', this.allDocsNumber);
      this.removeNestedViews();

      docs = this.expandDocs ? this.collection : this.collection.simple();

      docs.each(function(doc) {
        var isChecked;
        if (this.bulkDeleteDocsCollection) {
          isChecked = this.bulkDeleteDocsCollection.get(doc.id);
        }
        this.rows[doc.id] = this.insertView("#doc-list", new this.nestedView({
          model: doc,
          checked: isChecked
        }));
      }, this);
    },

    setCollection: function (collection) {
      this.collection = collection;
      if (!this.pagination) {
        this.addPagination();
      }
      this.pagination.setCollection(collection);
      this.allDocsNumber.setCollection(collection);
    },

    setParams: function (docParams, urlParams) {
      this.docParams = docParams;
      this.params = urlParams;
      this.perPageDefault = this.docParams.limit;

      if (this.params.limit) {
        this.pagination.docLimit = this.params.limit;
      }
    },

    afterRender: function () {
      prettyPrint();

      if (this.bulkDeleteDocsCollection) {
        this.stopListening(this.bulkDeleteDocsCollection);
        this.listenTo(this.bulkDeleteDocsCollection, 'error', this.showError);
        this.listenTo(this.bulkDeleteDocsCollection, 'removed', this.removeDocuments);
        this.listenTo(this.bulkDeleteDocsCollection, 'updated', this.toggleTrash);
      }

      this.toggleTrash();
    },

    perPage: function () {
      return this.allDocsNumber.perPage();
    }
  });



  Views.JumpToDoc = FauxtonAPI.View.extend({
    template: "addons/documents/templates/jumpdoc",

    initialize: function (options) {
      this.database = options.database;
    },

    events: {
      "submit #jump-to-doc": "jumpToDoc"
    },

    jumpToDoc: function (event) {
      event.preventDefault();
      var docId = this.$('#jump-to-doc-id').val().trim();
      FauxtonAPI.navigate('/database/' + app.utils.safeURLName(this.database.id) +'/' + app.utils.safeURLName(docId), {trigger: true});
    },

    afterRender: function () {
     this.typeAhead = new Components.DocSearchTypeahead({el: '#jump-to-doc-id', database: this.database});
     this.typeAhead.render();
    }
  });




  Views.DdocInfo = FauxtonAPI.View.extend({
    template: "addons/documents/templates/ddoc_info",

    initialize: function (options) {
      this.ddocName = options.ddocName;
      this.refreshTime = options.refreshTime || 5000;
      this.listenTo(this.model, 'change', this.render);
    },

    establish: function () {
      return this.model.fetch();
    },

    afterRender: function(){
      this.startRefreshInterval();
    },

    serialize: function () {
      return {
        Ddoc: this.ddocName,
        view_index: this.model.get('view_index')
      };
    },

    startRefreshInterval: function () {
      var model = this.model;

      // Interval already set
      if (this.intervalId) { this.stopRefreshInterval(); }

      this.intervalId = setInterval(function () {
        model.fetch();
      }, this.refreshTime);
    },

    stopRefreshInterval: function () {
      clearInterval(this.intervalId);
    },

    cleanup: function () {
      this.stopRefreshInterval();
    }
  });

  Documents.Views = Views;
  return Documents;
});

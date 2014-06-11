;(function(undefined) {
  'use strict';

  /**
   * artoo save methods
   * ===================
   *
   * Some helpers to save data to a file that will be downloaded by the
   * browser. Works mainly with chrome for the time being.
   *
   * Mainly inspired by:
   * https://github.com/eligrey/FileSaver.js/blob/master/FileSaver.js
   */
  var _root = this;

  // Polyfills
  var reqfs = window.requestFileSystem ||
              window.webkitRequestFileSystem ||
              window.mozRequestFileSystem;

  var URL = _root.URL || _root.webkitURL || _root;

  // Main abstraction
  function Saver() {
    var _saver;

    // Properties
    this.defaultFilename = 'artoo_data';
    this.defaultEncoding = 'utf-8';
    this.forceDownloadMimeType = 'application/octet-stream';
    this.defaultMimeType = 'text/plain';
    this.xmlns = 'http://www.w3.org/1999/xhtml';
    this.deletionQueue = [];
    this.mimeShortcuts = {
      csv: 'text/csv',
      json: 'application/json',
      txt: 'text/plain',
      html: 'text/html'
    };

    // State
    this.INIT = 0;
    this.WRITING = 1;
    this.DONE = 2;

    // Methods
    this.createBlob = function(data, mime, encoding) {
      mime = this.mimeShortcuts[mime] || mime || this.defaultMime;
      return new Blob(
        [data],
        {type: mime + ';charset=' + encoding || this.defaultEncoding}
      );
    };

    this.createBlobFromDataURL = function(url) {
      var byteString = atob(url.split(',')[1]),
          ba = new Uint8Array(byteString.length),
          i,
          l;

      for (i = 0, l = byteString.length; i < l; i++)
        ba[i] = byteString.charCodeAt(i);

      return new Blob([ba.buffer], {
        type: url.split(',')[0].split(':')[1].split(';')[0]
      });
    };
    window.c = this.createBlobFromDataURL;

    this.blobURL = function(blob) {
      var oURL = URL.createObjectURL(blob);
      // this.deletionQueue.push(oURL);
      return oURL;
    };

    this.saveBlob = function(blob, filename) {
      this.readyState = this.INIT;

      var minSize = blob.size,
          saveLink = document.createElementNS(this.xmlns, 'a'),
          canUseSaveLink = !_root.externalHost && 'download' in saveLink;

      if (canUseSaveLink) {
        var oURL = this.blobURL(blob);

        // Updating the save link
        saveLink.href = oURL;
        saveLink.download = filename;

        // Creating event
        var e = document.createEvent('MouseEvents');
        e.initMouseEvent(
          'click', true, false, _root, 0, 0, 0, 0, 0,
          false, false, false, false, 0, null);

        saveLink.dispatchEvent(e);
        this.readyState = this.DONE;
        // dispatch_all
      }
    };

    // Main interface
    this.save = function(data, params) {
      params = params || {};

      // Creating the blob
      var blob = this.createBlob(data, params.mime, params.encoding);

      // Saving the blob
      this.saveBlob(blob, params.filename || this.defaultFilename);
    };

    this.saveDataURL = function(url, params) {
      params = params || {};

      // Creating the blob
      var blob = this.createBlobFromDataURL(url);

      // Saving the blob
      this.saveBlob(blob, params.filename || this.defaultFilename);
    };

    this.saveResource = function(href, params) {
      var a = document.createElement('a');
      a.href = href;
      a.download = params.filename || this.defaultFilename;

      artoo.$(a).simulate('click');
      a = null;
    };
  }

  var _saver = new Saver();

  // Exporting
  artoo.save = function(data, params) {
    _saver.save(data, params);
  };

  artoo.saveJson = function(data, params) {
    params = params || {};

    // Enforcing json
    if (typeof data !== 'string') {
      if (params.pretty || params.indent)
        data = JSON.stringify(data, undefined, params.indent || 2);
      else
        data = JSON.stringify(data);
    }
    else {
      if (params.pretty || params.indent)
        data = JSON.stringify(JSON.parse(data), undefined, params.indent || 2);
    }

    // Extending params
    artoo.save(
      data,
      artoo.helpers.extend(params, {filename: 'data.json', mime: 'json'})
    );
  };

  artoo.savePrettyJson = function(data, params) {
    artoo.saveJson(data, artoo.helpers.extend(params, {pretty: true}));
  };

  artoo.saveCsv = function(data, params) {
    params = params || {};

    data = (typeof data !== 'string') ?
      artoo.helpers.toCSVString(data, params.delimiter, params.escape) :
      data;

    artoo.save(
      data,
      artoo.helpers.extend(params, {mime: 'csv', filename: 'data.csv'})
    );
  };

  artoo.saveHtml = function(data, params) {
    artoo.save(
      (artoo.helpers.isSelector(data)) ? data.html() : data,
      artoo.helpers.extend(params, {mime: 'html', filename: 'fragment.html'})
    );
  };

  artoo.savePageHtml = function(params) {
    artoo.save(
      document.documentElement.innerHTML,
      artoo.helpers.extend(params, {mime: 'html', filename: 'page.html'})
    );
  };

  artoo.saveStore = function(params) {
    params = params || {};
    artoo.savePrettyJson(
      artoo.store.get(params.key),
      artoo.helpers.extend(params, {filename: 'store.json'})
    );
  };

  artoo.saveInstructions = function(params) {
    artoo.save(
      artoo.instructions.getScript(),
      artoo.helpers.extend(params, {
        mime: 'text/javascript',
        filename: 'artoo_script.js'
      })
    );
  };

  artoo.saveResource = function(url, params) {
    params = params || {};

    var ext = artoo.helpers.getExtension(url);

    _saver.saveResource(url, artoo.helpers.extend(params, {
      filename: 'media' + (ext ? '.' + ext : '')
    }));
  };

  artoo.saveImage = function(sel, params) {
    params = params || {};
    var $sel = artoo.helpers.enforceSelector(sel),
        ext = artoo.helpers.getExtension($sel.attr('src'));

    if (!$sel.is('img') && !$sel.attr('src')) {
      artoo.log.error('Trying to download an invalid image.', $sel);
      return;
    }

    artoo.saveResource(
      $sel.attr('src'),
      artoo.helpers.extend(
        params,
        {
          filename: ($sel.attr('alt') || 'image') + (ext ? '.' + ext : '')
        }
      )
    );
  };
}).call(this);

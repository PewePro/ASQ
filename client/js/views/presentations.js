/** @module client/js/views/presentations
    @description front-end logic for presentations.dust
*/
'use strict';

var debug = require('bows')("js/views/presentations");
var request = require('superagent');
var Dialog = require('../../views/dialog/dialog');
var dust = require('dustjs-linkedin');
var templates = require('imports?dust=dustjs-linkedin!../templates.js');
var menuDOMBinder = require('./menu');
var utils = require('../utils');
var thumbGenerator = require('impress-asq-fork-asq-adapter').impressThumbGenerator();

//bootstrap  tooltip options
var tooltipOptions = {
  container: 'body',
  delay: { "show": 600 }
};
var iso; //the isotope container
var dlg; // a modal dialogue

module.exports = {

  initDialog: function(){
    //init dialog 
    var dialogEl = document.getElementById('main-dialog');
    dlg = new Dialog(dialogEl);
  },

  initThumbs : function (){
    //resize thumbs
    var thumbs = document.querySelectorAll('.thumb-step');

    [].forEach.call(thumbs, function resizeThumb(thumb){
      thumbGenerator.resizeThumb(thumb, {width: 280, height: 175});
    });

    // start isotope when thumbs are resized
    var container = document.querySelector('.isotope');

    iso = new Isotope(container, {
      itemSelector: '.thumb',
      filter: ':not(.removed-item)',
      masonry: {
        isFitWidth: true
      },
      sortBy: 'position',
      getSortData : {
        position : function ( elem ) {
          return parseInt( elem.dataset.sortPosition, 10 );
        }
      }
    });

    //hide all thumbs but the first one
    [].forEach.call(document.querySelectorAll('.thumb'), function(el){
      el.dataset.activeThumbStep = 0;
      [].forEach.call(el.querySelectorAll('.thumb-step'), function(thumbStep, index){
        if(index==0) return;
        utils.hide(thumbStep);
      })
    });
  },



  navThumSteps : function (thumb, direction) {
    var activeThumbStep = parseInt(thumb.dataset.activeThumbStep);
    var thumbSteps = thumb.querySelectorAll('.thumb-step');
    var l = thumbSteps.length;
    utils.hide(thumbSteps[activeThumbStep])
    // $thumbSteps.eq(activeThumbStep).hide();

    //prev button
    if(direction == "prev"){
      activeThumbStep = (--activeThumbStep >= 0) ? activeThumbStep : (l-1);
    }else{ //next button
      activeThumbStep = (++activeThumbStep < l) ? activeThumbStep : 0;
    }
    thumb.dataset.activeThumbStep = activeThumbStep;
    utils.show(thumbSteps[activeThumbStep]);
  },

  reRenderThumb: function (presentationId, username){
    var currentThumb = document.getElementById(presentationId);
    var thumbData = {
      _id : presentationId,
      position : currentThumb.dataset.sortPosition,
      title : currentThumb.querySelector('.thumb-title').innerHTML,
      params: {
        username: username
      },
      lastSession: currentThumb.querySelector('.last-session').innerText,
      lastEdit: currentThumb.querySelector('.last-session').innerText,
      thumbnails: [].map.call(currentThumb.querySelectorAll('.thumb-wrapper .thumb-step')
        , function(el){
          return el.outerHTML;
        })
    }
    dust.render('views/shared/presentationThumb', thumbData, function(err, out){
        if(err){
          debug(err)
        }else{

          //we don't need the whole out just the innerHTML
          //so we create a dummy element and then get the innerHTML
          // of it's first child (which equals to the root of out)
          var div = document.createElement('div');
          div.innerHTML = out;
          var innerElements = div.firstChild.innerHTML;
          currentThumb.innerHTML =  innerElements;

          //resize slide thumbs for the current thumb
          var thumbs = currentThumb.querySelectorAll('.thumb-step');
          [].forEach.call(thumbs, function resizeThumb(thumb){
            thumbGenerator.resizeThumb(thumb, {width: 280, height: 175});
          });

          $('#'+ presentationId).find('[data-toggle="tooltip"]').tooltip(tooltipOptions);
        }
    });    
  },

  onTapThumbRemove : function (event) {
    event.preventDefault();
    var shouldDelete = confirm('Are you sure you want to delete this slideshow?')
    if(shouldDelete==false) return;

    var thumb = utils.getClosest(this, '.thumb');

    // clone thumb in case server responds with failure
    var clone = thumb.cloneNode(true);

    //delete from DOM
    iso.remove(thumb);
    iso.layout();
      
    // send delete request to server
    request
      .del(this.dataset.target)
      .set('Accept', 'application/json')
      .end(function(err, res){
        if(err || res.statusType!=2){
          iso.insert(clone);
          alert('Something went wrong with removing your presentation: ' + 
            (err!=null ? err.message : JSON.stringify(res.body)));
          return;
        }
        //empty clone
        clone= null;
      });
  },

  startLivePresentation : function (btn){
    var username = btn.dataset.username;
    var presentationId = btn.dataset.id;
    var authLevel = btn.dataset.authlevel;
    var flow = btn.dataset.flow || 'ctrl';
    var data = {authLevel : authLevel, flow: flow}
    var url = ['/', username, '/presentations/', presentationId, '/live'].join('');
    debug('POST ' + url);
    // send delete request to server
    request
      .post(url)
      .send(data)
      .set('Accept', 'application/json')
      .end(function(err, res){
        if(err){
          debug(err);
          dlg
            .setErrorContent("Uknown error occured while starting presentation")
            .toggle();
        }
        else if(res.ok){
          window.location = res.headers.location
        }else{
          debug(res.text);
          dlg
            .setErrorContent("An error occured while starting presentation:\n" + res.text)
            .toggle();
        }
        
      });
  },

  stopLivePresentation : function (btn){
    var username = btn.dataset.username;
    var presentationId = btn.dataset.id;
    var authLevel = btn.dataset.authlevel;
    var url = ['/', username, '/presentations/', presentationId, '/live'].join('');
    debug('DELETE ' + url);

    request
      .del(url)
      .set('Accept', 'application/json')
      .end(function(err, res){
        if(err){
          debug(err);
          dlg
            .setErrorContent("Uknown error occured while stoping the presentation")
            .toggle();
        }
        else if(res.ok){
          //re-render thumb
          this.reRenderThumb(presentationId, username);
          // show alert
          dust.render('views/shared/alert', {
            alerts: [
              {dismissible: true,
              type: "success",
              message: "Session stopped successfully"}
            ]
          }, function(err, out){
              if(err){
                debug(err);
              }else{
                utils.prependHtml(out, document.getElementById("main-container"));
              }
          });   
        }else{
          debug(res.text);
          dlg
            .setErrorContent("An error occured while stopping the presentation:\n" + res.text)
            .toggle();
        }
      }.bind(this));
  },

  showUploadCommand : function (btn){
    var data = {
        cookie: btn.dataset.cookie,
        title: btn.dataset.title,
        rootUrl: document.location.origin,
        username: btn.dataset.username,
        presentationId : btn.dataset.presentationId
    }
    dust.render("views/shared/presentationUploadCommand", data, function(err, out){
      if(err) throw err;
      dlg.setContent(out);
      utils.selectText(dlg.el.querySelector(".upload-code-snippet-modal"));
      dlg.toggle();
    }); 
  },

  setupThumbEventListeners: function(){
    // store focused thumb
    $(document).on('click', function(evt){ 
      $('.thumb').each(function(){
         this.setAttribute('hasFocus', false);
      });
    });

    
    $(document).on('click', '.thumb', function(evt){ 
      $('.thumb').each(function(){
         this.setAttribute('hasFocus', false);
      });
      evt.stopPropagation();
      evt.currentTarget.setAttribute('hasFocus', true);
    })

    //navigate thumbs with keyboard
    document.body.addEventListener('keydown',function(e) {
      var focusedThumb = document.querySelector('.thumb[hasFocus=true]');
      if(! focusedThumb) return;

      var direction = "";
      if(e.keyCode == 37) { // left
        direction = "prev";
      }
      else if(e.keyCode == 39) { // right
        direction = "next";
      }

      this.navThumSteps(focusedThumb, direction);
    }.bind(this));


    $(document).on('click', '.thumb-nav-btn', function(evt){
      var btn = evt.currentTarget;

      var thumb = utils.getClosest(btn, '.thumb');
      if(!thumb) return;

      var direction = "";
      //prev button
      if(btn.classList.contains('thumb-nav-prev-btn')){
        direction = "prev";
      }else{ //next button
        direction = "next";
      }

      this.navThumSteps(thumb, direction);
    }.bind(this));
  },

  onThumbControlBtnTap: function(event) {
      event.preventDefault();
      var btn = event.currentTarget;

      // start presentation action
      if(btn.classList.contains("btn-start")){
        this.startLivePresentation(btn);
      }
      //stop presentation
      else if(btn.classList.contains("btn-stop")){ 
        this.stopLivePresentation(btn);
      }
      //upload link
      else if(btn.classList.contains("btn-upload-command")){
        this.showUploadCommand(btn);
      }
  },

  init : function (){
    //init main menu
    menuDOMBinder();

    //disable no-touch classes
    if ('ontouchstart' in document) {
      $('body').removeClass('no-touch');
    }

    this.initDialog();
    
    //iphone/ipad install as web-app pop up
    $(function(){

      utils.showIOSInstallAsApp();

      //tooltip
      $('[data-toggle="tooltip"]').tooltip(tooltipOptions);

      // Thumbs may contain polymer elements which take some time to render.
      // Layout operations should occur after polymer has initialized
      window.addEventListener('WebComponentsReady', function onWebComponentsReady(e) {
        this.initThumbs();
      }.bind(this));
    
      this.setupThumbEventListeners();

      var $documentHammered = $(document).hammer();
      
      // $documentHammered.on("touch", hidePopover);
      // function hidePopover(){
      //   $('#iOSWebAppInfo').popover('destroy');
      // };

      $documentHammered      
        //remove slideshow
        .on('tap', '.thumb > .remove' , this.onTapThumbRemove)

      // click handlers for non GET requests
      .on('tap', '.thumb-controls a' , this.onThumbControlBtnTap.bind(this));
    }.bind(this))
  }
}

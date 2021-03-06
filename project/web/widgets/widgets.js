require({cache:{
'MicroflowTimer/widget/MicroflowTimer':function(){
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dojo/_base/lang",
    "dojo/_base/array"
], function(declare, _WidgetBase, lang, dojoArray) {
    "use strict";

    return declare("MicroflowTimer.widget.MicroflowTimer", [_WidgetBase], {

        // Parameters configured in the Modeler.
        interval: 30000,
        once: false,
        startatonce: true,
        callEvent: "", // "callMicroflow" | "callNanoflow"
        microflow: "",
        nanoflow: null,
        firstIntervalAttr: null,
        intervalAttr: null,
        timerStatusAttr: null,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        _timer: null,
        _timeout: null,
        _timerStarted: false,

        postCreate: function() {
            this._handles = [];

            if(!(this.microflow && this.callEvent == "callMicroflow" || this.nanoflow.nanoflow && this.callEvent == "callNanoflow")) {
                mx.ui.error("No action specified for " + this.callEvent)
            }
        },

        update: function (obj, callback) {
            logger.debug(this.id + ".update");

            this._contextObj = obj;
            this._resetSubscriptions();

            //changes the interval to the attribute value, if set
            if (this._contextObj && this.intervalAttr) {
                this.interval = this._contextObj.get(this.intervalAttr);
            }

            if (!this._timerStarted) {
                this._runTimer();
            }

            this._executeCallback(callback, "update");
        },

        resize: function(box) {},

        uninitialize: function() {
            this._stopTimer();
        },

        _checkTimerStatus: function() {
            logger.debug(this.id + "._checkStatus");

            var running, newInterval;

            //both optional attributes are used
            if (this.intervalAttr && this.timerStatusAttr) {
                //get the running state
                running = this._contextObj.get(this.timerStatusAttr);
                //change the interval if it was set in the attribute
                newInterval = this._contextObj.get(this.intervalAttr);
                if (this.interval !== newInterval) {
                    this.interval = newInterval;
                    //stop and start the timer if it's running and will keep running
                    if (running && this._timerStarted) {
                        this._intervalChange(newInterval);
                    }
                }

                this._timerStatusChange(running);

                //just timer status is used
            } else if (this.timerStatusAttr) {
                running = this._contextObj.get(this.timerStatusAttr);
                this._timerStatusChange(running);

                //just interval is used
            } else if (this.intervalAttr) {
                newInterval = this._contextObj.get(this.intervalAttr);
                if (this.interval !== newInterval) {
                    this.interval = newInterval;
                    this._intervalChange(newInterval);
                }
            }

        },

        _timerStatusChange: function (running) {
            if (running !== this._timerStarted) {
                if (running) {
                    this._runTimer();
                } else {
                    this._stopTimer();
                }
            }
        },

        //Called when the optional timer interval attribute is changed
        _intervalChange: function (newInterval) {
            logger.debug(this.id + "._intervalChange");

            this.interval = newInterval;

            if (this._timerStarted) {
                this._stopTimer();
                this._runTimer();
            }
        },

        _runTimer: function() {
            logger.debug(this.id + "._runTimer", this.interval);
            if (this.callEvent !== "" && this._contextObj) {
                this._timerStarted = true;

                //if there's a first interval, get and use that first, then use the regular interval
                if (this.firstIntervalAttr) {
                    var firstInterval = this._contextObj.get(this.firstIntervalAttr);

                    if (this.once) {
                        this._timeout = setTimeout(lang.hitch(this, this._executeEvent), firstInterval);
                    } else {
                        if (this.startatonce) {
                            this._executeEvent();
                        }
                        this._timeout = setTimeout(lang.hitch(this, function() {
                            this._executeEvent();
                            this._timer = setInterval(lang.hitch(this, this._executeEvent), this.interval);
                        }), firstInterval);
                    }
                    //otherwise just use the regulat interval
                } else {
                    if (this.once) {
                        this._timeout = setTimeout(lang.hitch(this, this._executeEvent), this.interval);
                    } else {
                        if (this.startatonce) {
                            this._executeEvent();
                        }
                        this._timer = setInterval(lang.hitch(this, this._executeEvent), this.interval);
                    }
                }
            }
        },

        _stopTimer: function() {
            logger.debug(this.id + "._stopTimer");
            this._timerStarted = false;

            if (this._timer !== null) {
                logger.debug(this.id + "._stopTimer timer cleared");
                clearInterval(this._timer);
                this._timer = null;
            }
            if (this._timeout !== null) {
                logger.debug(this.id + "._stopTimer timeout cleared");
                clearTimeout(this._timeout);
                this._timeout = null;
            }
        },

        _executeEvent: function() {
            if(this.callEvent === "callMicroflow" && this.microflow) {
                this._execMf()
            } else if (this.callEvent === "callNanoflow" && this.nanoflow.nanoflow){
                this._executeNanoFlow()
            } else {
                return;
            }
        },

        _execMf: function() {
            logger.debug(this.id + "._execMf");
            if (!this._contextObj) {
                return;
            }

            if (this.microflow) {
                var mfObject = {
                    params: {
                        actionname: this.microflow,
                        applyto: "selection",
                        guids: [this._contextObj.getGuid()]
                    },
                    callback: lang.hitch(this, function(result) {
                        if (!result) {
                            logger.debug(this.id + "._execMf callback, stopping timer");
                            this._stopTimer();
                        }
                    }),
                    error: lang.hitch(this, function(error) {
                        logger.error(this.id + ": An error ocurred while executing microflow: ", error);
                        mx.ui.error("An error ocurred while executing microflow" + error.message);
                    })
                };

                if (!mx.version || mx.version && parseInt(mx.version.split(".")[0]) < 6) {
                    mfObject.store = {
                        caller: this.mxform
                    };
                } else {
                    mfObject.origin = this.mxform;
                }

                mx.data.action(mfObject, this);
            }
        },

        _executeNanoFlow: function() {
            if (this.nanoflow.nanoflow && this.mxcontext) {
                mx.data.callNanoflow({
                    nanoflow: this.nanoflow,
                    origin: this.mxform,
                    context: this.mxcontext,
                    callback: lang.hitch(this, function(result) {
                        if (!result) {
                            logger.debug(this.id + "._executeNanoFlow callback, stopping timer");
                            this._stopTimer();
                        }
                    }),
                    error: lang.hitch(this, function(error) {
                        logger.error(this.id + ": An error ocurred while executing nanoflow: ", error);
                        mx.ui.error("An error ocurred while executing nanoflow" + error.message);
                    })
                });
            }
        },

        // Reset subscriptions.
        _resetSubscriptions: function() {
            this.unsubscribeAll();

            // When a mendix object exists create subscribtions.
            if (this._contextObj && this.timerStatusAttr) {
                this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: lang.hitch(this, function(guid) {
                        this._checkTimerStatus();
                    })
                });

                this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.timerStatusAttr,
                    callback: lang.hitch(this, function(guid, attr, attrValue) {
                        this._checkTimerStatus();
                    })
                });

                this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.intervalAttr,
                    callback: lang.hitch(this, function(guid, attr, attrValue) {
                        this._intervalChange();
                    })
                });
            }
        },

        _executeCallback: function (cb, from) {
            logger.debug(this.id + "._executeCallback" + (from ? " from " + from : ""));
            if (cb && typeof cb === "function") {
                cb();
            }
        }
    });
});

require(["MicroflowTimer/widget/MicroflowTimer"])

},
'SprintrFeedbackWidget/SprintrFeedback':function(){
define(["dojo/dom-construct","dojo/aspect","dojo/Deferred","dijit/registry","dojo/_base/array","dojo/query","dojo/NodeList-traverse","dojo/_base/lang","dojo/_base/declare","mxui/widget/_WidgetBase","dijit/_TemplatedMixin"],function(e,t,r,o,n,a,s,i,l,c,d){var p=Math.min;return function(e){function t(o){if(r[o])return r[o].exports;var n=r[o]={i:o,l:!1,exports:{}};return e[o].call(n.exports,n,n.exports,t),n.l=!0,n.exports}var r={};return t.m=e,t.c=r,t.d=function(e,r,o){t.o(e,r)||Object.defineProperty(e,r,{configurable:!1,enumerable:!0,get:o})},t.n=function(e){var r=e&&e.__esModule?function(){return e["default"]}:function(){return e};return t.d(r,"a",r),r},t.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},t.p="",t(t.s=38)}([function(e){var t=e.exports="undefined"!=typeof window&&window.Math==Math?window:"undefined"!=typeof self&&self.Math==Math?self:Function("return this")();"number"==typeof __g&&(__g=t)},function(e,t,r){var o=r(27)("wks"),n=r(28),a=r(0).Symbol,s="function"==typeof a,i=e.exports=function(e){return o[e]||(o[e]=s&&a[e]||(s?a:n)("Symbol."+e))};i.store=o},function(e){var t=e.exports={version:"2.6.5"};"number"==typeof __e&&(__e=t)},function(e,t,r){var o=r(5);e.exports=function(e){if(!o(e))throw TypeError(e+" is not an object!");return e}},function(e,t,r){var o=r(11),n=r(25);e.exports=r(6)?function(e,t,r){return o.f(e,t,n(1,r))}:function(e,t,r){return e[t]=r,e}},function(e){e.exports=function(e){return"object"==typeof e?null!==e:"function"==typeof e}},function(e,t,r){e.exports=!r(24)(function(){return 7!=Object.defineProperty({},"a",{get:function(){return 7}}).a})},function(e){e.exports={}},function(e,t,r){var o=r(0),n=r(2),a=r(9),s=r(4),i=r(12),l="prototype",c=function(e,t,r){var d,p,u,h=e&c.F,m=e&c.G,g=e&c.S,y=e&c.P,_=e&c.B,f=e&c.W,x=m?n:n[t]||(n[t]={}),v=x[l],b=m?o:g?o[t]:(o[t]||{})[l];for(d in m&&(r=t),r)p=!h&&b&&void 0!==b[d],p&&i(x,d)||(u=p?b[d]:r[d],x[d]=m&&"function"!=typeof b[d]?r[d]:_&&p?a(u,o):f&&b[d]==u?function(e){var t=function(t,r,o){if(this instanceof e){switch(arguments.length){case 0:return new e;case 1:return new e(t);case 2:return new e(t,r);}return new e(t,r,o)}return e.apply(this,arguments)};return t[l]=e[l],t}(u):y&&"function"==typeof u?a(Function.call,u):u,y&&((x.virtual||(x.virtual={}))[d]=u,e&c.R&&v&&!v[d]&&s(v,d,u)))};c.F=1,c.G=2,c.S=4,c.P=8,c.B=16,c.W=32,c.U=64,c.R=128,e.exports=c},function(e,t,r){var o=r(10);e.exports=function(e,t,r){return(o(e),void 0===t)?e:1===r?function(r){return e.call(t,r)}:2===r?function(r,o){return e.call(t,r,o)}:3===r?function(r,o,n){return e.call(t,r,o,n)}:function(){return e.apply(t,arguments)}}},function(e){e.exports=function(e){if("function"!=typeof e)throw TypeError(e+" is not a function!");return e}},function(e,t,r){var o=r(3),n=r(48),a=r(49),s=Object.defineProperty;t.f=r(6)?Object.defineProperty:function(e,t,r){if(o(e),t=a(t,!0),o(r),n)try{return s(e,t,r)}catch(t){}if("get"in r||"set"in r)throw TypeError("Accessors not supported!");return"value"in r&&(e[t]=r.value),e}},function(e){var t={}.hasOwnProperty;e.exports=function(e,r){return t.call(e,r)}},function(e){var t={}.toString;e.exports=function(e){return t.call(e).slice(8,-1)}},function(e){e.exports=r},function(e){var t=Math.ceil,r=Math.floor;e.exports=function(e){return isNaN(e=+e)?0:(0<e?r:t)(e)}},function(e){e.exports=function(e){if(e==void 0)throw TypeError("Can't call method on  "+e);return e}},function(e){e.exports=!0},function(e,t,r){var o=r(5),n=r(0).document,a=o(n)&&o(n.createElement);e.exports=function(e){return a?n.createElement(e):{}}},function(e,t,r){var o=r(56),n=r(16);e.exports=function(e){return o(n(e))}},function(e,t,r){var o=r(27)("keys"),n=r(28);e.exports=function(e){return o[e]||(o[e]=n(e))}},function(e,t,r){var o=r(11).f,n=r(12),a=r(1)("toStringTag");e.exports=function(e,t,r){e&&!n(e=r?e:e.prototype,a)&&o(e,a,{configurable:!0,value:t})}},function(e,t,r){"use strict";function o(e){var t,r;this.promise=new e(function(e,o){if(t!=void 0||r!=void 0)throw TypeError("Bad Promise constructor");t=e,r=o}),this.resolve=n(t),this.reject=n(r)}var n=r(10);e.exports.f=function(e){return new o(e)}},function(e,t,r){"use strict";var o=r(17),n=r(8),a=r(50),s=r(4),i=r(7),l=r(51),c=r(21),d=r(59),p=r(1)("iterator"),u=!([].keys&&"next"in[].keys()),h="keys",m="values",g=function(){return this};e.exports=function(e,t,r,y,_,f,x){l(r,t,y);var v,b,S,O=function(e){return!u&&e in k?k[e]:e===h?function(){return new r(this,e)}:e===m?function(){return new r(this,e)}:function(){return new r(this,e)}},E=t+" Iterator",T=_==m,P=!1,k=e.prototype,L=k[p]||k["@@iterator"]||_&&k[_],w=L||O(_),R=_?T?O("entries"):w:void 0,j="Array"==t?k.entries||L:L;if(j&&(S=d(j.call(new e)),S!==Object.prototype&&S.next&&(c(S,E,!0),!o&&"function"!=typeof S[p]&&s(S,p,g))),T&&L&&L.name!==m&&(P=!0,w=function(){return L.call(this)}),(!o||x)&&(u||P||!k[p])&&s(k,p,w),i[t]=w,i[E]=g,_)if(v={values:T?w:O(m),keys:f?w:O(h),entries:R},x)for(b in v)b in k||a(k,b,v[b]);else n(n.P+n.F*(u||P),t,v);return v}},function(e){e.exports=function(e){try{return!!e()}catch(t){return!0}}},function(e){e.exports=function(e,t){return{enumerable:!(1&e),configurable:!(2&e),writable:!(4&e),value:t}}},function(e,t,r){var o=r(15);e.exports=function(e){return 0<e?p(o(e),9007199254740991):0}},function(e,t,r){var o=r(2),n=r(0),a="__core-js_shared__",s=n[a]||(n[a]={});(e.exports=function(e,t){return s[e]||(s[e]=t===void 0?{}:t)})("versions",[]).push({version:o.version,mode:r(17)?"pure":"global",copyright:"\xA9 2019 Denis Pushkarev (zloirock.ru)"})},function(e){var t=0,r=Math.random();e.exports=function(e){return"Symbol(".concat(e===void 0?"":e,")_",(++t+r).toString(36))}},function(e){e.exports=["constructor","hasOwnProperty","isPrototypeOf","propertyIsEnumerable","toLocaleString","toString","valueOf"]},function(e,t,r){var o=r(0).document;e.exports=o&&o.documentElement},function(e,t,r){var o=r(13),n=r(1)("toStringTag"),a="Arguments"==o(function(){return arguments}()),s=function(e,t){try{return e[t]}catch(t){}};e.exports=function(e){var t,r,i;return e===void 0?"Undefined":null===e?"Null":"string"==typeof(r=s(t=Object(e),n))?r:a?o(t):"Object"==(i=o(t))&&"function"==typeof t.callee?"Arguments":i}},function(e,t,r){var o=r(3),n=r(10),a=r(1)("species");e.exports=function(e,t){var r,s=o(e).constructor;return s===void 0||(r=o(s)[a])==void 0?t:n(r)}},function(e,t,r){var o,n,a,s=r(9),i=r(71),l=r(30),c=r(18),d=r(0),p=d.process,u=d.setImmediate,h=d.clearImmediate,m=d.MessageChannel,g=d.Dispatch,y=0,_={},f="onreadystatechange",x=function(){var e=+this;if(_.hasOwnProperty(e)){var t=_[e];delete _[e],t()}},v=function(e){x.call(e.data)};u&&h||(u=function(e){for(var t=[],r=1;arguments.length>r;)t.push(arguments[r++]);return _[++y]=function(){i("function"==typeof e?e:Function(e),t)},o(y),y},h=function(e){delete _[e]},"process"==r(13)(p)?o=function(e){p.nextTick(s(x,e,1))}:g&&g.now?o=function(e){g.now(s(x,e,1))}:m?(n=new m,a=n.port2,n.port1.onmessage=v,o=s(a.postMessage,a,1)):d.addEventListener&&"function"==typeof postMessage&&!d.importScripts?(o=function(e){d.postMessage(e+"","*")},d.addEventListener("message",v,!1)):f in c("script")?o=function(e){l.appendChild(c("script"))[f]=function(){l.removeChild(this),x.call(e)}}:o=function(e){setTimeout(s(x,e,1),0)}),e.exports={set:u,clear:h}},function(e){e.exports=function(e){try{return{e:!1,v:e()}}catch(t){return{e:!0,v:t}}}},function(e,t,r){var o=r(3),n=r(5),a=r(22);e.exports=function(e,t){if(o(e),n(t)&&t.constructor===e)return t;var r=a.f(e),s=r.resolve;return s(t),r.promise}},function(e){e.exports=i},function(e,t,r){"use strict";function o(){var e=arguments[0],t=Array.prototype.slice.call(arguments,1);this.id?logger.debug(this.id+"."+e,t&&t.length?t[0]:""):logger.debug(e,t&&t.length?t[0]:"")}t.a=o,t.b=function(e,t){o.call(this,"_callback",t?"from "+t:""),e&&"function"==typeof e&&e()};var n=r(14),a=r.n(n)},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var o=r(39),n=r.n(o),a=r(42),s=r.n(a),i=r(82),l=r.n(i),c=r(83),d=r.n(c),p=r(85),u=r.n(p),h=r(86),m=r(98),g=r.n(m),y=r(99),_=r.n(y),f=r(14),v=r.n(f);r(79).polyfill();var x={entity:"",usernameattr:"",emailattr:"",allowSprintrOverride:!0,sprintrapp:"",appName:"",allowSshot:!0,allowEdit:!0,allowMobileShare:!0,allowNormalShare:!0,hideLogo:!1,sprintrserver:"https://sprintr.home.mendix.com/",scriptLocation:"https://feedback-static.mendix.com/",inProductionMf:"",shareInProduction:!1,screenshotForeignObjectRendering:!0,domNode:null,_userObj:null,_username:"",_address:"",_userRoles:[],constructor:function(){this.log=h.d.bind(this),this.runCallback=h.e.bind(this),this.getData=h.c.bind(this),this.executePromise=h.b.bind(this),this.loadData=this.loadData.bind(this)},postCreate:function(){var e=s()(n.a.mark(function e(){return n.a.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:this.log("postCreate",this._WIDGET_VERSION),Object(m.destroy)(this.domNode),mx.addOnLoad(this.loadData);case 3:case"end":return e.stop();}},e,this)}));return function(){return e.apply(this,arguments)}}(),loadData:function(){var e=s()(n.a.mark(function e(){var t,r;return n.a.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:if(this.log("loadData"),!this.entity||!mx.session.getUserId()){e.next=21;break}return this._userObj=null,e.prev=3,e.next=6,this.getData({guid:mx.session.getUserId()});case 6:this._userObj=e.sent,e.next=13;break;case 9:e.prev=9,e.t0=e["catch"](3),this._userObj=null,console.error(e.t0);case 13:if(null!==this._userObj){e.next=16;break}return this._scriptLoad(),e.abrupt("return");case 16:if(this._username="",null!==this._userObj&&""!==this.usernameattr&&this._userObj.has(this.usernameattr)?this._username=this._userObj.get(this.usernameattr):0<mx.session.getUserId()&&mx.session.isGuest&&!mx.session.isGuest()&&(this._username=mx.session.getUserName()),this._address=null!==this._userObj&&""!==this.emailattr&&this._userObj.has(this.emailattr)?this._userObj.get(this.emailattr):this._username.match(/.+@.+\..+/)?this._username:"",this._userRoles=[],mx.session.getUserRoleNames)this._userRoles=mx.session.getUserRoleNames();else for(t=mx.session.getUserRoles(),r=0;r<t.length;r++)this._userRoles.push(t[r].get("Name"));case 21:this._scriptLoad();case 22:case"end":return e.stop();}},e,this,[[3,9]])}));return function(){return e.apply(this,arguments)}}(),_scriptLoad:function(){var e=s()(n.a.mark(function e(){var r,o,a,i,t,c,p,h,m=this;return n.a.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return this.log("_scriptLoad"),r="mxCollaboration",o=new v.a,a=!1,i=null,t=0,c=200,p=function(){var e=s()(n.a.mark(function e(){var t,s,i;return n.a.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:if(""===m.inProductionMf){e.next=11;break}return e.prev=1,e.next=4,m.executePromise(m.inProductionMf);case 4:a=e.sent,e.next=11;break;case 7:return e.prev=7,e.t0=e["catch"](1),console.error(e.t0),e.abrupt("return");case 11:t={hasCreateAppButton:m.hasCreateAppButton,idTokenProviderMF:m.idTokenProviderMF,accessTokenProviderMF:m.accessTokenProviderMF,renewAccessTokenMF:m.renewAccessTokenMF,appName:m.appName,sprintrId:m.sprintrapp,mobileShare:!a&&m.allowMobileShare,normalShare:!a&&m.allowNormalShare||a&&m.shareInProduction,hideLogo:m.hideLogo,useSprintr:m.allowSprintrOverride,allowScreenshot:m.allowSshot,screenshotForeignObjectRendering:m.screenshotForeignObjectRendering,webmodelerEdit:!a&&m.allowEdit,userName:m._username,userAddress:m._address,userRoles:m._userRoles.join(" ")+" (account: "+m._username+")",inProduction:a,debug:!1},s=window[r],s.create(t),s._created&&(i=s.getContentForm(),null!==i&&(s.addHandle(Object(y.after)(i,"onNavigation",s.triggerUrlChange.bind(s))),s.addHandle(Object(y.before)(i,"onNavigation",s.triggerUrlChange.bind(s)))),m.addOnDestroy(function(){m.log("destroy"),s.destroy()})),o.resolve(window[r]);case 16:case"end":return e.stop();}},e,m,[[1,7]])}));return function(){return e.apply(this,arguments)}}(),h=function e(){return t++,t>=c?void o.reject("Timeout getting the script"):void(window[r]?(clearTimeout(i),p()):i=setTimeout(e,50))},window[r]?p():(d()(u()(this.scriptLocation,"feedback.css")),l()(u()(this.scriptLocation,"feedback.js"),{},function(e){e?o.reject(e):window[r]?p():i=setTimeout(h,50)})),e.abrupt("return",o.promise);case 11:case"end":return e.stop();}},e,this)}));return function(){return e.apply(this,arguments)}}(),_initOnDestroy:function(){this.log("_initOnDestroy"),this.addOnDestroy(function(){})}};t["default"]=Object(h.a)("SprintrFeedback",!1,x)},function(e,t,r){e.exports=r(40)},function(e,t,r){var o=function(){return this}()||Function("return this")(),n=o.regeneratorRuntime&&0<=Object.getOwnPropertyNames(o).indexOf("regeneratorRuntime"),a=n&&o.regeneratorRuntime;if(o.regeneratorRuntime=void 0,e.exports=r(41),n)o.regeneratorRuntime=a;else try{delete o.regeneratorRuntime}catch(t){o.regeneratorRuntime=void 0}},function(e){!function(t){"use strict";function r(e,t,r,o){var a=t&&t.prototype instanceof n?t:n,s=Object.create(a.prototype),i=new h(o||[]);return s._invoke=c(e,r,i),s}function o(e,t,r){try{return{type:"normal",arg:e.call(t,r)}}catch(e){return{type:"throw",arg:e}}}function n(){}function a(){}function s(){}function i(e){["next","throw","return"].forEach(function(t){e[t]=function(e){return this._invoke(t,e)}})}function l(e){function t(r,n,a,s){var i=o(e[r],e,n);if("throw"===i.type)s(i.arg);else{var l=i.arg,c=l.value;return c&&"object"==typeof c&&_.call(c,"__await")?Promise.resolve(c.__await).then(function(e){t("next",e,a,s)},function(e){t("throw",e,a,s)}):Promise.resolve(c).then(function(e){l.value=e,a(l)},s)}}var r;this._invoke=function(e,o){function n(){return new Promise(function(r,n){t(e,o,r,n)})}return r=r?r.then(n,n):n()}}function c(e,t,r){var n=E;return function(a,s){if(n==P)throw new Error("Generator is already running");if(n==k){if("throw"===a)throw s;return g()}for(r.method=a,r.arg=s;;){var i=r.delegate;if(i){var l=d(i,r);if(l){if(l===L)continue;return l}}if("next"===r.method)r.sent=r._sent=r.arg;else if("throw"===r.method){if(n==E)throw n=k,r.arg;r.dispatchException(r.arg)}else"return"===r.method&&r.abrupt("return",r.arg);n=P;var c=o(e,t,r);if("normal"===c.type){if(n=r.done?k:T,c.arg===L)continue;return{value:c.arg,done:r.done}}"throw"===c.type&&(n=k,r.method="throw",r.arg=c.arg)}}}function d(e,t){var r=e.iterator[t.method];if(void 0===r){if(t.delegate=null,"throw"===t.method){if(e.iterator.return&&(t.method="return",t.arg=void 0,d(e,t),"throw"===t.method))return L;t.method="throw",t.arg=new TypeError("The iterator does not provide a 'throw' method")}return L}var n=o(r,e.iterator,t.arg);if("throw"===n.type)return t.method="throw",t.arg=n.arg,t.delegate=null,L;var a=n.arg;if(!a)return t.method="throw",t.arg=new TypeError("iterator result is not an object"),t.delegate=null,L;if(a.done)t[e.resultName]=a.value,t.next=e.nextLoc,"return"!==t.method&&(t.method="next",t.arg=void 0);else return a;return t.delegate=null,L}function p(e){var t={tryLoc:e[0]};1 in e&&(t.catchLoc=e[1]),2 in e&&(t.finallyLoc=e[2],t.afterLoc=e[3]),this.tryEntries.push(t)}function u(e){var t=e.completion||{};t.type="normal",delete t.arg,e.completion=t}function h(e){this.tryEntries=[{tryLoc:"root"}],e.forEach(p,this),this.reset(!0)}function m(e){if(e){var t=e[x];if(t)return t.call(e);if("function"==typeof e.next)return e;if(!isNaN(e.length)){var r=-1,o=function t(){for(;++r<e.length;)if(_.call(e,r))return t.value=e[r],t.done=!1,t;return t.value=void 0,t.done=!0,t};return o.next=o}}return{next:g}}function g(){return{value:void 0,done:!0}}var y=Object.prototype,_=y.hasOwnProperty,f="function"==typeof Symbol?Symbol:{},x=f.iterator||"@@iterator",v=f.asyncIterator||"@@asyncIterator",b=f.toStringTag||"@@toStringTag",S="object"==typeof e,O=t.regeneratorRuntime;if(O)return void(S&&(e.exports=O));O=t.regeneratorRuntime=S?e.exports:{},O.wrap=r;var E="suspendedStart",T="suspendedYield",P="executing",k="completed",L={},w={};w[x]=function(){return this};var R=Object.getPrototypeOf,j=R&&R(R(m([])));j&&j!==y&&_.call(j,x)&&(w=j);var A=s.prototype=n.prototype=Object.create(w);a.prototype=A.constructor=s,s.constructor=a,s[b]=a.displayName="GeneratorFunction",O.isGeneratorFunction=function(e){var t="function"==typeof e&&e.constructor;return!!t&&(t===a||"GeneratorFunction"===(t.displayName||t.name))},O.mark=function(e){return Object.setPrototypeOf?Object.setPrototypeOf(e,s):(e.__proto__=s,!(b in e)&&(e[b]="GeneratorFunction")),e.prototype=Object.create(A),e},O.awrap=function(e){return{__await:e}},i(l.prototype),l.prototype[v]=function(){return this},O.AsyncIterator=l,O.async=function(e,t,o,n){var a=new l(r(e,t,o,n));return O.isGeneratorFunction(t)?a:a.next().then(function(e){return e.done?e.value:a.next()})},i(A),A[b]="Generator",A[x]=function(){return this},A.toString=function(){return"[object Generator]"},O.keys=function(e){var t=[];for(var r in e)t.push(r);return t.reverse(),function r(){for(;t.length;){var o=t.pop();if(o in e)return r.value=o,r.done=!1,r}return r.done=!0,r}},O.values=m,h.prototype={constructor:h,reset:function(e){if(this.prev=0,this.next=0,this.sent=this._sent=void 0,this.done=!1,this.delegate=null,this.method="next",this.arg=void 0,this.tryEntries.forEach(u),!e)for(var t in this)"t"===t.charAt(0)&&_.call(this,t)&&!isNaN(+t.slice(1))&&(this[t]=void 0)},stop:function(){this.done=!0;var e=this.tryEntries[0],t=e.completion;if("throw"===t.type)throw t.arg;return this.rval},dispatchException:function(e){function t(t,o){return a.type="throw",a.arg=e,r.next=t,o&&(r.method="next",r.arg=void 0),!!o}if(this.done)throw e;for(var r=this,o=this.tryEntries.length-1;0<=o;--o){var n=this.tryEntries[o],a=n.completion;if("root"===n.tryLoc)return t("end");if(n.tryLoc<=this.prev){var s=_.call(n,"catchLoc"),i=_.call(n,"finallyLoc");if(s&&i){if(this.prev<n.catchLoc)return t(n.catchLoc,!0);if(this.prev<n.finallyLoc)return t(n.finallyLoc)}else if(s){if(this.prev<n.catchLoc)return t(n.catchLoc,!0);}else if(!i)throw new Error("try statement without catch or finally");else if(this.prev<n.finallyLoc)return t(n.finallyLoc)}}},abrupt:function(e,t){for(var r,o=this.tryEntries.length-1;0<=o;--o)if(r=this.tryEntries[o],r.tryLoc<=this.prev&&_.call(r,"finallyLoc")&&this.prev<r.finallyLoc){var n=r;break}n&&("break"===e||"continue"===e)&&n.tryLoc<=t&&t<=n.finallyLoc&&(n=null);var a=n?n.completion:{};return a.type=e,a.arg=t,n?(this.method="next",this.next=n.finallyLoc,L):this.complete(a)},complete:function(e,t){if("throw"===e.type)throw e.arg;return"break"===e.type||"continue"===e.type?this.next=e.arg:"return"===e.type?(this.rval=this.arg=e.arg,this.method="return",this.next="end"):"normal"===e.type&&t&&(this.next=t),L},finish:function(e){for(var t,r=this.tryEntries.length-1;0<=r;--r)if(t=this.tryEntries[r],t.finallyLoc===e)return this.complete(t.completion,t.afterLoc),u(t),L},catch:function(e){for(var t,r=this.tryEntries.length-1;0<=r;--r)if(t=this.tryEntries[r],t.tryLoc===e){var o=t.completion;if("throw"===o.type){var n=o.arg;u(t)}return n}throw new Error("illegal catch attempt")},delegateYield:function(e,t,r){return this.delegate={iterator:m(e),resultName:t,nextLoc:r},"next"===this.method&&(this.arg=void 0),L}}}(function(){return this}()||Function("return this")())},function(e,t,r){"use strict";t.__esModule=!0;var o=r(43),n=function(e){return e&&e.__esModule?e:{default:e}}(o);t.default=function(e){return function(){var t=e.apply(this,arguments);return new n.default(function(e,r){function o(a,s){try{var i=t[a](s),l=i.value}catch(e){return void r(e)}return i.done?void e(l):n.default.resolve(l).then(function(e){o("next",e)},function(e){o("throw",e)})}return o("next")})}}},function(e,t,r){e.exports={default:r(44),__esModule:!0}},function(e,t,r){r(45),r(46),r(61),r(65),r(77),r(78),e.exports=r(2).Promise},function(){},function(e,t,r){"use strict";var o=r(47)(!0);r(23)(String,"String",function(e){this._t=e+"",this._i=0},function(){var e,t=this._t,r=this._i;return r>=t.length?{value:void 0,done:!0}:(e=o(t,r),this._i+=e.length,{value:e,done:!1})})},function(e,t,r){var o=r(15),n=r(16);e.exports=function(e){return function(t,r){var c,a,d=n(t)+"",s=o(r),i=d.length;return 0>s||s>=i?e?"":void 0:(c=d.charCodeAt(s),55296>c||56319<c||s+1===i||56320>(a=d.charCodeAt(s+1))||57343<a?e?d.charAt(s):c:e?d.slice(s,s+2):(c-55296<<10)+(a-56320)+65536)}}},function(e,t,r){e.exports=!r(6)&&!r(24)(function(){return 7!=Object.defineProperty(r(18)("div"),"a",{get:function(){return 7}}).a})},function(e,t,r){var o=r(5);e.exports=function(e,t){if(!o(e))return e;var r,n;if(t&&"function"==typeof(r=e.toString)&&!o(n=r.call(e)))return n;if("function"==typeof(r=e.valueOf)&&!o(n=r.call(e)))return n;if(!t&&"function"==typeof(r=e.toString)&&!o(n=r.call(e)))return n;throw TypeError("Can't convert object to primitive value")}},function(e,t,r){e.exports=r(4)},function(e,t,r){"use strict";var o=r(52),n=r(25),a=r(21),s={};r(4)(s,r(1)("iterator"),function(){return this}),e.exports=function(e,t,r){e.prototype=o(s,{next:n(1,r)}),a(e,t+" Iterator")}},function(e,t,r){var o=r(3),n=r(53),a=r(29),s=r(20)("IE_PROTO"),i=function(){},l="prototype",c=function(){var e,t=r(18)("iframe"),o=a.length,n="<",s=">";for(t.style.display="none",r(30).appendChild(t),t.src="javascript:",e=t.contentWindow.document,e.open(),e.write(n+"script"+s+"document.F=Object"+n+"/script"+s),e.close(),c=e.F;o--;)delete c[l][a[o]];return c()};e.exports=Object.create||function(e,t){var r;return null===e?r=c():(i[l]=o(e),r=new i,i[l]=null,r[s]=e),void 0===t?r:n(r,t)}},function(e,t,r){var o=r(11),n=r(3),a=r(54);e.exports=r(6)?Object.defineProperties:function(e,t){n(e);for(var r,s=a(t),l=s.length,c=0;l>c;)o.f(e,r=s[c++],t[r]);return e}},function(e,t,r){var o=r(55),n=r(29);e.exports=Object.keys||function(e){return o(e,n)}},function(e,t,r){var o=r(12),n=r(19),a=r(57)(!1),s=r(20)("IE_PROTO");e.exports=function(e,t){var r,l=n(e),c=0,i=[];for(r in l)r!=s&&o(l,r)&&i.push(r);for(;t.length>c;)o(l,r=t[c++])&&(~a(i,r)||i.push(r));return i}},function(e,t,r){var o=r(13);e.exports=Object("z").propertyIsEnumerable(0)?Object:function(e){return"String"==o(e)?e.split(""):Object(e)}},function(e,t,r){var o=r(19),n=r(26),a=r(58);e.exports=function(e){return function(t,r,s){var i,l=o(t),c=n(l.length),d=a(s,c);if(e&&r!=r){for(;c>d;)if(i=l[d++],i!=i)return!0;}else for(;c>d;d++)if((e||d in l)&&l[d]===r)return e||d||0;return!e&&-1}}},function(e,t,r){var o=r(15),n=Math.max;e.exports=function(e,t){return e=o(e),0>e?n(e+t,0):p(e,t)}},function(e,t,r){var o=r(12),n=r(60),a=r(20)("IE_PROTO"),s=Object.prototype;e.exports=Object.getPrototypeOf||function(e){return e=n(e),o(e,a)?e[a]:"function"==typeof e.constructor&&e instanceof e.constructor?e.constructor.prototype:e instanceof Object?s:null}},function(e,t,r){var o=r(16);e.exports=function(e){return Object(o(e))}},function(e,t,r){r(62);for(var o=r(0),n=r(4),a=r(7),s=r(1)("toStringTag"),l="CSSRuleList,CSSStyleDeclaration,CSSValueList,ClientRectList,DOMRectList,DOMStringList,DOMTokenList,DataTransferItemList,FileList,HTMLAllCollection,HTMLCollection,HTMLFormElement,HTMLSelectElement,MediaList,MimeTypeArray,NamedNodeMap,NodeList,PaintRequestList,Plugin,PluginArray,SVGLengthList,SVGNumberList,SVGPathSegList,SVGPointList,SVGStringList,SVGTransformList,SourceBufferList,StyleSheetList,TextTrackCueList,TextTrackList,TouchList".split(","),c=0;c<l.length;c++){var i=l[c],d=o[i],p=d&&d.prototype;p&&!p[s]&&n(p,s,i),a[i]=a.Array}},function(e,t,r){"use strict";var o=r(63),n=r(64),a=r(7),s=r(19);e.exports=r(23)(Array,"Array",function(e,t){this._t=s(e),this._i=0,this._k=t},function(){var e=this._t,t=this._k,r=this._i++;return!e||r>=e.length?(this._t=void 0,n(1)):"keys"==t?n(0,r):"values"==t?n(0,e[r]):n(0,[r,e[r]])},"values"),a.Arguments=a.Array,o("keys"),o("values"),o("entries")},function(e){e.exports=function(){}},function(e){e.exports=function(e,t){return{value:t,done:!!e}}},function(e,t,r){"use strict";var o,n,a,s,i=r(17),l=r(0),c=r(9),d=r(31),p=r(8),u=r(5),h=r(10),m=r(66),g=r(67),y=r(32),_=r(33).set,f=r(72)(),x=r(22),v=r(34),b=r(73),S=r(35),O="Promise",E=l.TypeError,T=l.process,P=T&&T.versions,k=P&&P.v8||"",L=l[O],w="process"==d(T),R=function(){},j=n=x.f,A=!!function(){try{var e=L.resolve(1),t=(e.constructor={})[r(1)("species")]=function(e){e(R,R)};return(w||"function"==typeof PromiseRejectionEvent)&&e.then(R)instanceof t&&0!==k.indexOf("6.6")&&-1===b.indexOf("Chrome/66")}catch(t){}}(),I=function(e){var t;return u(e)&&"function"==typeof(t=e.then)&&t},M=function(e,t){if(!e._n){e._n=!0;var r=e._c;f(function(){for(var o=e._v,n=1==e._s,a=0,s=function(t){var r,a,s,i=n?t.ok:t.fail,l=t.resolve,c=t.reject,d=t.domain;try{i?(!n&&(2==e._h&&D(e),e._h=1),!0===i?r=o:(d&&d.enter(),r=i(o),d&&(d.exit(),s=!0)),r===t.promise?c(E("Promise-chain cycle")):(a=I(r))?a.call(r,l,c):l(r)):c(o)}catch(t){d&&!s&&d.exit(),c(t)}};r.length>a;)s(r[a++]);e._c=[],e._n=!1,t&&!e._h&&N(e)})}},N=function(e){_.call(l,function(){var t,r,o,n=e._v,a=F(e);if(a&&(t=v(function(){w?T.emit("unhandledRejection",n,e):(r=l.onunhandledrejection)?r({promise:e,reason:n}):(o=l.console)&&o.error&&o.error("Unhandled promise rejection",n)}),e._h=w||F(e)?2:1),e._a=void 0,a&&t.e)throw t.v})},F=function(e){return 1!==e._h&&0===(e._a||e._c).length},D=function(e){_.call(l,function(){var t;w?T.emit("rejectionHandled",e):(t=l.onrejectionhandled)&&t({promise:e,reason:e._v})})},C=function(e){var t=this;t._d||(t._d=!0,t=t._w||t,t._v=e,t._s=2,!t._a&&(t._a=t._c.slice()),M(t,!0))},G=function(e){var t,r=this;if(!r._d){r._d=!0,r=r._w||r;try{if(r===e)throw E("Promise can't be resolved itself");(t=I(e))?f(function(){var o={_w:r,_d:!1};try{t.call(e,c(G,o,1),c(C,o,1))}catch(t){C.call(o,t)}}):(r._v=e,r._s=1,M(r,!1))}catch(t){C.call({_w:r,_d:!1},t)}}};A||(L=function(e){m(this,L,O,"_h"),h(e),o.call(this);try{e(c(G,this,1),c(C,this,1))}catch(e){C.call(this,e)}},o=function(){this._c=[],this._a=void 0,this._s=0,this._d=!1,this._v=void 0,this._h=0,this._n=!1},o.prototype=r(74)(L.prototype,{then:function(e,t){var r=j(y(this,L));return r.ok="function"!=typeof e||e,r.fail="function"==typeof t&&t,r.domain=w?T.domain:void 0,this._c.push(r),this._a&&this._a.push(r),this._s&&M(this,!1),r.promise},catch:function(e){return this.then(void 0,e)}}),a=function(){var e=new o;this.promise=e,this.resolve=c(G,e,1),this.reject=c(C,e,1)},x.f=j=function(e){return e===L||e===s?new a(e):n(e)}),p(p.G+p.W+p.F*!A,{Promise:L}),r(21)(L,O),r(75)(O),s=r(2)[O],p(p.S+p.F*!A,O,{reject:function(e){var t=j(this),r=t.reject;return r(e),t.promise}}),p(p.S+p.F*(i||!A),O,{resolve:function(e){return S(i&&this===s?L:this,e)}}),p(p.S+p.F*!(A&&r(76)(function(e){L.all(e)["catch"](R)})),O,{all:function(e){var t=this,r=j(t),o=r.resolve,n=r.reject,a=v(function(){var r=[],a=0,s=1;g(e,!1,function(e){var i=a++,l=!1;r.push(void 0),s++,t.resolve(e).then(function(e){l||(l=!0,r[i]=e,--s||o(r))},n)}),--s||o(r)});return a.e&&n(a.v),r.promise},race:function(e){var t=this,r=j(t),o=r.reject,n=v(function(){g(e,!1,function(e){t.resolve(e).then(r.resolve,o)})});return n.e&&o(n.v),r.promise}})},function(e){e.exports=function(e,t,r,o){if(!(e instanceof t)||o!==void 0&&o in e)throw TypeError(r+": incorrect invocation!");return e}},function(e,t,r){var o=r(9),n=r(68),a=r(69),s=r(3),i=r(26),l=r(70),c={},d={},t=e.exports=function(e,t,r,p,u){var h,m,g,y,_=u?function(){return e}:l(e),x=o(r,p,t?2:1),f=0;if("function"!=typeof _)throw TypeError(e+" is not iterable!");if(a(_)){for(h=i(e.length);h>f;f++)if(y=t?x(s(m=e[f])[0],m[1]):x(e[f]),y===c||y===d)return y;}else for(g=_.call(e);!(m=g.next()).done;)if(y=n(g,x,m.value,t),y===c||y===d)return y};t.BREAK=c,t.RETURN=d},function(e,t,r){var o=r(3);e.exports=function(t,e,r,n){try{return n?e(o(r)[0],r[1]):e(r)}catch(r){var a=t["return"];throw void 0!==a&&o(a.call(t)),r}}},function(e,t,r){var o=r(7),n=r(1)("iterator"),a=Array.prototype;e.exports=function(e){return e!==void 0&&(o.Array===e||a[n]===e)}},function(e,t,r){var o=r(31),n=r(1)("iterator"),a=r(7);e.exports=r(2).getIteratorMethod=function(e){if(e!=void 0)return e[n]||e["@@iterator"]||a[o(e)]}},function(e){e.exports=function(e,t,r){var o=r===void 0;switch(t.length){case 0:return o?e():e.call(r);case 1:return o?e(t[0]):e.call(r,t[0]);case 2:return o?e(t[0],t[1]):e.call(r,t[0],t[1]);case 3:return o?e(t[0],t[1],t[2]):e.call(r,t[0],t[1],t[2]);case 4:return o?e(t[0],t[1],t[2],t[3]):e.call(r,t[0],t[1],t[2],t[3]);}return e.apply(r,t)}},function(e,t,r){var o=r(0),n=r(33).set,a=o.MutationObserver||o.WebKitMutationObserver,s=o.process,i=o.Promise,l="process"==r(13)(s);e.exports=function(){var t,r,c,e=function(){var e,o;for(l&&(e=s.domain)&&e.exit();t;){o=t.fn,t=t.next;try{o()}catch(o){throw t?c():r=void 0,o}}r=void 0,e&&e.enter()};if(l)c=function(){s.nextTick(e)};else if(a&&!(o.navigator&&o.navigator.standalone)){var d=!0,p=document.createTextNode("");new a(e).observe(p,{characterData:!0}),c=function(){p.data=d=!d}}else if(i&&i.resolve){var u=i.resolve(void 0);c=function(){u.then(e)}}else c=function(){n.call(o,e)};return function(e){var o={fn:e,next:void 0};r&&(r.next=o),t||(t=o,c()),r=o}}},function(e,t,r){var o=r(0),n=o.navigator;e.exports=n&&n.userAgent||""},function(e,t,r){var o=r(4);e.exports=function(e,t,r){for(var n in t)r&&e[n]?e[n]=t[n]:o(e,n,t[n]);return e}},function(e,t,r){"use strict";var o=r(0),n=r(2),a=r(11),s=r(6),i=r(1)("species");e.exports=function(e){var t="function"==typeof n[e]?n[e]:o[e];s&&t&&!t[i]&&a.f(t,i,{configurable:!0,get:function(){return this}})}},function(e,t,r){var o=r(1)("iterator"),n=!1;try{var a=[7][o]();a["return"]=function(){n=!0},Array.from(a,function(){throw 2})}catch(t){}e.exports=function(e,t){if(!t&&!n)return!1;var r=!1;try{var a=[7],s=a[o]();s.next=function(){return{done:r=!0}},a[o]=function(){return s},e(a)}catch(t){}return r}},function(e,t,r){"use strict";var o=r(8),n=r(2),a=r(0),s=r(32),i=r(35);o(o.P+o.R,"Promise",{finally:function(t){var r=s(this,n.Promise||a.Promise),e="function"==typeof t;return this.then(e?function(e){return i(r,t()).then(function(){return e})}:t,e?function(o){return i(r,t()).then(function(){throw o})}:t)}})},function(e,t,r){"use strict";var o=r(8),n=r(22),a=r(34);o(o.S,"Promise",{try:function(e){var t=n.f(this),r=a(e);return(r.e?t.reject:t.resolve)(r.v),t.promise}})},function(e,t,r){(function(t,r){(function(t,r){e.exports=r()})(this,function(){"use strict";function e(e){var t=typeof e;return null!==e&&("object"==t||"function"==t)}function o(e){return"function"==typeof e}function n(){return"undefined"==typeof M?a():function(){M(s)}}function a(){var e=setTimeout;return function(){return e(s,1)}}function s(){for(var e=0;e<I;e+=2){var t=U[e],r=U[e+1];t(r),U[e]=void 0,U[e+1]=void 0}I=0}function l(e,t){var r=this,o=new this.constructor(p);void 0===o[W]&&k(o);var n=r._state;if(n){var a=arguments[n-1];F(function(){return E(n,o,a,r._result)})}else b(r,o,e,t);return o}function d(e){var t=this;if(e&&"object"==typeof e&&e.constructor===t)return e;var r=new t(p);return _(r,e),r}function p(){}function i(){return new TypeError("You cannot resolve a promise with itself")}function c(){return new TypeError("A promises callback cannot return that same promise.")}function u(e){try{return e.then}catch(e){return q.error=e,q}}function h(e,t,r,o){try{e.call(t,r,o)}catch(t){return t}}function m(e,t,r){F(function(e){var o=!1,n=h(r,t,function(r){o||(o=!0,t===r?x(e,r):_(e,r))},function(t){o||(o=!0,v(e,t))},"Settle: "+(e._label||" unknown promise"));!o&&n&&(o=!0,v(e,n))},e)}function g(e,t){t._state===K?x(e,t._result):t._state===$?v(e,t._result):b(t,void 0,function(t){return _(e,t)},function(t){return v(e,t)})}function y(e,t,r){t.constructor===e.constructor&&r===l&&t.constructor.resolve===d?g(e,t):r===q?(v(e,q.error),q.error=null):void 0===r?x(e,t):o(r)?m(e,t,r):x(e,t)}function _(t,r){t===r?v(t,i()):e(r)?y(t,r,u(r)):x(t,r)}function f(e){e._onerror&&e._onerror(e._result),S(e)}function x(e,t){e._state!==V||(e._result=t,e._state=K,0!==e._subscribers.length&&F(S,e))}function v(e,t){e._state!==V||(e._state=$,e._result=t,F(f,e))}function b(e,t,r,o){var n=e._subscribers,a=n.length;e._onerror=null,n[a]=t,n[a+K]=r,n[a+$]=o,0===a&&e._state&&F(S,e)}function S(e){var t=e._subscribers,r=e._state;if(0!==t.length){for(var o=void 0,n=void 0,a=e._result,s=0;s<t.length;s+=3)o=t[s],n=t[s+r],o?E(r,o,n,a):n(a);e._subscribers.length=0}}function O(e,t){try{return e(t)}catch(t){return q.error=t,q}}function E(e,t,r,n){var a,s,i,l,d=o(r);if(!d)a=n,i=!0;else if(a=O(r,n),a===q?(l=!0,s=a.error,a.error=null):i=!0,t===a)return void v(t,c());t._state!==V||(d&&i?_(t,a):l?v(t,s):e===K?x(t,a):e===$&&v(t,a))}function T(t,e){try{e(function(e){_(t,e)},function(e){v(t,e)})}catch(r){v(t,r)}}function P(){return z++}function k(e){e[W]=z++,e._state=void 0,e._result=void 0,e._subscribers=[]}function L(){return new Error("Array Methods must be provided an Array")}function w(){throw new TypeError("You must pass a resolver function as the first argument to the promise constructor")}function R(){throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.")}var j=Array.isArray?Array.isArray:function(e){return"[object Array]"===Object.prototype.toString.call(e)};var A=j,I=0,M=void 0,N=void 0,F=function(e,t){U[I]=e,U[I+1]=t,I+=2,2==I&&(N?N(s):B())},D="undefined"==typeof window?void 0:window,C=D||{},G=C.MutationObserver||C.WebKitMutationObserver,Y="undefined"==typeof self&&"undefined"!=typeof t&&"[object process]"==={}.toString.call(t),H="undefined"!=typeof Uint8ClampedArray&&"undefined"!=typeof importScripts&&"undefined"!=typeof MessageChannel,U=Array(1e3),B=void 0;B=Y?function(){return function(){return t.nextTick(s)}}():G?function(){var e=0,t=new G(s),r=document.createTextNode("");return t.observe(r,{characterData:!0}),function(){r.data=e=++e%2}}():H?function(){var e=new MessageChannel;return e.port1.onmessage=s,function(){return e.port2.postMessage(0)}}():void 0!==D||0?a():function(){try{var e=Function("return this")().require("vertx");return M=e.runOnLoop||e.runOnContext,n()}catch(t){return a()}}();var W=Math.random().toString(36).substring(2),V=void 0,K=1,$=2,q={error:null},z=0,Q=function(){function e(e,t){this._instanceConstructor=e,this.promise=new e(p),this.promise[W]||k(this.promise),A(t)?(this.length=t.length,this._remaining=t.length,this._result=Array(this.length),0===this.length?x(this.promise,this._result):(this.length=this.length||0,this._enumerate(t),0===this._remaining&&x(this.promise,this._result))):v(this.promise,L())}return e.prototype._enumerate=function(e){for(var t=0;this._state===V&&t<e.length;t++)this._eachEntry(e[t],t)},e.prototype._eachEntry=function(e,t){var r=this._instanceConstructor,o=r.resolve;if(o===d){var n=u(e);if(n===l&&e._state!==V)this._settledAt(e._state,t,e._result);else if("function"!=typeof n)this._remaining--,this._result[t]=e;else if(r===J){var a=new r(p);y(a,e,n),this._willSettleAt(a,t)}else this._willSettleAt(new r(function(t){return t(e)}),t)}else this._willSettleAt(o(e),t)},e.prototype._settledAt=function(e,t,r){var o=this.promise;o._state===V&&(this._remaining--,e===$?v(o,r):this._result[t]=r),0===this._remaining&&x(o,this._result)},e.prototype._willSettleAt=function(e,t){var r=this;b(e,void 0,function(e){return r._settledAt(K,t,e)},function(e){return r._settledAt($,t,e)})},e}(),J=function(){function e(t){this[W]=P(),this._result=this._state=void 0,this._subscribers=[],p!==t&&("function"!=typeof t&&w(),this instanceof e?T(this,t):R())}return e.prototype.catch=function(e){return this.then(null,e)},e.prototype.finally=function(e){var t=this,r=t.constructor;return o(e)?t.then(function(t){return r.resolve(e()).then(function(){return t})},function(t){return r.resolve(e()).then(function(){throw t})}):t.then(e,e)},e}();return J.prototype.then=l,J.all=function(e){return new Q(this,e).promise},J.race=function(e){var t=this;return A(e)?new t(function(r,o){for(var n=e.length,a=0;a<n;a++)t.resolve(e[a]).then(r,o)}):new t(function(e,t){return t(new TypeError("You must pass an array to race."))})},J.resolve=d,J.reject=function(e){var t=this,r=new t(p);return v(r,e),r},J._setScheduler=function(e){N=e},J._setAsap=function(e){F=e},J._asap=F,J.polyfill=function(){var e;if("undefined"!=typeof r)e=r;else if("undefined"!=typeof self)e=self;else try{e=Function("return this")()}catch(t){throw new Error("polyfill failed because global object is unavailable in this environment")}var t=e.Promise;if(t){var o=null;try{o=Object.prototype.toString.call(t.resolve())}catch(t){}if("[object Promise]"===o&&!t.cast)return}e.Promise=J},J.Promise=J,J})}).call(t,r(80),r(81))},function(e){function t(){throw new Error("setTimeout has not been defined")}function r(){throw new Error("clearTimeout has not been defined")}function o(e){if(c===setTimeout)return setTimeout(e,0);if((c===t||!c)&&setTimeout)return c=setTimeout,setTimeout(e,0);try{return c(e,0)}catch(t){try{return c.call(null,e,0)}catch(t){return c.call(this,e,0)}}}function n(e){if(d===clearTimeout)return clearTimeout(e);if((d===r||!d)&&clearTimeout)return d=clearTimeout,clearTimeout(e);try{return d(e)}catch(t){try{return d.call(null,e)}catch(t){return d.call(this,e)}}}function a(){m&&u&&(m=!1,u.length?h=u.concat(h):g=-1,h.length&&s())}function s(){if(!m){var e=o(a);m=!0;for(var t=h.length;t;){for(u=h,h=[];++g<t;)u&&u[g].run();g=-1,t=h.length}u=null,m=!1,n(e)}}function l(e,t){this.fun=e,this.array=t}function i(){}var c,d,p=e.exports={};(function(){try{c="function"==typeof setTimeout?setTimeout:t}catch(r){c=t}try{d="function"==typeof clearTimeout?clearTimeout:r}catch(t){d=r}})();var u,h=[],m=!1,g=-1;p.nextTick=function(e){var t=Array(arguments.length-1);if(1<arguments.length)for(var r=1;r<arguments.length;r++)t[r-1]=arguments[r];h.push(new l(e,t)),1!==h.length||m||o(s)},l.prototype.run=function(){this.fun.apply(null,this.array)},p.title="browser",p.browser=!0,p.env={},p.argv=[],p.version="",p.versions={},p.on=i,p.addListener=i,p.once=i,p.off=i,p.removeListener=i,p.removeAllListeners=i,p.emit=i,p.prependListener=i,p.prependOnceListener=i,p.listeners=function(){return[]},p.binding=function(){throw new Error("process.binding is not supported")},p.cwd=function(){return"/"},p.chdir=function(){throw new Error("process.chdir is not supported")},p.umask=function(){return 0}},function(e){var t=function(){return this}();try{t=t||Function("return this")()||(1,eval)("this")}catch(r){"object"==typeof window&&(t=window)}e.exports=t},function(e){function t(e,t){for(var r in t)e.setAttribute(r,t[r])}function r(e,t){e.onload=function(){this.onerror=this.onload=null,t(null,e)},e.onerror=function(){this.onerror=this.onload=null,t(new Error("Failed to load "+this.src),e)}}function o(e,t){e.onreadystatechange=function(){"complete"!=this.readyState&&"loaded"!=this.readyState||(this.onreadystatechange=null,t(null,e))}}e.exports=function(e,n,a){var s=document.head||document.getElementsByTagName("head")[0],i=document.createElement("script");"function"==typeof n&&(a=n,n={}),n=n||{},a=a||function(){},i.type=n.type||"text/javascript",i.charset=n.charset||"utf8",i.async=!("async"in n)||!!n.async,i.src=e,n.attrs&&t(i,n.attrs),n.text&&(i.text=""+n.text);var l="onload"in i?r:o;l(i,a),i.onload||r(i,a),s.appendChild(i)}},function(e,t,r){var o=r(84);e.exports=function(e,t){function r(e){return i.body?e():void o(function(){r(e)})}function n(){for(var e=0,t=-1,r=u.length;++t<r;)if(a(u[t].href)&&++e===r)return p(u);o(n)}function a(e){for(var t=-1,r=l.length;++t<r;)if(null!==l[t].href&&0!==l[t].href.length&&l[t].href===e)return!0}t||(t={}),"[object Function]"==={}.toString.call(t)&&(t={complete:t});var s,i=document,l=i.styleSheets,c="[object Array]"==={}.toString.call(e)?e:[e],d=t.media?t.media:"all",p=t.complete||function(){},u=[];if(t.before)s=t.before;else{var h=(i.body||i.getElementsByTagName("head")[0]).childNodes;s=h[h.length-1]}return r(function(){for(var e=-1,r=c.length,a=t.before?s:s.nextSibling;++e<r;)u[e]=i.createElement("link"),u[e].rel="stylesheet",u[e].href=c[e],u[e].media=d,s.parentNode.insertBefore(u[e],a);o(n)}),u}},function(e){e.exports=function(e){t.push(e),0==r&&(r=setTimeout(o,0))};var t=[],r=0,o=function(){var e=-1,o=t.length,n=t;for(t=[],r=0;++e<o;)n[e]()}},function(e,t,r){var o,n;(function(a,s,i){"undefined"!=typeof e&&e.exports?e.exports=i():(o=i,n="function"==typeof o?o.call(t,r,t,e):o,!(n!==void 0&&(e.exports=n)))})("urljoin",this,function(){function e(e){var t=[];if(e[0].match(/^[^/:]+:\/*$/)&&1<e.length){var r=e.shift();e[0]=r+e[0]}e[0]=e[0].match(/^file:\/\/\//)?e[0].replace(/^([^/:]+):\/*/,"$1:///"):e[0].replace(/^([^/:]+):\/*/,"$1://");for(var o,n=0;n<e.length;n++){if(o=e[n],"string"!=typeof o)throw new TypeError("Url must be a string. Received "+o);""!==o&&(0<n&&(o=o.replace(/^[\/]+/,"")),o=n<e.length-1?o.replace(/[\/]+$/,""):o.replace(/[\/]+$/,"/"),t.push(o))}var a=t.join("/");a=a.replace(/\/(\?|&|#[^!])/g,"$1");var s=a.split("?");return a=s.shift()+(0<s.length?"?":"")+s.join("&"),a}return function(){var t;return t="object"==typeof arguments[0]?arguments[0]:[].slice.call(arguments),e(t)}})},function(e,t,r){"use strict";var o=r(87);r.d(t,"a",function(){return o.a});var n=r(91);r.d(t,"c",function(){return n.a});var a=r(37);r.d(t,"d",function(){return a.a}),r.d(t,"e",function(){return a.b});var s=r(92);r.d(t,"b",function(){return s.a});r(93)},function(e,t,r){"use strict";t.a=function(e,t,r,o){var a={version:"6.2.0",packageName:"SprintrFeedbackWidget",widgetFolder:""},i=void 0,d=void 0,p=void 0;i=a.packageName,d=a.version,p=a.widgetFolder;var u=r,h=i+"."+(""===p?"":p+".")+e;u._WIDGET_VERSION=d,u._WIDGET_BASE_ID=h;var m=[];return"undefined"!=typeof o&&null!==o?c(o)?o.forEach(function(e){m.push(e)}):m.push(o):m.push(s.a),t&&(m.push(l.a),"boolean"!=typeof t&&(u.templateString=t)),n()(h,m,u)};var o=r(88),n=r.n(o),a=r(89),s=r.n(a),i=r(90),l=r.n(i),c=function(e){return Array.isArray?Array.isArray(e):"[object Array]"===Object.prototype.toString.call(e)}},function(e){e.exports=l},function(e){e.exports=c},function(e){e.exports=d},function(e,t,r){"use strict";r.d(t,"a",function(){return i});var o=r(14),n=r.n(o),a=r(36),s=r.n(a),i=function(e){var t=new n.a,r=s.a.mixin({callback:t.resolve,error:t.reject},e);try{mx.data.get(r)}catch(r){t.reject(r)}return t.promise}},function(e,t,r){"use strict";function o(e,t,r,o){var n=this;if(e){s.a.call(this,"execute microflow","mf: "+e+":"+t);var i={params:{actionname:e,applyto:"selection",guids:[]},callback:a.a.hitch(this,function(e){r&&"function"==typeof r&&r(e)}),error:a.a.hitch(this,function(t){o&&"function"==typeof o?o(t):(mx.ui.error("Error executing microflow "+e+" : "+t.message),console.error(n.id+"._execMf",t))})};t&&(i.params.guids=[t]),!mx.version||mx.version&&7>parseInt(mx.version.split(".")[0],10)?i.store={caller:this.mxform}:i.origin=this.mxform,mx.data.action(i,this)}}t.a=function(e,t){var r=new l.a;return o.call(this,e,t,r.resolve,r.reject),r.promise};var n=r(36),a=r.n(n),s=r(37),i=r(14),l=r.n(i)},function(e,t,r){"use strict";var o=r(94),n=r.n(o),a=r(95),s=r.n(a),i=r(96),l=r.n(i),c=r(97),d=r.n(c)},function(e){e.exports=o},function(e){e.exports=n},function(e){e.exports=a},function(e){e.exports=s},function(t){t.exports=e},function(e){e.exports=t}])});
},
'dojo/NodeList-traverse':function(){
define(["./query", "./_base/lang", "./_base/array"], function(dquery, lang, array){

// module:
//		dojo/NodeList-traverse

/*=====
return function(){
	// summary:
	//		Adds chainable methods to dojo/query() / NodeList instances for traversing the DOM
};
=====*/

var NodeList = dquery.NodeList;

lang.extend(NodeList, {
	_buildArrayFromCallback: function(/*Function*/ callback){
		// summary:
		//		builds a new array of possibly differing size based on the input list.
		//		Since the returned array is likely of different size than the input array,
		//		the array's map function cannot be used.
		var ary = [];
		for(var i = 0; i < this.length; i++){
			var items = callback.call(this[i], this[i], ary);
			if(items){
				ary = ary.concat(items);
			}
		}
		return ary;	//Array
	},

	_getUniqueAsNodeList: function(/*Array*/ nodes){
		// summary:
		//		given a list of nodes, make sure only unique
		//		elements are returned as our NodeList object.
		//		Does not call _stash().
		var ary = [];
		//Using for loop for better speed.
		for(var i = 0, node; node = nodes[i]; i++){
			//Should be a faster way to do this. dojo/query has a private
			//_zip function that may be inspirational, but there are pathways
			//in query that force nozip?
			if(node.nodeType == 1 && array.indexOf(ary, node) == -1){
				ary.push(node);
			}
		}
		return this._wrap(ary, null, this._NodeListCtor);	 // dojo/NodeList
	},

	_getUniqueNodeListWithParent: function(/*Array*/ nodes, /*String*/ query){
		// summary:
		//		gets unique element nodes, filters them further
		//		with an optional query and then calls _stash to track parent NodeList.
		var ary = this._getUniqueAsNodeList(nodes);
		ary = (query ? dquery._filterResult(ary, query) : ary);
		return ary._stash(this);  // dojo/NodeList
	},

	_getRelatedUniqueNodes: function(/*String?*/ query, /*Function*/ callback){
		// summary:
		//		cycles over all the nodes and calls a callback
		//		to collect nodes for a possible inclusion in a result.
		//		The callback will get two args: callback(node, ary),
		//		where ary is the array being used to collect the nodes.
		return this._getUniqueNodeListWithParent(this._buildArrayFromCallback(callback), query);  // dojo/NodeList
	},

	children: function(/*String?*/ query){
		// summary:
		//		Returns all immediate child elements for nodes in this dojo/NodeList.
		//		Optionally takes a query to filter the child elements.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// query:
		//		a CSS selector.
		// returns:
		//		all immediate child elements for the nodes in this dojo/NodeList.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red">Red One</div>
		// 	|		Some Text
		// 	|		<div class="blue">Blue One</div>
		// 	|		<div class="red">Red Two</div>
		// 	|		<div class="blue">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".container").children();
		//	|	});
		//		returns the four divs that are children of the container div.
		//		Running this code:
		//	|	dojo.query(".container").children(".red");
		//		returns the two divs that have the class "red".
		return this._getRelatedUniqueNodes(query, function(node, ary){
			return lang._toArray(node.childNodes);
		}); // dojo/NodeList
	},

	closest: function(/*String*/ query, /*String|DOMNode?*/ root){
		// summary:
		//		Returns closest parent that matches query, including current node in this
		//		dojo/NodeList if it matches the query.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// query:
		//		a CSS selector.
		// root:
		//		If specified, query is relative to "root" rather than document body.
		// returns:
		//		the closest parent that matches the query, including the current
		//		node in this dojo/NodeList if it matches the query.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		//	|		<div class="red">Red One</div>
		//	|		Some Text
		//	|		<div class="blue">Blue One</div>
		//	|		<div class="red">Red Two</div>
		//	|		<div class="blue">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".red").closest(".container");
		//	|	});
		//		returns the div with class "container".
		return this._getRelatedUniqueNodes(null, function(node, ary){
			do{
				if(dquery._filterResult([node], query, root).length){
					return node;
				}
			}while(node != root && (node = node.parentNode) && node.nodeType == 1);
			return null; //To make rhino strict checking happy.
		}); // dojo/NodeList
	},

	parent: function(/*String?*/ query){
		// summary:
		//		Returns immediate parent elements for nodes in this dojo/NodeList.
		//		Optionally takes a query to filter the parent elements.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// query:
		//		a CSS selector.
		// returns:
		//		immediate parent elements for nodes in this dojo/NodeList.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red">Red One</div>
		// 	|		<div class="blue first"><span class="text">Blue One</span></div>
		// 	|		<div class="red">Red Two</div>
		// 	|		<div class="blue"><span class="text">Blue Two</span></div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".text").parent();
		//	|	});
		//		returns the two divs with class "blue".
		//		Running this code:
		//	|		query(".text").parent(".first");
		//		returns the one div with class "blue" and "first".
		return this._getRelatedUniqueNodes(query, function(node, ary){
			return node.parentNode;
		}); // dojo/NodeList
	},

	parents: function(/*String?*/ query){
		// summary:
		//		Returns all parent elements for nodes in this dojo/NodeList.
		//		Optionally takes a query to filter the child elements.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// query:
		//		a CSS selector.
		// returns:
		//		all parent elements for nodes in this dojo/NodeList.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red">Red One</div>
		// 	|		<div class="blue first"><span class="text">Blue One</span></div>
		// 	|		<div class="red">Red Two</div>
		// 	|		<div class="blue"><span class="text">Blue Two</span></div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".text").parents();
		//	|	});
		//		returns the two divs with class "blue", the div with class "container",
		// 	|	the body element and the html element.
		//		Running this code:
		//	|		query(".text").parents(".container");
		//		returns the one div with class "container".
		return this._getRelatedUniqueNodes(query, function(node, ary){
			var pary = [];
			while(node.parentNode){
				node = node.parentNode;
				pary.push(node);
			}
			return pary;
		}); // dojo/NodeList
	},

	siblings: function(/*String?*/ query){
		// summary:
		//		Returns all sibling elements for nodes in this dojo/NodeList.
		//		Optionally takes a query to filter the sibling elements.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// query:
		//		a CSS selector.
		// returns:
		//		all sibling elements for nodes in this dojo/NodeList.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red">Red One</div>
		// 	|		Some Text
		// 	|		<div class="blue first">Blue One</div>
		// 	|		<div class="red">Red Two</div>
		// 	|		<div class="blue">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".first").siblings();
		//	|	});
		//		returns the two divs with class "red" and the other div
		// 	|	with class "blue" that does not have "first".
		//		Running this code:
		//	|		query(".first").siblings(".red");
		//		returns the two div with class "red".
		return this._getRelatedUniqueNodes(query, function(node, ary){
			var pary = [];
			var nodes = (node.parentNode && node.parentNode.childNodes);
			for(var i = 0; i < nodes.length; i++){
				if(nodes[i] != node){
					pary.push(nodes[i]);
				}
			}
			return pary;
		}); // dojo/NodeList
	},

	next: function(/*String?*/ query){
		// summary:
		//		Returns the next element for nodes in this dojo/NodeList.
		//		Optionally takes a query to filter the next elements.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// query:
		//		a CSS selector.
		// returns:
		//		the next element for nodes in this dojo/NodeList.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red">Red One</div>
		// 	|		Some Text
		// 	|		<div class="blue first">Blue One</div>
		// 	|		<div class="red">Red Two</div>
		// 	|		<div class="blue last">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".first").next();
		//	|	});
		//		returns the div with class "red" and has innerHTML of "Red Two".
		//		Running this code:
		//	|	dojo.query(".last").next(".red");
		//		does not return any elements.
		return this._getRelatedUniqueNodes(query, function(node, ary){
			var next = node.nextSibling;
			while(next && next.nodeType != 1){
				next = next.nextSibling;
			}
			return next;
		}); // dojo/NodeList
	},

	nextAll: function(/*String?*/ query){
		// summary:
		//		Returns all sibling elements that come after the nodes in this dojo/NodeList.
		//		Optionally takes a query to filter the sibling elements.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// query:
		//		a CSS selector.
		// returns:
		//		all sibling elements that come after the nodes in this dojo/NodeList.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red">Red One</div>
		// 	|		Some Text
		// 	|		<div class="blue first">Blue One</div>
		// 	|		<div class="red next">Red Two</div>
		// 	|		<div class="blue next">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".first").nextAll();
		//	|	});
		//		returns the two divs with class of "next".
		//		Running this code:
		//	|		query(".first").nextAll(".red");
		//		returns the one div with class "red" and innerHTML "Red Two".
		return this._getRelatedUniqueNodes(query, function(node, ary){
			var pary = [];
			var next = node;
			while((next = next.nextSibling)){
				if(next.nodeType == 1){
					pary.push(next);
				}
			}
			return pary;
		}); // dojo/NodeList
	},

	prev: function(/*String?*/ query){
		// summary:
		//		Returns the previous element for nodes in this dojo/NodeList.
		//		Optionally takes a query to filter the previous elements.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// query:
		//		a CSS selector.
		// returns:
		//		the previous element for nodes in this dojo/NodeList.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red">Red One</div>
		// 	|		Some Text
		// 	|		<div class="blue first">Blue One</div>
		// 	|		<div class="red">Red Two</div>
		// 	|		<div class="blue">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".first").prev();
		//	|	});
		//		returns the div with class "red" and has innerHTML of "Red One".
		//		Running this code:
		//	|		query(".first").prev(".blue");
		//		does not return any elements.
		return this._getRelatedUniqueNodes(query, function(node, ary){
			var prev = node.previousSibling;
			while(prev && prev.nodeType != 1){
				prev = prev.previousSibling;
			}
			return prev;
		}); // dojo/NodeList
	},

	prevAll: function(/*String?*/ query){
		// summary:
		//		Returns all sibling elements that come before the nodes in this dojo/NodeList.
		//		Optionally takes a query to filter the sibling elements.
		// description:
		//		The returned nodes will be in reverse DOM order -- the first node in the list will
		//		be the node closest to the original node/NodeList.
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// query:
		//		a CSS selector.
		// returns:
		//		all sibling elements that come before the nodes in this dojo/NodeList.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red prev">Red One</div>
		// 	|		Some Text
		// 	|		<div class="blue prev">Blue One</div>
		// 	|		<div class="red second">Red Two</div>
		// 	|		<div class="blue">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".second").prevAll();
		//	|	});
		//		returns the two divs with class of "prev".
		//		Running this code:
		//	|		query(".first").prevAll(".red");
		//		returns the one div with class "red prev" and innerHTML "Red One".
		return this._getRelatedUniqueNodes(query, function(node, ary){
			var pary = [];
			var prev = node;
			while((prev = prev.previousSibling)){
				if(prev.nodeType == 1){
					pary.push(prev);
				}
			}
			return pary;
		}); // dojo/NodeList
	},

	andSelf: function(){
		// summary:
		//		Adds the nodes from the previous dojo/NodeList to the current dojo/NodeList.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red prev">Red One</div>
		// 	|		Some Text
		// 	|		<div class="blue prev">Blue One</div>
		// 	|		<div class="red second">Red Two</div>
		// 	|		<div class="blue">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".second").prevAll().andSelf();
		//	|	});
		//		returns the two divs with class of "prev", as well as the div with class "second".
		return this.concat(this._parent);	// dojo/NodeList
	},

	//Alternate methods for the :first/:last/:even/:odd pseudos.
	first: function(){
		// summary:
		//		Returns the first node in this dojo/NodeList as a dojo/NodeList.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// returns:
		//		the first node in this dojo/NodeList
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red">Red One</div>
		// 	|		<div class="blue first">Blue One</div>
		// 	|		<div class="red">Red Two</div>
		// 	|		<div class="blue last">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".blue").first();
		//	|	});
		//		returns the div with class "blue" and "first".
		return this._wrap(((this[0] && [this[0]]) || []), this); // dojo/NodeList
	},

	last: function(){
		// summary:
		//		Returns the last node in this dojo/NodeList as a dojo/NodeList.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// returns:
		//		the last node in this dojo/NodeList
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="red">Red One</div>
		// 	|		<div class="blue first">Blue One</div>
		// 	|		<div class="red">Red Two</div>
		// 	|		<div class="blue last">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|	query(".blue").last();
		//	|	});
		//		returns the last div with class "blue",
		return this._wrap((this.length ? [this[this.length - 1]] : []), this); // dojo/NodeList
	},

	even: function(){
		// summary:
		//		Returns the even nodes in this dojo/NodeList as a dojo/NodeList.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// returns:
		//		the even nodes in this dojo/NodeList
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="interior red">Red One</div>
		// 	|		<div class="interior blue">Blue One</div>
		// 	|		<div class="interior red">Red Two</div>
		// 	|		<div class="interior blue">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".interior").even();
		//	|	});
		//		returns the two divs with class "blue"
		return this.filter(function(item, i){
			return i % 2 != 0;
		}); // dojo/NodeList
	},

	odd: function(){
		// summary:
		//		Returns the odd nodes in this dojo/NodeList as a dojo/NodeList.
		// description:
		//		.end() can be used on the returned dojo/NodeList to get back to the
		//		original dojo/NodeList.
		// returns:
		//		the odd nodes in this dojo/NodeList
		// example:
		//		assume a DOM created by this markup:
		//	|	<div class="container">
		// 	|		<div class="interior red">Red One</div>
		// 	|		<div class="interior blue">Blue One</div>
		// 	|		<div class="interior red">Red Two</div>
		// 	|		<div class="interior blue">Blue Two</div>
		//	|	</div>
		//		Running this code:
		//	|	require(["dojo/query", "dojo/NodeList-traverse"
		//	|	], function(query){
		//	|		query(".interior").odd();
		//	|	});
		//		returns the two divs with class "red"
		return this.filter(function(item, i){
			return i % 2 == 0;
		}); // dojo/NodeList
	}
});

return NodeList;
});

},
'*noref':1}});
define("widgets/widgets", [
"MicroflowTimer/widget/MicroflowTimer",
"SprintrFeedbackWidget/SprintrFeedback"
], function() {});
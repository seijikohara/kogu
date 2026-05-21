import{g as m,h as u}from"./src-n7QUociX.js";import{H as te,K as ee,U as se,a as ie,s as U,v as re,w as ae,x as w,y as ne}from"./chunk-CSCIHK7Q-SWmZnO1d.js";import{g as oe,s as le}from"./chunk-5ZQYHXKU-Dc1LPdfQ.js";import{t as ce}from"./chunk-55IACEB6-BExNOOT7.js";import{t as he}from"./chunk-2J33WTMH-BEdzHRbA.js";import{r as ue}from"./chunk-LZXEDZCA-Bht_GNZZ.js";var vt=(function(){var t=u(function(r,f,l,p){for(l=l||{},p=r.length;p--;l[r[p]]=f);return l},"o"),e=[1,2],o=[1,3],s=[1,4],d=[2,4],h=[1,9],y=[1,11],T=[1,16],a=[1,17],g=[1,18],k=[1,19],D=[1,33],x=[1,20],R=[1,21],c=[1,22],L=[1,23],v=[1,24],$=[1,26],I=[1,27],B=[1,28],Y=[1,29],et=[1,30],st=[1,31],it=[1,32],rt=[1,35],at=[1,36],nt=[1,37],ot=[1,38],j=[1,34],S=[1,4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],lt=[1,4,5,14,15,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,39,40,41,45,48,51,52,53,54,57],xt=[4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],gt={trace:u(function(){},"trace"),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,styleStatement:11,cssClassStatement:12,idStatement:13,DESCR:14,"-->":15,HIDE_EMPTY:16,scale:17,WIDTH:18,COMPOSIT_STATE:19,STRUCT_START:20,STRUCT_STOP:21,STATE_DESCR:22,AS:23,ID:24,FORK:25,JOIN:26,CHOICE:27,CONCURRENT:28,note:29,notePosition:30,NOTE_TEXT:31,direction:32,acc_title:33,acc_title_value:34,acc_descr:35,acc_descr_value:36,acc_descr_multiline_value:37,CLICK:38,STRING:39,HREF:40,classDef:41,CLASSDEF_ID:42,CLASSDEF_STYLEOPTS:43,DEFAULT:44,style:45,STYLE_IDS:46,STYLEDEF_STYLEOPTS:47,class:48,CLASSENTITY_IDS:49,STYLECLASS:50,direction_tb:51,direction_bt:52,direction_rl:53,direction_lr:54,eol:55,";":56,EDGE_STATE:57,STYLE_SEPARATOR:58,left_of:59,right_of:60,$accept:0,$end:1},terminals_:{2:"error",4:"SPACE",5:"NL",6:"SD",14:"DESCR",15:"-->",16:"HIDE_EMPTY",17:"scale",18:"WIDTH",19:"COMPOSIT_STATE",20:"STRUCT_START",21:"STRUCT_STOP",22:"STATE_DESCR",23:"AS",24:"ID",25:"FORK",26:"JOIN",27:"CHOICE",28:"CONCURRENT",29:"note",31:"NOTE_TEXT",33:"acc_title",34:"acc_title_value",35:"acc_descr",36:"acc_descr_value",37:"acc_descr_multiline_value",38:"CLICK",39:"STRING",40:"HREF",41:"classDef",42:"CLASSDEF_ID",43:"CLASSDEF_STYLEOPTS",44:"DEFAULT",45:"style",46:"STYLE_IDS",47:"STYLEDEF_STYLEOPTS",48:"class",49:"CLASSENTITY_IDS",50:"STYLECLASS",51:"direction_tb",52:"direction_bt",53:"direction_rl",54:"direction_lr",56:";",57:"EDGE_STATE",58:"STYLE_SEPARATOR",59:"left_of",60:"right_of"},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[9,5],[9,5],[10,3],[10,3],[11,3],[12,3],[32,1],[32,1],[32,1],[32,1],[55,1],[55,1],[13,1],[13,1],[13,3],[13,3],[30,1],[30,1]],performAction:u(function(f,l,p,E,_,i,F){var n=i.length-1;switch(_){case 3:return E.setRootDoc(i[n]),i[n];case 4:this.$=[];break;case 5:i[n]!="nl"&&(i[n-1].push(i[n]),this.$=i[n-1]);break;case 6:case 7:this.$=i[n];break;case 8:this.$="nl";break;case 12:this.$=i[n];break;case 13:const ht=i[n-1];ht.description=E.trimColon(i[n]),this.$=ht;break;case 14:this.$={stmt:"relation",state1:i[n-2],state2:i[n]};break;case 15:const ut=E.trimColon(i[n]);this.$={stmt:"relation",state1:i[n-3],state2:i[n-1],description:ut};break;case 19:this.$={stmt:"state",id:i[n-3],type:"default",description:"",doc:i[n-1]};break;case 20:var V=i[n],H=i[n-2].trim();if(i[n].match(":")){var J=i[n].split(":");V=J[0],H=[H,J[1]]}this.$={stmt:"state",id:V,type:"default",description:H};break;case 21:this.$={stmt:"state",id:i[n-3],type:"default",description:i[n-5],doc:i[n-1]};break;case 22:this.$={stmt:"state",id:i[n],type:"fork"};break;case 23:this.$={stmt:"state",id:i[n],type:"join"};break;case 24:this.$={stmt:"state",id:i[n],type:"choice"};break;case 25:this.$={stmt:"state",id:E.getDividerId(),type:"divider"};break;case 26:this.$={stmt:"state",id:i[n-1].trim(),note:{position:i[n-2].trim(),text:i[n].trim()}};break;case 29:this.$=i[n].trim(),E.setAccTitle(this.$);break;case 30:case 31:this.$=i[n].trim(),E.setAccDescription(this.$);break;case 32:this.$={stmt:"click",id:i[n-3],url:i[n-2],tooltip:i[n-1]};break;case 33:this.$={stmt:"click",id:i[n-3],url:i[n-1],tooltip:""};break;case 34:case 35:this.$={stmt:"classDef",id:i[n-1].trim(),classes:i[n].trim()};break;case 36:this.$={stmt:"style",id:i[n-1].trim(),styleClass:i[n].trim()};break;case 37:this.$={stmt:"applyClass",id:i[n-1].trim(),styleClass:i[n].trim()};break;case 38:E.setDirection("TB"),this.$={stmt:"dir",value:"TB"};break;case 39:E.setDirection("BT"),this.$={stmt:"dir",value:"BT"};break;case 40:E.setDirection("RL"),this.$={stmt:"dir",value:"RL"};break;case 41:E.setDirection("LR"),this.$={stmt:"dir",value:"LR"};break;case 44:case 45:this.$={stmt:"state",id:i[n].trim(),type:"default",description:""};break;case 46:this.$={stmt:"state",id:i[n-2].trim(),classes:[i[n].trim()],type:"default",description:""};break;case 47:this.$={stmt:"state",id:i[n-2].trim(),classes:[i[n].trim()],type:"default",description:""};break}},"anonymous"),table:[{3:1,4:e,5:o,6:s},{1:[3]},{3:5,4:e,5:o,6:s},{3:6,4:e,5:o,6:s},t([1,4,5,16,17,19,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],d,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:h,5:y,8:8,9:10,10:12,11:13,12:14,13:15,16:T,17:a,19:g,22:k,24:D,25:x,26:R,27:c,28:L,29:v,32:25,33:$,35:I,37:B,38:Y,41:et,45:st,48:it,51:rt,52:at,53:nt,54:ot,57:j},t(S,[2,5]),{9:39,10:12,11:13,12:14,13:15,16:T,17:a,19:g,22:k,24:D,25:x,26:R,27:c,28:L,29:v,32:25,33:$,35:I,37:B,38:Y,41:et,45:st,48:it,51:rt,52:at,53:nt,54:ot,57:j},t(S,[2,7]),t(S,[2,8]),t(S,[2,9]),t(S,[2,10]),t(S,[2,11]),t(S,[2,12],{14:[1,40],15:[1,41]}),t(S,[2,16]),{18:[1,42]},t(S,[2,18],{20:[1,43]}),{23:[1,44]},t(S,[2,22]),t(S,[2,23]),t(S,[2,24]),t(S,[2,25]),{30:45,31:[1,46],59:[1,47],60:[1,48]},t(S,[2,28]),{34:[1,49]},{36:[1,50]},t(S,[2,31]),{13:51,24:D,57:j},{42:[1,52],44:[1,53]},{46:[1,54]},{49:[1,55]},t(lt,[2,44],{58:[1,56]}),t(lt,[2,45],{58:[1,57]}),t(S,[2,38]),t(S,[2,39]),t(S,[2,40]),t(S,[2,41]),t(S,[2,6]),t(S,[2,13]),{13:58,24:D,57:j},t(S,[2,17]),t(xt,d,{7:59}),{24:[1,60]},{24:[1,61]},{23:[1,62]},{24:[2,48]},{24:[2,49]},t(S,[2,29]),t(S,[2,30]),{39:[1,63],40:[1,64]},{43:[1,65]},{43:[1,66]},{47:[1,67]},{50:[1,68]},{24:[1,69]},{24:[1,70]},t(S,[2,14],{14:[1,71]}),{4:h,5:y,8:8,9:10,10:12,11:13,12:14,13:15,16:T,17:a,19:g,21:[1,72],22:k,24:D,25:x,26:R,27:c,28:L,29:v,32:25,33:$,35:I,37:B,38:Y,41:et,45:st,48:it,51:rt,52:at,53:nt,54:ot,57:j},t(S,[2,20],{20:[1,73]}),{31:[1,74]},{24:[1,75]},{39:[1,76]},{39:[1,77]},t(S,[2,34]),t(S,[2,35]),t(S,[2,36]),t(S,[2,37]),t(lt,[2,46]),t(lt,[2,47]),t(S,[2,15]),t(S,[2,19]),t(xt,d,{7:78}),t(S,[2,26]),t(S,[2,27]),{5:[1,79]},{5:[1,80]},{4:h,5:y,8:8,9:10,10:12,11:13,12:14,13:15,16:T,17:a,19:g,21:[1,81],22:k,24:D,25:x,26:R,27:c,28:L,29:v,32:25,33:$,35:I,37:B,38:Y,41:et,45:st,48:it,51:rt,52:at,53:nt,54:ot,57:j},t(S,[2,32]),t(S,[2,33]),t(S,[2,21])],defaultActions:{5:[2,1],6:[2,2],47:[2,48],48:[2,49]},parseError:u(function(f,l){if(l.recoverable)this.trace(f);else{var p=new Error(f);throw p.hash=l,p}},"parseError"),parse:u(function(f){var l=this,p=[0],E=[],_=[null],i=[],F=this.table,n="",V=0,H=0,J=0,ht=2,ut=1,qt=i.slice.call(arguments,1),b=Object.create(this.lexer),M={yy:{}};for(var Tt in this.yy)Object.prototype.hasOwnProperty.call(this.yy,Tt)&&(M.yy[Tt]=this.yy[Tt]);b.setInput(f,M.yy),M.yy.lexer=b,M.yy.parser=this,typeof b.yylloc>"u"&&(b.yylloc={});var Et=b.yylloc;i.push(Et);var Qt=b.options&&b.options.ranges;typeof M.yy.parseError=="function"?this.parseError=M.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function Zt(N){p.length=p.length-2*N,_.length=_.length-N,i.length=i.length-N}u(Zt,"popStack");function Lt(){var N=E.pop()||b.lex()||ut;return typeof N!="number"&&(N instanceof Array&&(E=N,N=E.pop()),N=l.symbols_[N]||N),N}u(Lt,"lex");for(var C,_t,W,O,mt,z={},dt,P,It,ft;;){if(W=p[p.length-1],this.defaultActions[W]?O=this.defaultActions[W]:((C===null||typeof C>"u")&&(C=Lt()),O=F[W]&&F[W][C]),typeof O>"u"||!O.length||!O[0]){var bt="";ft=[];for(dt in F[W])this.terminals_[dt]&&dt>ht&&ft.push("'"+this.terminals_[dt]+"'");b.showPosition?bt="Parse error on line "+(V+1)+`:
`+b.showPosition()+`
Expecting `+ft.join(", ")+", got '"+(this.terminals_[C]||C)+"'":bt="Parse error on line "+(V+1)+": Unexpected "+(C==ut?"end of input":"'"+(this.terminals_[C]||C)+"'"),this.parseError(bt,{text:b.match,token:this.terminals_[C]||C,line:b.yylineno,loc:Et,expected:ft})}if(O[0]instanceof Array&&O.length>1)throw new Error("Parse Error: multiple actions possible at state: "+W+", token: "+C);switch(O[0]){case 1:p.push(C),_.push(b.yytext),i.push(b.yylloc),p.push(O[1]),C=null,_t?(C=_t,_t=null):(H=b.yyleng,n=b.yytext,V=b.yylineno,Et=b.yylloc,J>0&&J--);break;case 2:if(P=this.productions_[O[1]][1],z.$=_[_.length-P],z._$={first_line:i[i.length-(P||1)].first_line,last_line:i[i.length-1].last_line,first_column:i[i.length-(P||1)].first_column,last_column:i[i.length-1].last_column},Qt&&(z._$.range=[i[i.length-(P||1)].range[0],i[i.length-1].range[1]]),mt=this.performAction.apply(z,[n,H,V,M.yy,O[1],_,i].concat(qt)),typeof mt<"u")return mt;P&&(p=p.slice(0,-1*P*2),_=_.slice(0,-1*P),i=i.slice(0,-1*P)),p.push(this.productions_[O[1]][0]),_.push(z.$),i.push(z._$),It=F[p[p.length-2]][p[p.length-1]],p.push(It);break;case 3:return!0}}return!0},"parse")};gt.lexer=(function(){return{EOF:1,parseError:u(function(f,l){if(this.yy.parser)this.yy.parser.parseError(f,l);else throw new Error(f)},"parseError"),setInput:u(function(r,f){return this.yy=f||this.yy||{},this._input=r,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:u(function(){var r=this._input[0];return this.yytext+=r,this.yyleng++,this.offset++,this.match+=r,this.matched+=r,r.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),r},"input"),unput:u(function(r){var f=r.length,l=r.split(/(?:\r\n?|\n)/g);this._input=r+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-f),this.offset-=f;var p=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),l.length-1&&(this.yylineno-=l.length-1);var E=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:l?(l.length===p.length?this.yylloc.first_column:0)+p[p.length-l.length].length-l[0].length:this.yylloc.first_column-f},this.options.ranges&&(this.yylloc.range=[E[0],E[0]+this.yyleng-f]),this.yyleng=this.yytext.length,this},"unput"),more:u(function(){return this._more=!0,this},"more"),reject:u(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:u(function(r){this.unput(this.match.slice(r))},"less"),pastInput:u(function(){var r=this.matched.substr(0,this.matched.length-this.match.length);return(r.length>20?"...":"")+r.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:u(function(){var r=this.match;return r.length<20&&(r+=this._input.substr(0,20-r.length)),(r.substr(0,20)+(r.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:u(function(){var r=this.pastInput(),f=new Array(r.length+1).join("-");return r+this.upcomingInput()+`
`+f+"^"},"showPosition"),test_match:u(function(r,f){var l,p,E;if(this.options.backtrack_lexer&&(E={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(E.yylloc.range=this.yylloc.range.slice(0))),p=r[0].match(/(?:\r\n?|\n).*/g),p&&(this.yylineno+=p.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:p?p[p.length-1].length-p[p.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+r[0].length},this.yytext+=r[0],this.match+=r[0],this.matches=r,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(r[0].length),this.matched+=r[0],l=this.performAction.call(this,this.yy,this,f,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),l)return l;if(this._backtrack){for(var _ in E)this[_]=E[_];return!1}return!1},"test_match"),next:u(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var r,f,l,p;this._more||(this.yytext="",this.match="");for(var E=this._currentRules(),_=0;_<E.length;_++)if(l=this._input.match(this.rules[E[_]]),l&&(!f||l[0].length>f[0].length)){if(f=l,p=_,this.options.backtrack_lexer){if(r=this.test_match(l,E[_]),r!==!1)return r;if(this._backtrack){f=!1;continue}else return!1}else if(!this.options.flex)break}return f?(r=this.test_match(f,E[p]),r!==!1?r:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:u(function(){var f=this.next();return f||this.lex()},"lex"),begin:u(function(f){this.conditionStack.push(f)},"begin"),popState:u(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:u(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:u(function(f){return f=this.conditionStack.length-1-Math.abs(f||0),f>=0?this.conditionStack[f]:"INITIAL"},"topState"),pushState:u(function(f){this.begin(f)},"pushState"),stateStackSize:u(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:u(function(f,l,p,E){function _(){const i=l.yytext.indexOf("%%");if(i===0)return!1;if(i>0){const F=l.yytext.slice(0,i),n=l.yytext.slice(i);n&&f.lexer.unput(n),l.yytext=F}return!0}switch(u(_,"processId"),p){case 0:return 38;case 1:return 40;case 2:return 39;case 3:return 44;case 4:return 51;case 5:return 52;case 6:return 53;case 7:return 54;case 8:return 5;case 9:break;case 10:break;case 11:break;case 12:break;case 13:return this.pushState("SCALE"),17;case 14:return 18;case 15:this.popState();break;case 16:return this.begin("acc_title"),33;case 17:return this.popState(),"acc_title_value";case 18:return this.begin("acc_descr"),35;case 19:return this.popState(),"acc_descr_value";case 20:this.begin("acc_descr_multiline");break;case 21:this.popState();break;case 22:return"acc_descr_multiline_value";case 23:return this.pushState("CLASSDEF"),41;case 24:return this.popState(),this.pushState("CLASSDEFID"),"DEFAULT_CLASSDEF_ID";case 25:return this.popState(),this.pushState("CLASSDEFID"),42;case 26:return this.popState(),43;case 27:return this.pushState("CLASS"),48;case 28:return this.popState(),this.pushState("CLASS_STYLE"),49;case 29:return this.popState(),50;case 30:return this.pushState("STYLE"),45;case 31:return this.popState(),this.pushState("STYLEDEF_STYLES"),46;case 32:return this.popState(),47;case 33:return this.pushState("SCALE"),17;case 34:return 18;case 35:this.popState();break;case 36:this.pushState("STATE");break;case 37:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),25;case 38:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),26;case 39:return this.popState(),l.yytext=l.yytext.slice(0,-10).trim(),27;case 40:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),25;case 41:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),26;case 42:return this.popState(),l.yytext=l.yytext.slice(0,-10).trim(),27;case 43:return 51;case 44:return 52;case 45:return 53;case 46:return 54;case 47:this.pushState("STATE_STRING");break;case 48:return this.pushState("STATE_ID"),"AS";case 49:return _()?(this.popState(),"ID"):void 0;case 50:this.popState();break;case 51:return"STATE_DESCR";case 52:return 19;case 53:this.popState();break;case 54:return this.popState(),this.pushState("struct"),20;case 55:return this.popState(),21;case 56:break;case 57:return this.begin("NOTE"),29;case 58:return this.popState(),this.pushState("NOTE_ID"),59;case 59:return this.popState(),this.pushState("NOTE_ID"),60;case 60:this.popState(),this.pushState("FLOATING_NOTE");break;case 61:return this.popState(),this.pushState("FLOATING_NOTE_ID"),"AS";case 62:break;case 63:return"NOTE_TEXT";case 64:return _()?(this.popState(),"ID"):void 0;case 65:return _()?(this.popState(),this.pushState("NOTE_TEXT"),24):void 0;case 66:return this.popState(),l.yytext=l.yytext.substr(2).trim(),31;case 67:return this.popState(),l.yytext=l.yytext.slice(0,-8).trim(),31;case 68:return 6;case 69:return 6;case 70:return 16;case 71:return 57;case 72:return _()?24:void 0;case 73:return l.yytext=l.yytext.trim(),14;case 74:return 15;case 75:return 28;case 76:return 58;case 77:return 5;case 78:return"INVALID"}},"anonymous"),rules:[/^(?:click\b)/i,/^(?:href\b)/i,/^(?:"[^"]*")/i,/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:style\s+)/i,/^(?:[\w,]+\s+)/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?\n\s*end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:(?:[^:\n;]|:[^:\n;])+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[10,11,12],inclusive:!1},struct:{rules:[10,11,12,23,27,30,36,43,44,45,46,55,56,57,71,72,73,74,75,76],inclusive:!1},FLOATING_NOTE_ID:{rules:[64],inclusive:!1},FLOATING_NOTE:{rules:[61,62,63],inclusive:!1},NOTE_TEXT:{rules:[66,67],inclusive:!1},NOTE_ID:{rules:[65],inclusive:!1},NOTE:{rules:[58,59,60],inclusive:!1},STYLEDEF_STYLEOPTS:{rules:[],inclusive:!1},STYLEDEF_STYLES:{rules:[32],inclusive:!1},STYLE_IDS:{rules:[],inclusive:!1},STYLE:{rules:[31],inclusive:!1},CLASS_STYLE:{rules:[29],inclusive:!1},CLASS:{rules:[28],inclusive:!1},CLASSDEFID:{rules:[26],inclusive:!1},CLASSDEF:{rules:[24,25],inclusive:!1},acc_descr_multiline:{rules:[21,22],inclusive:!1},acc_descr:{rules:[19],inclusive:!1},acc_title:{rules:[17],inclusive:!1},SCALE:{rules:[14,15,34,35],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[49],inclusive:!1},STATE_STRING:{rules:[50,51],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[10,11,12,37,38,39,40,41,42,47,48,52,53,54],inclusive:!1},ID:{rules:[10,11,12],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,9,11,12,13,16,18,20,23,27,30,33,36,54,57,68,69,70,71,72,73,74,76,77,78],inclusive:!0}}}})();function ct(){this.yy={}}return u(ct,"Parser"),ct.prototype=gt,gt.Parser=ct,new ct})();vt.parser=vt;var Pe=vt,de="TB",Yt="TB",Ot="dir",X="state",K="root",Ct="relation",fe="classDef",pe="style",Se="applyClass",Z="default",Gt="divider",Ft="fill:none",Vt="fill: #333",Mt="c",Wt="markdown",Ut="normal",kt="rect",Dt="rectWithTitle",ye="stateStart",ge="stateEnd",Nt="divider",Rt="roundedWithTitle",Te="note",Ee="noteGroup",tt="statediagram",_e=`${tt}-state`,jt="transition",me="note",be=`${jt} note-edge`,ke=`${tt}-${me}`,De=`${tt}-cluster`,ve=`${tt}-cluster-alt`,Ht="parent",zt="note",Ce="state",At="----",Ae=`${At}${zt}`,wt=`${At}${Ht}`,Kt=u((t,e=Yt)=>{if(!t.doc)return e;let o=e;for(const s of t.doc)s.stmt==="dir"&&(o=s.value);return o},"getDir"),Be={getClasses:u(function(t,e){return e.db.getClasses()},"getClasses"),draw:u(async function(t,e,o,s){m.info("REF0:"),m.info("Drawing state diagram (v2)",e);const{securityLevel:d,state:h,layout:y}=w();s.db.extract(s.db.getRootDocV2());const T=s.db.getData(),a=ce(e,d);T.type=s.type,T.layoutAlgorithm=y,T.nodeSpacing=h?.nodeSpacing||50,T.rankSpacing=h?.rankSpacing||50,w().look==="neo"?T.markers=["barbNeo"]:T.markers=["barb"],T.diagramId=e,await ue(T,a);const g=8;try{(typeof s.db.getLinks=="function"?s.db.getLinks():new Map).forEach((k,D)=>{const x=typeof D=="string"?D:typeof D?.id=="string"?D.id:"";if(!x){m.warn("⚠️ Invalid or missing stateId from key:",JSON.stringify(D));return}const R=a.node()?.querySelectorAll("g");let c;if(R?.forEach(I=>{I.textContent?.trim()===x&&(c=I)}),!c){m.warn("⚠️ Could not find node matching text:",x);return}const L=c.parentNode;if(!L){m.warn("⚠️ Node has no parent, cannot wrap:",x);return}const v=document.createElementNS("http://www.w3.org/2000/svg","a"),$=k.url.replace(/^"+|"+$/g,"");if(v.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",$),v.setAttribute("target","_blank"),k.tooltip){const I=k.tooltip.replace(/^"+|"+$/g,"");v.setAttribute("title",I)}L.replaceChild(v,c),v.appendChild(c),m.info("🔗 Wrapped node in <a> tag for:",x,k.url)})}catch(k){m.error("❌ Error injecting clickable links:",k)}oe.insertTitle(a,"statediagramTitleText",h?.titleTopMargin??25,s.db.getDiagramTitle()),he(a,g,tt,h?.useMaxWidth??!0)},"draw"),getDir:Kt},St=new Map,G=0;function yt(t="",e=0,o="",s=At){return`${Ce}-${t}${o!==null&&o.length>0?`${s}${o}`:""}-${e}`}u(yt,"stateDomId");var xe=u((t,e,o,s,d,h,y,T)=>{m.trace("items",e),e.forEach(a=>{switch(a.stmt){case X:Q(t,a,o,s,d,h,y,T);break;case Z:Q(t,a,o,s,d,h,y,T);break;case Ct:{Q(t,a.state1,o,s,d,h,y,T),Q(t,a.state2,o,s,d,h,y,T);const g=y==="neo",k={id:"edge"+G,start:a.state1.id,end:a.state2.id,arrowhead:"normal",arrowTypeEnd:g?"arrow_barb_neo":"arrow_barb",style:Ft,labelStyle:"",label:U.sanitizeText(a.description??"",w()),arrowheadStyle:Vt,labelpos:Mt,labelType:Wt,thickness:Ut,classes:jt,look:y};d.push(k),G++}break}})},"setupDoc"),$t=u((t,e=Yt)=>{let o=e;if(t.doc)for(const s of t.doc)s.stmt==="dir"&&(o=s.value);return o},"getDir");function q(t,e,o){if(!e.id||e.id==="</join></fork>"||e.id==="</choice>")return;e.cssClasses&&(Array.isArray(e.cssCompiledStyles)||(e.cssCompiledStyles=[]),e.cssClasses.split(" ").forEach(d=>{const h=o.get(d);h&&(e.cssCompiledStyles=[...e.cssCompiledStyles??[],...h.styles])}));const s=t.find(d=>d.id===e.id);s?Object.assign(s,e):t.push(e)}u(q,"insertOrUpdateNode");function Xt(t){return t?.classes?.join(" ")??""}u(Xt,"getClassesFromDbInfo");function Jt(t){return t?.styles??[]}u(Jt,"getStylesFromDbInfo");var Q=u((t,e,o,s,d,h,y,T)=>{const a=e.id,g=o.get(a),k=Xt(g),D=Jt(g),x=w();if(m.info("dataFetcher parsedItem",e,g,D),a!=="root"){let R=kt;e.start===!0?R=ye:e.start===!1&&(R=ge),e.type!==Z&&(R=e.type),St.get(a)||St.set(a,{id:a,shape:R,description:U.sanitizeText(a,x),cssClasses:`${k} ${_e}`,cssStyles:D});const c=St.get(a);e.description&&(Array.isArray(c.description)?(c.shape=Dt,c.description.push(e.description)):c.description?.length&&c.description.length>0?(c.shape=Dt,c.description===a?c.description=[e.description]:c.description=[c.description,e.description]):(c.shape=kt,c.description=e.description),c.description=U.sanitizeTextOrArray(c.description,x)),c.description?.length===1&&c.shape===Dt&&(c.type==="group"?c.shape=Rt:c.shape=kt),!c.type&&e.doc&&(m.info("Setting cluster for XCX",a,$t(e)),c.type="group",c.isGroup=!0,c.dir=$t(e),c.shape=e.type===Gt?Nt:Rt,c.cssClasses=`${c.cssClasses} ${De} ${h?ve:""}`);const L={labelStyle:"",shape:c.shape,label:c.description,cssClasses:c.cssClasses,cssCompiledStyles:[],cssStyles:c.cssStyles,id:a,dir:c.dir,domId:yt(a,G),type:c.type,isGroup:c.type==="group",padding:8,rx:10,ry:10,look:y,labelType:"markdown"};if(L.shape===Nt&&(L.label=""),t&&t.id!=="root"&&(m.trace("Setting node ",a," to be child of its parent ",t.id),L.parentId=t.id),L.centerLabel=!0,e.note){const v={labelStyle:"",shape:Te,label:e.note.text,labelType:"markdown",cssClasses:ke,cssStyles:[],cssCompiledStyles:[],id:a+Ae+"-"+G,domId:yt(a,G,zt),type:c.type,isGroup:c.type==="group",padding:x.flowchart?.padding,look:y,position:e.note.position},$=a+wt,I={labelStyle:"",shape:Ee,label:e.note.text,cssClasses:c.cssClasses,cssStyles:[],id:a+wt,domId:yt(a,G,Ht),type:"group",isGroup:!0,padding:16,look:y,position:e.note.position};G++,I.id=$,v.parentId=$,q(s,I,T),q(s,v,T),q(s,L,T);let B=a,Y=v.id;e.note.position==="left of"&&(B=v.id,Y=a),d.push({id:B+"-"+Y,start:B,end:Y,arrowhead:"none",arrowTypeEnd:"",style:Ft,labelStyle:"",classes:be,arrowheadStyle:Vt,labelpos:Mt,labelType:Wt,thickness:Ut,look:y})}else q(s,L,T)}e.doc&&(m.trace("Adding nodes children "),xe(e,e.doc,o,s,d,!h,y,T))},"dataFetcher"),Le=u(()=>{St.clear(),G=0},"reset"),A={START_NODE:"[*]",START_TYPE:"start",END_NODE:"[*]",END_TYPE:"end",COLOR_KEYWORD:"color",FILL_KEYWORD:"fill",BG_FILL:"bgFill",STYLECLASS_SEP:","},Pt=u(()=>new Map,"newClassesList"),Bt=u(()=>({relations:[],states:new Map,documents:{}}),"newDoc"),pt=u(t=>JSON.parse(JSON.stringify(t)),"clone"),Ye=class{constructor(t){this.version=t,this.nodes=[],this.edges=[],this.rootDoc=[],this.classes=Pt(),this.documents={root:Bt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.dividerCnt=0,this.links=new Map,this.getAccTitle=ne,this.setAccTitle=se,this.getAccDescription=re,this.setAccDescription=te,this.setDiagramTitle=ee,this.getDiagramTitle=ae,this.clear(),this.setRootDoc=this.setRootDoc.bind(this),this.getDividerId=this.getDividerId.bind(this),this.setDirection=this.setDirection.bind(this),this.trimColon=this.trimColon.bind(this)}static#t=u(this,"StateDB");static#e=this.relationType={AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3};extract(t){this.clear(!0);for(const s of Array.isArray(t)?t:t.doc)switch(s.stmt){case X:this.addState(s.id.trim(),s.type,s.doc,s.description,s.note);break;case Ct:this.addRelation(s.state1,s.state2,s.description);break;case fe:this.addStyleClass(s.id.trim(),s.classes);break;case pe:this.handleStyleDef(s);break;case Se:this.setCssClass(s.id.trim(),s.styleClass);break;case"click":this.addLink(s.id,s.url,s.tooltip);break}const e=this.getStates(),o=w();Le(),Q(void 0,this.getRootDocV2(),e,this.nodes,this.edges,!0,o.look,this.classes);for(const s of this.nodes)if(Array.isArray(s.label)){if(s.description=s.label.slice(1),s.isGroup&&s.description.length>0)throw new Error(`Group nodes can only have label. Remove the additional description for node [${s.id}]`);s.label=s.label[0]}}handleStyleDef(t){const e=t.id.trim().split(","),o=t.styleClass.split(",");for(const s of e){let d=this.getState(s);if(!d){const h=s.trim();this.addState(h),d=this.getState(h)}d&&(d.styles=o.map(h=>h.replace(/;/g,"")?.trim()))}}setRootDoc(t){m.info("Setting root doc",t),this.rootDoc=t,this.version===1?this.extract(t):this.extract(this.getRootDocV2())}docTranslator(t,e,o){if(e.stmt===Ct){this.docTranslator(t,e.state1,!0),this.docTranslator(t,e.state2,!1);return}if(e.stmt===X&&(e.id===A.START_NODE?(e.id=t.id+(o?"_start":"_end"),e.start=o):e.id=e.id.trim()),e.stmt!==K&&e.stmt!==X||!e.doc)return;const s=[];let d=[];for(const h of e.doc)if(h.type===Gt){const y=pt(h);y.doc=pt(d),s.push(y),d=[]}else d.push(h);if(s.length>0&&d.length>0){const h={stmt:X,id:le(),type:"divider",doc:pt(d)};s.push(pt(h)),e.doc=s}e.doc.forEach(h=>this.docTranslator(e,h,!0))}getRootDocV2(){return this.docTranslator({id:K,stmt:K},{id:K,stmt:K,doc:this.rootDoc},!0),{id:K,doc:this.rootDoc}}addState(t,e=Z,o=void 0,s=void 0,d=void 0,h=void 0,y=void 0,T=void 0){const a=t?.trim();if(!this.currentDocument.states.has(a))m.info("Adding state ",a,s),this.currentDocument.states.set(a,{stmt:X,id:a,descriptions:[],type:e,doc:o,note:d,classes:[],styles:[],textStyles:[]});else{const g=this.currentDocument.states.get(a);if(!g)throw new Error(`State not found: ${a}`);g.doc||(g.doc=o),g.type||(g.type=e)}if(s&&(m.info("Setting state description",a,s),(Array.isArray(s)?s:[s]).forEach(g=>this.addDescription(a,g.trim()))),d){const g=this.currentDocument.states.get(a);if(!g)throw new Error(`State not found: ${a}`);g.note=d,g.note.text=U.sanitizeText(g.note.text,w())}h&&(m.info("Setting state classes",a,h),(Array.isArray(h)?h:[h]).forEach(g=>this.setCssClass(a,g.trim()))),y&&(m.info("Setting state styles",a,y),(Array.isArray(y)?y:[y]).forEach(g=>this.setStyle(a,g.trim()))),T&&(m.info("Setting state styles",a,y),(Array.isArray(T)?T:[T]).forEach(g=>this.setTextStyle(a,g.trim())))}clear(t){this.nodes=[],this.edges=[],this.documents={root:Bt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.classes=Pt(),t||(this.links=new Map,ie())}getState(t){return this.currentDocument.states.get(t)}getStates(){return this.currentDocument.states}logDocuments(){m.info("Documents = ",this.documents)}getRelations(){return this.currentDocument.relations}addLink(t,e,o){this.links.set(t,{url:e,tooltip:o}),m.warn("Adding link",t,e,o)}getLinks(){return this.links}startIdIfNeeded(t=""){return t===A.START_NODE?(this.startEndCount++,`${A.START_TYPE}${this.startEndCount}`):t}startTypeIfNeeded(t="",e=Z){return t===A.START_NODE?A.START_TYPE:e}endIdIfNeeded(t=""){return t===A.END_NODE?(this.startEndCount++,`${A.END_TYPE}${this.startEndCount}`):t}endTypeIfNeeded(t="",e=Z){return t===A.END_NODE?A.END_TYPE:e}addRelationObjs(t,e,o=""){const s=this.startIdIfNeeded(t.id.trim()),d=this.startTypeIfNeeded(t.id.trim(),t.type),h=this.startIdIfNeeded(e.id.trim()),y=this.startTypeIfNeeded(e.id.trim(),e.type);this.addState(s,d,t.doc,t.description,t.note,t.classes,t.styles,t.textStyles),this.addState(h,y,e.doc,e.description,e.note,e.classes,e.styles,e.textStyles),this.currentDocument.relations.push({id1:s,id2:h,relationTitle:U.sanitizeText(o,w())})}addRelation(t,e,o){if(typeof t=="object"&&typeof e=="object")this.addRelationObjs(t,e,o);else if(typeof t=="string"&&typeof e=="string"){const s=this.startIdIfNeeded(t.trim()),d=this.startTypeIfNeeded(t),h=this.endIdIfNeeded(e.trim()),y=this.endTypeIfNeeded(e);this.addState(s,d),this.addState(h,y),this.currentDocument.relations.push({id1:s,id2:h,relationTitle:o?U.sanitizeText(o,w()):void 0})}}addDescription(t,e){const o=this.currentDocument.states.get(t),s=e.startsWith(":")?e.replace(":","").trim():e;o?.descriptions?.push(U.sanitizeText(s,w()))}cleanupLabel(t){return t.startsWith(":")?t.slice(2).trim():t.trim()}getDividerId(){return this.dividerCnt++,`divider-id-${this.dividerCnt}`}addStyleClass(t,e=""){this.classes.has(t)||this.classes.set(t,{id:t,styles:[],textStyles:[]});const o=this.classes.get(t);e&&o&&e.split(A.STYLECLASS_SEP).forEach(s=>{const d=s.replace(/([^;]*);/,"$1").trim();if(RegExp(A.COLOR_KEYWORD).exec(s)){const h=d.replace(A.FILL_KEYWORD,A.BG_FILL).replace(A.COLOR_KEYWORD,A.FILL_KEYWORD);o.textStyles.push(h)}o.styles.push(d)})}getClasses(){return this.classes}setCssClass(t,e){t.split(",").forEach(o=>{let s=this.getState(o);if(!s){const d=o.trim();this.addState(d),s=this.getState(d)}s?.classes?.push(e)})}setStyle(t,e){this.getState(t)?.styles?.push(e)}setTextStyle(t,e){this.getState(t)?.textStyles?.push(e)}getDirectionStatement(){return this.rootDoc.find(t=>t.stmt===Ot)}getDirection(){return this.getDirectionStatement()?.value??de}setDirection(t){const e=this.getDirectionStatement();e?e.value=t:this.rootDoc.unshift({stmt:Ot,value:t})}trimColon(t){return t.startsWith(":")?t.slice(1).trim():t.trim()}getData(){const t=w();return{nodes:this.nodes,edges:this.edges,other:{},config:t,direction:Kt(this.getRootDocV2())}}getConfig(){return w().state}},Ge=u(t=>`
defs [id$="-barbEnd"] {
    fill: ${t.transitionColor};
    stroke: ${t.transitionColor};
  }
g.stateGroup text {
  fill: ${t.nodeBorder};
  stroke: none;
  font-size: 10px;
}
g.stateGroup text {
  fill: ${t.textColor};
  stroke: none;
  font-size: 10px;

}
g.stateGroup .state-title {
  font-weight: bolder;
  fill: ${t.stateLabelColor};
}

g.stateGroup rect {
  fill: ${t.mainBkg};
  stroke: ${t.nodeBorder};
}

g.stateGroup line {
  stroke: ${t.lineColor};
  stroke-width: ${t.strokeWidth||1};
}

.transition {
  stroke: ${t.transitionColor};
  stroke-width: ${t.strokeWidth||1};
  fill: none;
}

.stateGroup .composit {
  fill: ${t.background};
  border-bottom: 1px
}

.stateGroup .alt-composit {
  fill: #e0e0e0;
  border-bottom: 1px
}

.state-note {
  stroke: ${t.noteBorderColor};
  fill: ${t.noteBkgColor};

  text {
    fill: ${t.noteTextColor};
    stroke: none;
    font-size: 10px;
  }
}

.stateLabel .box {
  stroke: none;
  stroke-width: 0;
  fill: ${t.mainBkg};
  opacity: 0.5;
}

.edgeLabel .label rect {
  fill: ${t.labelBackgroundColor};
  opacity: 0.5;
}
.edgeLabel {
  background-color: ${t.edgeLabelBackground};
  p {
    background-color: ${t.edgeLabelBackground};
  }
  rect {
    opacity: 0.5;
    background-color: ${t.edgeLabelBackground};
    fill: ${t.edgeLabelBackground};
  }
  text-align: center;
}
.edgeLabel .label text {
  fill: ${t.transitionLabelColor||t.tertiaryTextColor};
}
.label div .edgeLabel {
  color: ${t.transitionLabelColor||t.tertiaryTextColor};
}

.stateLabel text {
  fill: ${t.stateLabelColor};
  font-size: 10px;
  font-weight: bold;
}

.node circle.state-start {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node .fork-join {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node circle.state-end {
  fill: ${t.innerEndBackground};
  stroke: ${t.background};
  stroke-width: 1.5
}
.end-state-inner {
  fill: ${t.compositeBackground||t.background};
  // stroke: ${t.background};
  stroke-width: 1.5
}

.node rect {
  fill: ${t.stateBkg||t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth||1}px;
}
.node polygon {
  fill: ${t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};;
  stroke-width: ${t.strokeWidth||1}px;
}
[id$="-barbEnd"] {
  fill: ${t.lineColor};
}

.statediagram-cluster rect {
  fill: ${t.compositeTitleBackground};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth||1}px;
}

.cluster-label, .nodeLabel {
  color: ${t.stateLabelColor};
  // line-height: 1;
}

.statediagram-cluster rect.outer {
  rx: 5px;
  ry: 5px;
}
.statediagram-state .divider {
  stroke: ${t.stateBorder||t.nodeBorder};
}

.statediagram-state .title-state {
  rx: 5px;
  ry: 5px;
}
.statediagram-cluster.statediagram-cluster .inner {
  fill: ${t.compositeBackground||t.background};
}
.statediagram-cluster.statediagram-cluster-alt .inner {
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.statediagram-cluster .inner {
  rx:0;
  ry:0;
}

.statediagram-state rect.basic {
  rx: 5px;
  ry: 5px;
}
.statediagram-state rect.divider {
  stroke-dasharray: 10,10;
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.note-edge {
  stroke-dasharray: 5;
}

.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}
.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}

.statediagram-note text {
  fill: ${t.noteTextColor};
}

.statediagram-note .nodeLabel {
  color: ${t.noteTextColor};
}
.statediagram .edgeLabel {
  color: red; // ${t.noteTextColor};
}

[id$="-dependencyStart"], [id$="-dependencyEnd"] {
  fill: ${t.lineColor};
  stroke: ${t.lineColor};
  stroke-width: ${t.strokeWidth||1};
}

.statediagramTitleText {
  text-anchor: middle;
  font-size: 18px;
  fill: ${t.textColor};
}

[data-look="neo"].statediagram-cluster rect {
  fill: ${t.mainBkg};
  stroke: ${t.useGradient?"url("+t.svgId+"-gradient)":t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth??1};
}
[data-look="neo"].statediagram-cluster rect.outer {
  rx: ${t.radius}px;
  ry: ${t.radius}px;
  filter: ${t.dropShadow?t.dropShadow.replace("url(#drop-shadow)",`url(${t.svgId}-drop-shadow)`):"none"}
}
`,"getStyles");export{Ge as i,Pe as n,Be as r,Ye as t};

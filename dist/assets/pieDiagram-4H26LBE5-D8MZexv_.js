import{t as Q}from"./mermaid-parser.core-CC-bJ6dU.js";import{g as z,h as f}from"./src-n7QUociX.js";import{H as Y,K as tt,U as et,a as at,c as rt,f as nt,v as it,w as ot,x as st,y as lt}from"./chunk-CSCIHK7Q-SWmZnO1d.js";import{t as ct}from"./ordinal-BW-jqwNU.js";import{n as y}from"./path-Cu570o1d.js";import{m as _}from"./dist-CxVFWVWx.js";import{t as I}from"./arc-BTeNk1FB.js";import{t as ut}from"./array-Dc87KkBX.js";import{i as dt,p as pt}from"./chunk-5ZQYHXKU-Dc1LPdfQ.js";import{t as ft}from"./chunk-WU5MYG2G-BTAN1w8N.js";import{t as gt}from"./chunk-4BX2VUAB-B8R2k3n1.js";function mt(t,a){return a<t?-1:a>t?1:a>=t?0:NaN}function ht(t){return t}function xt(){var t=ht,a=mt,g=null,s=y(0),l=y(_),S=y(0);function o(e){var n,c=(e=ut(e)).length,u,m,x=0,d=new Array(c),i=new Array(c),v=+s.apply(this,arguments),w=Math.min(_,Math.max(-_,l.apply(this,arguments)-v)),h,C=Math.min(Math.abs(w)/c,S.apply(this,arguments)),$=C*(w<0?-1:1),p;for(n=0;n<c;++n)(p=i[d[n]=n]=+t(e[n],n,e))>0&&(x+=p);for(a!=null?d.sort(function(A,D){return a(i[A],i[D])}):g!=null&&d.sort(function(A,D){return g(e[A],e[D])}),n=0,m=x?(w-c*$)/x:0;n<c;++n,v=h)u=d[n],p=i[u],h=v+(p>0?p*m:0)+$,i[u]={data:e[u],index:n,value:p,startAngle:v,endAngle:h,padAngle:C};return i}return o.value=function(e){return arguments.length?(t=typeof e=="function"?e:y(+e),o):t},o.sortValues=function(e){return arguments.length?(a=e,g=null,o):a},o.sort=function(e){return arguments.length?(g=e,a=null,o):g},o.startAngle=function(e){return arguments.length?(s=typeof e=="function"?e:y(+e),o):s},o.endAngle=function(e){return arguments.length?(l=typeof e=="function"?e:y(+e),o):l},o.padAngle=function(e){return arguments.length?(S=typeof e=="function"?e:y(+e),o):S},o}var B=nt.pie,F={sections:new Map,showData:!1,config:B},T=F.sections,W=F.showData,vt=structuredClone(B),U={getConfig:f(()=>structuredClone(vt),"getConfig"),clear:f(()=>{T=new Map,W=F.showData,at()},"clear"),setDiagramTitle:tt,getDiagramTitle:ot,setAccTitle:et,getAccTitle:lt,setAccDescription:Y,getAccDescription:it,addSection:f(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);T.has(t)||(T.set(t,a),z.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),getSections:f(()=>T,"getSections"),setShowData:f(t=>{W=t},"setShowData"),getShowData:f(()=>W,"getShowData")},yt=f((t,a)=>{gt(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),St={parse:f(async t=>{const a=await Q("pie",t);z.debug(a),yt(a,U)},"parse")},wt=f(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),At=f(t=>{const a=[...t.values()].reduce((s,l)=>s+l,0),g=[...t.entries()].map(([s,l])=>({label:s,value:l})).filter(s=>s.value/a*100>=1);return xt().value(s=>s.value).sort(null)(g)},"createPieArcs"),Ft={parser:St,db:U,renderer:{draw:f((t,a,g,s)=>{z.debug(`rendering pie chart
`+t);const l=s.db,S=st(),o=dt(l.getConfig(),S.pie),e=40,n=18,c=4,u=450,m=u,x=ft(a),d=x.append("g");d.attr("transform","translate("+m/2+","+u/2+")");const{themeVariables:i}=S;let[v]=pt(i.pieOuterStrokeWidth);v??=2;const w=o.textPosition,h=Math.min(m,u)/2-e,C=I().innerRadius(0).outerRadius(h),$=I().innerRadius(h*w).outerRadius(h*w);d.append("circle").attr("cx",0).attr("cy",0).attr("r",h+v/2).attr("class","pieOuterCircle");const p=l.getSections(),A=At(p),D=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12];let k=0;p.forEach(r=>{k+=r});const R=A.filter(r=>(r.data.value/k*100).toFixed(0)!=="0"),E=ct(D).domain([...p.keys()]);d.selectAll("mySlices").data(R).enter().append("path").attr("d",C).attr("fill",r=>E(r.data.label)).attr("class","pieCircle"),d.selectAll("mySlices").data(R).enter().append("text").text(r=>(r.data.value/k*100).toFixed(0)+"%").attr("transform",r=>"translate("+$.centroid(r)+")").style("text-anchor","middle").attr("class","slice");const V=d.append("text").text(l.getDiagramTitle()).attr("x",0).attr("y",-(u-50)/2).attr("class","pieTitleText"),G=[...p.entries()].map(([r,b])=>({label:r,value:b})),M=d.selectAll(".legend").data(G).enter().append("g").attr("class","legend").attr("transform",(r,b)=>{const P=n+c,Z=P*G.length/2,q=12*n,J=b*P-Z;return"translate("+q+","+J+")"});M.append("rect").attr("width",n).attr("height",n).style("fill",r=>E(r.label)).style("stroke",r=>E(r.label)),M.append("text").attr("x",n+c).attr("y",n-c).text(r=>l.getShowData()?`${r.label} [${r.value}]`:r.label);const j=Math.max(...M.selectAll("text").nodes().map(r=>r?.getBoundingClientRect().width??0)),H=m+e+n+c+j,L=V.node()?.getBoundingClientRect().width??0,K=m/2-L/2,X=m/2+L/2,N=Math.min(0,K),O=Math.max(H,X)-N;x.attr("viewBox",`${N} 0 ${O} ${u}`),rt(x,u,O,o.useMaxWidth)},"draw")},styles:wt};export{Ft as diagram};

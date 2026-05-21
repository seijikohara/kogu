import{t as $}from"./mermaid-parser.core-CC-bJ6dU.js";import{g as m,h as b}from"./src-n7QUociX.js";import{H as B,K as C,U as S,a as D,b as T,c as P,f as z,v as E,w as F,y as A}from"./chunk-CSCIHK7Q-SWmZnO1d.js";import{i as u}from"./chunk-5ZQYHXKU-Dc1LPdfQ.js";import{t as W}from"./chunk-WU5MYG2G-BTAN1w8N.js";import{t as _}from"./chunk-4BX2VUAB-B8R2k3n1.js";var N=z.packet,w=class{constructor(){this.packet=[],this.setAccTitle=S,this.getAccTitle=A,this.setDiagramTitle=C,this.getDiagramTitle=F,this.getAccDescription=E,this.setAccDescription=B}static#t=b(this,"PacketDB");getConfig(){const t=u({...N,...T().packet});return t.showBits&&(t.paddingY+=10),t}getPacket(){return this.packet}pushWord(t){t.length>0&&this.packet.push(t)}clear(){D(),this.packet=[]}},L=1e4,M=b((t,e)=>{_(t,e);let r=-1,o=[],n=1;const{bitsPerRow:l}=e.getConfig();for(let{start:a,end:i,bits:d,label:c}of t.blocks){if(a!==void 0&&i!==void 0&&i<a)throw new Error(`Packet block ${a} - ${i} is invalid. End must be greater than start.`);if(a??=r+1,a!==r+1)throw new Error(`Packet block ${a} - ${i??a} is not contiguous. It should start from ${r+1}.`);if(d===0)throw new Error(`Packet block ${a} is invalid. Cannot have a zero bit field.`);for(i??=a+(d??1)-1,d??=i-a+1,r=i,m.debug(`Packet block ${a} - ${r} with label ${c}`);o.length<=l+1&&e.getPacket().length<L;){const[p,s]=Y({start:a,end:i,bits:d,label:c},n,l);if(o.push(p),p.end+1===n*l&&(e.pushWord(o),o=[],n++),!s)break;({start:a,end:i,bits:d,label:c}=s)}}e.pushWord(o)},"populate"),Y=b((t,e,r)=>{if(t.start===void 0)throw new Error("start should have been set during first phase");if(t.end===void 0)throw new Error("end should have been set during first phase");if(t.start>t.end)throw new Error(`Block start ${t.start} is greater than block end ${t.end}.`);if(t.end+1<=e*r)return[t,void 0];const o=e*r-1,n=e*r;return[{start:t.start,end:o,label:t.label,bits:o-t.start},{start:n,end:t.end,label:t.label,bits:t.end-n}]},"getNextFittingBlock"),v={parser:{yy:void 0},parse:b(async t=>{const e=await $("packet",t),r=v.parser?.yy;if(!(r instanceof w))throw new Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");m.debug(e),M(e,r)},"parse")},H=b((t,e,r,o)=>{const n=o.db,l=n.getConfig(),{rowHeight:a,paddingY:i,bitWidth:d,bitsPerRow:c}=l,p=n.getPacket(),s=n.getDiagramTitle(),h=a+i,g=h*(p.length+1)-(s?0:a),f=d*c+2,k=W(e);k.attr("viewBox",`0 0 ${f} ${g}`),P(k,g,f,l.useMaxWidth);for(const[x,y]of p.entries())I(k,y,x,l);k.append("text").text(s).attr("x",f/2).attr("y",g-h/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),I=b((t,e,r,{rowHeight:o,paddingX:n,paddingY:l,bitWidth:a,bitsPerRow:i,showBits:d})=>{const c=t.append("g"),p=r*(o+l)+l;for(const s of e){const h=s.start%i*a+1,g=(s.end-s.start+1)*a-n;if(c.append("rect").attr("x",h).attr("y",p).attr("width",g).attr("height",o).attr("class","packetBlock"),c.append("text").attr("x",h+g/2).attr("y",p+o/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(s.label),!d)continue;const f=s.end===s.start,k=p-2;c.append("text").attr("x",h+(f?g/2:0)).attr("y",k).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",f?"middle":"start").text(s.start),f||c.append("text").attr("x",h+g).attr("y",k).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(s.end)}},"drawWord"),K={draw:H},O={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},J={parser:v,get db(){return new w},renderer:K,styles:b(({packet:t}={})=>{const e=u(O,t);return`
	.packetByte {
		font-size: ${e.byteFontSize};
	}
	.packetByte.start {
		fill: ${e.startByteColor};
	}
	.packetByte.end {
		fill: ${e.endByteColor};
	}
	.packetLabel {
		fill: ${e.labelColor};
		font-size: ${e.labelFontSize};
	}
	.packetTitle {
		fill: ${e.titleColor};
		font-size: ${e.titleFontSize};
	}
	.packetBlock {
		stroke: ${e.blockStrokeColor};
		stroke-width: ${e.blockStrokeWidth};
		fill: ${e.blockFillColor};
	}
	`},"styles")};export{J as diagram};

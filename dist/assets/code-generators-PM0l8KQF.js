import{n as fe,r as $e,t as _}from"./editor-DRNQ4hJw.js";import{i as L}from"./form-D2b_P5nY.js";import{t as ge}from"./shell-CbmJINin.js";import{Cn as he,D as je,Mt as Te,O as Se,Sn as Oe,Tn as ye,Ut as Pe,Yt as Ne,_n as Ae,in as M,jn as Ce,kt as De,nn as F,qt as xe,rn as _e,vn as Me,xn as Ee,y as K,z as we}from"./index-CqsOJUfj.js";import{n as Re,r as Le,t as U}from"./panel-Cco3KMYj.js";var c=Ce(ye(),1);function q(e){const r=Ee(),t=(0,c.useRef)(void 0);return Me(r.stores.location,a=>{const s=e?.select?e.select(a):a;if(e?.structuralSharing??r.options.defaultStructuralSharing){const n=he(t.current,s);return t.current=n,n}return s})}var Je=[["path",{d:"m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72",key:"ul74o6"}],["path",{d:"m14 7 3 3",key:"1r5n42"}],["path",{d:"M5 6v4",key:"ilb8ba"}],["path",{d:"M19 14v4",key:"blhpug"}],["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M7 8H3",key:"zfb6yr"}],["path",{d:"M21 16h-4",key:"1cnmox"}],["path",{d:"M11 3H9",key:"1obp7u"}]],Ct=_e("wand-sparkles",Je),v=Oe();function Dt({editorMode:e,input:r,onInputChange:t,placeholder1:a="Original...",placeholder2:s="Modified...",validate:n,compare:i,onStatsChange:o,findLineForPath:l,pasteFromClipboard:m,renderFormatSection:p,renderComparisonOptions:h,renderAdvancedOptions:N}){const[f,S]=(0,c.useState)(""),[A,y]=(0,c.useState)(!0),[$,C]=(0,c.useState)(null),u=(0,c.useMemo)(()=>r.trim()?n(r):{valid:null},[r,n]),O=(0,c.useMemo)(()=>f.trim()?n(f):{valid:null},[f,n]),T=(0,c.useMemo)(()=>u.valid===!0&&O.valid===!0?!0:u.valid===!1||O.valid===!1?!1:null,[u,O]),P=(0,c.useMemo)(()=>{if(!r.trim()||!f.trim())return{diffs:[],error:""};try{return{diffs:i(r,f),error:""}}catch(b){return{diffs:[],error:b instanceof Error?b.message:"Compare failed"}}},[r,f,i]),w=P.diffs,R=P.error,le=(0,c.useMemo)(()=>{if(!$||!l)return[];const b=l(r,$.path);return b?[{line:b,type:$.type}]:[]},[$,l,r]),ue=(0,c.useMemo)(()=>{if(!$||!l)return[];const b=l(f,$.path);return b?[{line:b,type:$.type}]:[]},[$,l,f]),ce=b=>{C(pe=>pe?.path===b.path?null:b)};(0,c.useEffect)(()=>{o?.({input:r,valid:T,error:R})},[r,T,R,o]);const de=()=>{const b=r;t(f),S(b)},me=async()=>{const b=await m();b&&t(b)},be=async()=>{const b=await m();b&&S(b)},ve=r.trim()!==""&&f.trim()!==""&&!R;return(0,v.jsxs)("div",{className:"flex flex-1 overflow-hidden",children:[(0,v.jsxs)(U,{show:A,onClose:()=>y(!1),onOpen:()=>y(!0),children:[p?.(),(0,v.jsx)(L,{title:"Actions",children:(0,v.jsxs)(we,{variant:"outline",size:"sm",className:"w-full gap-1.5 text-xs",onClick:de,children:[(0,v.jsx)(F,{className:"h-3.5 w-3.5"}),"Swap Left/Right"]})}),h?(0,v.jsx)(L,{title:"Comparison",children:h()}):null,N?(0,v.jsx)(L,{title:"Advanced",children:N()}):null,(0,v.jsx)(Le,{})]}),(0,v.jsxs)("div",{className:"flex min-h-0 flex-1 flex-col overflow-hidden",children:[(0,v.jsx)(K,{className:"h-full flex-1",left:(0,v.jsx)(_,{title:"Original",value:r,onChange:t,mode:"input",editorMode:e,placeholder:a,highlightLines:le,onPaste:me,onClear:()=>t("")}),right:(0,v.jsx)(_,{title:"Modified",value:f,onChange:S,mode:"input",editorMode:e,placeholder:s,highlightLines:ue,onPaste:be,onClear:()=>S("")})}),(0,v.jsx)(Re,{diffs:w,selectedDiff:$,onDiffClick:ce,checkIdentical:!0,hasContent:ve})]})]})}function xt({inputEditorMode:e,outputEditorMode:r,input:t,onInputChange:a,placeholder:s="Enter content here...",validate:n,convert:i,onStatsChange:o,copyToClipboard:l,pasteFromClipboard:m,outputTitle:p="Output",renderFormatSection:h,renderOptions:N}){const[f,S]=(0,c.useState)(!0),A=(0,c.useMemo)(()=>t.trim()?n(t):{valid:null},[t,n]),y=(0,c.useMemo)(()=>t.trim()?i(t):{output:"",error:""},[t,i]),$=y.output,C=y.error;(0,c.useEffect)(()=>{if(!o)return;const{valid:P,...w}=A;o({input:t,valid:P,error:C,...w})},[A,t,C,o]);const u=async()=>{const P=await m();P&&a(P)},O=()=>{a("")},T=()=>l($);return(0,v.jsxs)("div",{className:"flex flex-1 overflow-hidden",children:[(0,v.jsxs)(U,{show:f,onClose:()=>S(!1),onOpen:()=>S(!0),children:[h?.(),N?.()]}),(0,v.jsx)(K,{className:"h-full flex-1",left:(0,v.jsx)(_,{title:"Input",value:t,onChange:a,mode:"input",editorMode:e,placeholder:s,onPaste:u,onClear:O}),right:(0,v.jsx)(_,{title:p,value:$,mode:"readonly",editorMode:r,placeholder:"Converted output...",onCopy:T})})]})}var H=["format","query","compare","convert","schema","generate"],Y="format",ke="kogu:tab:",k=e=>e!=null&&H.includes(e),ze=e=>{if(!e||typeof window>"u")return null;try{const r=window.localStorage.getItem(`${ke}${e}`);if(r===null)return null;const t=JSON.parse(r);return typeof t=="string"&&k(t)?t:null}catch{return null}},Be=()=>({format:{input:"",valid:null,error:""},query:{input:"",valid:null,error:""},compare:{input:"",valid:null,error:""},convert:{input:"",valid:null,error:""},schema:{input:"",valid:null,error:""},generate:{input:"",valid:null,error:""}}),Ve=e=>{const{calculateStats:r,persistKey:t}=e,a=q({select:u=>u.pathname}),s=q({select:u=>u.searchStr}),n=Ae(),i=je(t??""),o=Se(u=>u.setActive),l=(0,c.useMemo)(()=>{const u=new URLSearchParams(s).get("tab");return k(u)?u:k(i)?i:ze(t)??Y},[s,i,t]),m=(0,c.useCallback)(u=>{t&&o(t,u),n({to:a,search:O=>{const T={...O};return u===Y?delete T.tab:T.tab=u,T},replace:!0,resetScroll:!1})},[a,n,t,o]),p=(0,c.useCallback)(u=>l===u,[l]),[h,N]=(0,c.useState)(""),[f,S]=(0,c.useState)(Be),A=f[l],y=(0,c.useMemo)(()=>Object.fromEntries(H.map(u=>[u,O=>S(T=>({...T,[u]:O}))])),[]),$=(0,c.useCallback)(u=>y[u],[y]),C=(0,c.useMemo)(()=>{const u=h.trim();if(!u)return null;try{return r(u)}catch{return null}},[h,r]);return(0,c.useEffect)(()=>{t&&o(t,l)},[t,l,o]),{tabSync:(0,c.useMemo)(()=>({activeTab:l,setActiveTab:m,isActive:p}),[l,m,p]),sharedInput:h,setSharedInput:N,currentStats:A,handleStatsChange:$,liveStats:C}},Ge=[{id:"format",label:"Format",icon:Te},{id:"query",label:"Query",icon:De},{id:"compare",label:"Compare",icon:Pe},{id:"convert",label:"Convert",icon:F},{id:"schema",label:"Schema",icon:xe},{id:"generate",label:"Generate",icon:Ne}];function _t({title:e,calculateStats:r,persistKey:t,renderStatusContent:a,renderTabContent:s}){const n=Ve({calculateStats:r,persistKey:t});(0,c.useEffect)(()=>{const o=document.title;return document.title=`${e} - Kogu`,()=>{document.title=o}},[e]);const i=o=>{n.tabSync.setActiveTab(o)};return(0,v.jsx)(ge,{layout:"tabbed",tabs:Ge,activeTab:n.tabSync.activeTab,onTabChange:i,valid:n.currentStats.valid,error:n.currentStats.error,statusContent:a?a(n.liveStats):null,renderTabContent:o=>s({tab:o,input:n.sharedInput,onInputChange:n.setSharedInput,onStatsChange:n.handleStatsChange(o)})})}var Mt=async e=>{if(e)try{await $e(e),M.success("Copied")}catch{M.error("Copy failed")}},Et=async()=>{try{const e=await fe();return M.success("Pasted"),e}catch{return M.error("Paste failed"),null}},Z=e=>e.replace(/[-_](.)/g,(r,t)=>t.toUpperCase()),x=e=>Z(e).replace(/^(.)/,(r,t)=>t.toUpperCase()),d=e=>Z(e).replace(/^(.)/,(r,t)=>t.toLowerCase()),W=e=>e.replace(/([A-Z])/g,"_$1").toLowerCase().replace(/^_/,"").replace(/-/g,"_"),J=e=>({name:e,isArray:!1,isObject:!1,isPrimitive:!0}),qe=(e,r)=>({name:e,isArray:!0,isObject:!1,isPrimitive:!1,arrayItemType:r}),Ye=(e,r)=>({name:e,isArray:!1,isObject:!0,isPrimitive:!1,children:r}),g=(e,r)=>{if(e===null)return J("null");if(Array.isArray(e)){const[t]=e;return qe(r,t!==void 0?g(t,`${r}Item`):J("any"))}return typeof e=="object"?Ye(r,Object.fromEntries(Object.entries(e).map(([t,a])=>[t,g(a,x(t))]))):J(typeof e)},z=e=>!e.isObject||!e.children?[]:Object.values(e.children).flatMap(r=>r.isObject?[...z(r),r]:r.isArray&&r.arrayItemType?.isObject?[...z(r.arrayItemType),r.arrayItemType]:[]),Fe=e=>z(e),Ke=(e,r)=>e.reduce(({seen:t,result:a},s)=>{const n=r(s);return t.has(n)?{seen:t,result:a}:{seen:t.add(n),result:[...a,s]}},{seen:new Set,result:[]}).result,j=(e,r)=>Ke([...Fe(e),e],t=>t.name).map(r),Ue={rootName:"Root",optionalProperties:!1,useRecords:!0,useNullableReferenceTypes:!0,useSystemTextJson:!0,useNewtonsoft:!1,generateDataContract:!1},He={string:"string",number:"double",boolean:"bool",null:"object"},X=(e,r)=>e.isArray&&e.arrayItemType?`List<${X(e.arrayItemType,r)}>`:e.isObject?e.name:He[e.name]??"object",Q=(e,r)=>{const t=X(e,r);return r.optionalProperties&&r.useNullableReferenceTypes?`${t}?`:t},I=(e,r,t,a="")=>[t.useSystemTextJson&&r!==e&&`${a}[JsonPropertyName("${e}")]`,t.useNewtonsoft&&r!==e&&`${a}[JsonProperty("${e}")]`,t.generateDataContract&&`${a}[DataMember(Name = "${e}")]`].filter(Boolean),Ze=(e,r)=>{if(!e.children)return"";const t=Object.entries(e.children).map(([a,s])=>{const n=x(a),i=I(a,n,r);return`    ${i.length>0?`${i.join(" ")} `:""}${Q(s,r)} ${n}`}).join(`,
`);return`${r.generateDataContract?`[DataContract]
`:""}public record ${e.name}(
${t}
);`},We=(e,r)=>{if(!e.children)return"";const t=Object.entries(e.children).map(([a,s])=>{const n=x(a),i=I(a,n,r,"    ");return`${i.length>0?`${i.join(`
`)}
`:""}    public ${Q(s,r)} ${n} { get; set; }`}).join(`

`);return`${r.generateDataContract?`[DataContract]
`:""}public class ${e.name}
{
${t}
}`},Xe=(e,r)=>!e.isObject||!e.children?"":r.useRecords?Ze(e,r):We(e,r),Qe=e=>["using System.Collections.Generic;",e.useSystemTextJson&&"using System.Text.Json.Serialization;",e.useNewtonsoft&&"using Newtonsoft.Json;",e.generateDataContract&&"using System.Runtime.Serialization;",e.useNullableReferenceTypes&&"",e.useNullableReferenceTypes&&"#nullable enable"].filter(r=>r!==!1),Ie={generate(e,r){const t=j(g(e,r.rootName),a=>Xe(a,r)).filter(Boolean).join(`

`);return`${Qe(r).join(`
`)}

${t}`},getDefaultOptions:()=>({...Ue})},er={rootName:"Root",optionalProperties:!1,usePointers:!1,omitEmpty:!0,useJsonTag:!0},rr={string:"string",number:"float64",boolean:"bool",null:"interface{}"},ee=(e,r)=>e.isArray&&e.arrayItemType?`[]${ee(e.arrayItemType,r)}`:e.isObject?r.usePointers?`*${e.name}`:e.name:rr[e.name]??"interface{}",tr=(e,r)=>r.useJsonTag?` \`json:"${r.omitEmpty?`${e},omitempty`:e}"\``:"",ar=(e,r)=>{if(!e.isObject||!e.children)return"";const t=Object.entries(e.children).map(([a,s])=>`	${x(a)} ${ee(s,r)}${tr(a,r)}`).join(`
`);return`type ${e.name} struct {
${t}
}`},nr={generate(e,r){return j(g(e,r.rootName),t=>ar(t,r)).filter(Boolean).join(`

`)},getDefaultOptions:()=>({...er})},sr={rootName:"Root",optionalProperties:!1,packageName:"com.example",classStyle:"record",serializationLibrary:"none",useValidation:!1,generateBuilder:!1,generateEquals:!0,useOptional:!1},ir={string:"String",number:"double",boolean:"boolean",null:"Object"},or={int:"Integer",long:"Long",double:"Double",float:"Float",boolean:"Boolean",byte:"Byte",short:"Short",char:"Character"},lr={jackson:e=>`    @JsonProperty("${e}")
`,gson:e=>`    @SerializedName("${e}")
`,moshi:e=>`    @Json(name = "${e}")
`},re=(e,r)=>e.isArray&&e.arrayItemType?`List<${te(e.arrayItemType,r)}>`:e.isObject?e.name:ir[e.name]??"Object",te=(e,r)=>{const t=re(e,r);return or[t]??t},D=(e,r)=>{const t=re(e,r);return r.useOptional&&r.optionalProperties?`Optional<${te(e,r)}>`:t},E=(e,r,t)=>e===r?"":lr[t]?.(e)??"",ae=(e,r)=>r?e.name==="string"?`    @NotBlank
`:e.isPrimitive?"":`    @NotNull
`:"",ur=(e,r)=>{if(!e.children)return"";const t=Object.entries(e.children).map(([a,s])=>{const n=d(a);return`${E(a,n,r.serializationLibrary)}    ${D(s,r)} ${n}`}).join(`,
`);return`public record ${e.name}(
${t}
) {}`},cr=(e,r)=>{if(!e.children)return"";const t=Object.entries(e.children).map(([a,s])=>{const n=d(a);return`${E(a,n,r.serializationLibrary)}${ae(s,r.useValidation)}    private ${D(s,r)} ${n};`}).join(`

`);return`${["@Data",...r.generateBuilder?["@Builder"]:[],"@NoArgsConstructor","@AllArgsConstructor"].join(`
`)}
public class ${e.name} {
${t}
}`},dr=(e,r)=>{if(!e.children)return"";const t=Object.entries(e.children).map(([a,s])=>{const n=d(a);return`${E(a,n,r.serializationLibrary)}    ${D(s,r)} ${n}();`}).join(`

`);return`@Value.Immutable
public interface ${e.name} {
${t}
}`},mr=(e,r)=>["",`    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ${e} that = (${e}) o;
        return ${r.map(t=>`Objects.equals(${t}, that.${t})`).join(` &&
               `)};
    }`,`    @Override
    public int hashCode() {
        return Objects.hash(${r.join(", ")});
    }`],br=(e,r)=>{if(!e.children)return"";const t=Object.entries(e.children),a=t.map(([o,l])=>{const m=d(o);return`${E(o,m,r.serializationLibrary)}${ae(l,r.useValidation)}    private ${D(l,r)} ${m};`}),s=t.flatMap(([o,l])=>{const m=d(o),p=D(l,r),h=x(m);return[`    public ${p} get${h}() {
        return ${m};
    }`,`    public void set${h}(${p} ${m}) {
        this.${m} = ${m};
    }`]}),n=t.map(([o])=>d(o)),i=r.generateEquals?mr(e.name,n):[];return`public class ${e.name} {
${[...a,"",...s,...i].join(`
`)}
}`},vr=(e,r)=>!e.isObject||!e.children?"":{record:()=>ur(e,r),lombok:()=>cr(e,r),immutables:()=>dr(e,r),pojo:()=>br(e,r)}[r.classStyle](),pr=e=>{const r=[];e.packageName&&r.push(`package ${e.packageName};`,""),r.push("import java.util.List;"),e.useOptional&&e.optionalProperties&&r.push("import java.util.Optional;"),e.generateEquals&&e.classStyle==="pojo"&&r.push("import java.util.Objects;");const t={jackson:"import com.fasterxml.jackson.annotation.JsonProperty;",gson:"import com.google.gson.annotations.SerializedName;",moshi:"import com.squareup.moshi.Json;"}[e.serializationLibrary];return t&&r.push(t),e.classStyle==="lombok"&&(r.push("import lombok.Data;","import lombok.NoArgsConstructor;","import lombok.AllArgsConstructor;"),e.generateBuilder&&r.push("import lombok.Builder;")),e.classStyle==="immutables"&&r.push("import org.immutables.value.Value;"),e.useValidation&&r.push("import javax.validation.constraints.NotNull;","import javax.validation.constraints.NotBlank;"),r},fr={generate(e,r){const t=j(g(e,r.rootName),a=>vr(a,r)).filter(Boolean).join(`

`);return`${pr(r).join(`
`)}

${t}`},getDefaultOptions:()=>({...sr})},$r={rootName:"Root",optionalProperties:!1,useClass:!0,useJSDoc:!0,useES6:!0,generateFactory:!1,generateValidator:!1},gr={string:"string",number:"number",boolean:"boolean",null:"null"},hr={string:"''",number:"0",boolean:"false"},jr={string:e=>`  if (typeof obj.${e} !== 'string') return false;`,number:e=>`  if (typeof obj.${e} !== 'number') return false;`,boolean:e=>`  if (typeof obj.${e} !== 'boolean') return false;`},V=e=>e.isArray&&e.arrayItemType?`Array<${V(e.arrayItemType)}>`:e.isObject?e.name:gr[e.name]??"*",Tr=e=>e.isArray?"[]":e.isObject?"null":hr[e.name]??"null",Sr=(e,r)=>["/**",` * @class ${e}`,...r.map(([t,a])=>` * @property {${V(a)}} ${d(t)}`)," */"],Or=(e,r)=>["/**",` * @typedef {Object} ${e}`,...r.map(([t,a])=>` * @property {${V(a)}} ${d(t)}`)," */"],yr=(e,r)=>{const t=d(e);return r.isArray?`  if (!Array.isArray(obj.${t})) return false;`:r.isObject?`  if (typeof obj.${t} !== 'object' || obj.${t} === null) return false;`:jr[r.name]?.(t)??""},Pr=e=>`/**
 * Validate a ${e} object
 * @param {Object} obj
 * @returns {boolean}
 */
`,Nr=(e,r,t)=>`${t?Pr(e):""}function is${e}(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
${r.map(([a,s])=>yr(a,s)).filter(Boolean).join(`
`)}
  return true;
}`,Ar=e=>`/**
 * Create a new ${e} instance
 * @returns {${e}}
 */
`,Cr=(e,r)=>{if(!e.isObject||!e.children)return[];const t=Object.entries(e.children),{name:a}=e,s=r.useJSDoc?`${Sr(a,t).join(`
`)}
`:"",n=t.map(([p])=>d(p)).join(", "),i=t.map(([p])=>`    this.${d(p)} = ${d(p)};`).join(`
`),o=r.useES6?`class ${a} {
  constructor(${n}) {
${i}
  }
}`:`function ${a}(${n}) {
${i}
}`,l=r.generateFactory?`${r.useJSDoc?Ar(a):""}function create${a}(${n}) {
  return new ${a}(${n});
}`:null,m=r.generateValidator?Nr(a,t,r.useJSDoc):null;return[`${s}${o}`,l,m].filter(p=>p!==null)},Dr=(e,r)=>{if(!e.isObject||!e.children)return"";const t=Object.entries(e.children),{name:a}=e,s=r.useJSDoc?`${Or(a,t).join(`
`)}
`:"",n=t.map(([i,o])=>`  ${d(i)}: ${Tr(o)},`).join(`
`);return`${s}${r.useES6?"const":"var"} ${a.toLowerCase()}Template = {
${n}
};`},xr=(e,r)=>{if(r.useClass)return Cr(e,r);const t=Dr(e,r);return t?[t]:[]},_r={generate(e,r){return j(g(e,r.rootName),t=>xr(t,r)).flat().join(`

`)},getDefaultOptions:()=>({...$r})},Mr={rootName:"Root",optionalProperties:!1,useDataClass:!0,serializationLibrary:"none",useDefaultValues:!1},Er={string:"String",number:"Double",boolean:"Boolean",null:"Any"},wr={string:'""',number:"0.0",boolean:"false"},Rr={kotlinx:e=>`@SerialName("${e}")`,gson:e=>`@SerializedName("${e}")`,moshi:e=>`@Json(name = "${e}")`,jackson:e=>`@JsonProperty("${e}")`},Lr={kotlinx:["import kotlinx.serialization.Serializable","import kotlinx.serialization.SerialName"],gson:["import com.google.gson.annotations.SerializedName"],moshi:["import com.squareup.moshi.Json"],jackson:["import com.fasterxml.jackson.annotation.JsonProperty"]},ne=e=>e.isArray&&e.arrayItemType?`List<${ne(e.arrayItemType)}>`:e.isObject?e.name:Er[e.name]??"Any",Jr=e=>e.isArray?"emptyList()":wr[e.name]??"null",kr=(e,r,t)=>r===e?null:Rr[t]?.(e)??null,zr=(e,r)=>{if(!e.isObject||!e.children)return"";const t=Object.entries(e.children).map(([a,s])=>{const n=d(a),i=ne(s),o=r.optionalProperties?`${i}?`:i,l=kr(a,n,r.serializationLibrary);return`${l?`${l}
    `:""}val ${n}: ${o}${r.useDefaultValues?` = ${Jr(s)}`:""}`}).join(`,
    `);return`${r.serializationLibrary==="kotlinx"?`@Serializable
`:""}${r.useDataClass?"data class":"class"} ${e.name}(
    ${t}
)`},Br={generate(e,r){const t=j(g(e,r.rootName),s=>zr(s,r)).filter(Boolean).join(`

`),a=Lr[r.serializationLibrary]??[];return`${a.length>0?`${a.join(`
`)}

`:""}${t}`},getDefaultOptions:()=>({...Mr})},Vr={rootName:"Root",optionalProperties:!1,useStrictTypes:!0,useReadonlyProperties:!1,useConstructorPromotion:!0,namespace:""},Gr={string:"string",number:"float",boolean:"bool",null:"mixed"},qr=e=>e.isArray?"array":e.isObject?e.name:Gr[e.name]??"mixed",B=(e,r)=>{const t=qr(e);return r.optionalProperties?`?${t}`:t},Yr=(e,r)=>{if(!e.children)return"";const t=Object.entries(e.children),a=r.useReadonlyProperties?"readonly ":"",s=t.map(([n,i],o)=>{const l=d(n);return`        public ${a}${B(i,r)} $${l}${o===t.length-1?"":","}`}).join(`
`);return`class ${e.name}
{
    public function __construct(
${s}
    ) {}
}`},Fr=(e,r)=>{if(!e.children)return"";const t=Object.entries(e.children),a=r.useReadonlyProperties?"readonly ":"",s=t.map(([i,o])=>{const l=d(i);return`    public ${a}${B(o,r)} $${l};`}).join(`
`),n=`    public function __construct(
        ${t.map(([i,o])=>`${B(o,r)} $${d(i)}`).join(`,
        `)}
    ) {
${t.map(([i])=>`        $this->${d(i)} = $${d(i)};`).join(`
`)}
    }`;return`class ${e.name}
{
${s}

${n}
}`},Kr=(e,r)=>!e.isObject||!e.children?"":r.useConstructorPromotion?Yr(e,r):Fr(e,r),Ur={generate(e,r){const t=j(g(e,r.rootName),a=>Kr(a,r)).filter(Boolean).join(`

`);return`${["<?php",...r.useStrictTypes?["","declare(strict_types=1);"]:[],...r.namespace?["",`namespace ${r.namespace};`]:[]].join(`
`)}

${t}`},getDefaultOptions:()=>({...Vr})},Hr={rootName:"Root",optionalProperties:!1,style:"dataclass",useFrozen:!1,useSlots:!1,useKwOnly:!1,useTotal:!0},Zr={string:"str",number:"float",boolean:"bool",null:"None"},G=(e,r)=>{const t=e.isArray&&e.arrayItemType?`list[${G(e.arrayItemType,!1)}]`:e.isObject?`'${e.name}'`:Zr[e.name]??"Any";return r?`${t} | None`:t},Wr=e=>{const r=[e.useFrozen&&"frozen=True",e.useSlots&&"slots=True",e.useKwOnly&&"kw_only=True"].filter(Boolean);return r.length>0?`@dataclass(${r.join(", ")})`:"@dataclass"},Xr=(e,r)=>{if(!e.isObject||!e.children)return"";const t=Object.entries(e.children).map(([a,s])=>`    ${W(a)}: ${G(s,r.optionalProperties)}${r.optionalProperties?" = None":""}`).join(`
`);return`${Wr(r)}
class ${e.name}:
${t}`},Qr=(e,r)=>{if(!e.isObject||!e.children)return"";const t=Object.entries(e.children).map(([s,n])=>{const i=G(n,!1);return`    ${s}: ${r.optionalProperties?`NotRequired[${i}]`:i}`}).join(`
`),a=r.useTotal?"":", total=False";return`class ${e.name}(TypedDict${a}):
${t}`},Ir=(e,r)=>`from dataclasses import dataclass

${j(e,t=>Xr(t,r)).filter(Boolean).join(`

`)}`,et=(e,r)=>`${r.optionalProperties?`from typing import TypedDict
from typing import NotRequired`:"from typing import TypedDict"}

${j(e,t=>Qr(t,r)).filter(Boolean).join(`

`)}`,rt={generate(e,r){const t=g(e,r.rootName);return r.style==="dataclass"?Ir(t,r):et(t,r)},getDefaultOptions:()=>({...Hr})},tt={rootName:"Root",optionalProperties:!1,deriveSerde:!0,deriveDebug:!0,deriveClone:!0,deriveDefault:!1,useBox:!1},at={string:"String",number:"f64",boolean:"bool",null:"Option<()>"},se=(e,r)=>e.isArray&&e.arrayItemType?`Vec<${se(e.arrayItemType,r)}>`:e.isObject?r.useBox?`Box<${e.name}>`:e.name:at[e.name]??"serde_json::Value",nt=e=>[e.deriveSerde&&["Serialize","Deserialize"],e.deriveDebug&&["Debug"],e.deriveClone&&["Clone"],e.deriveDefault&&["Default"]].filter(Boolean).flat(),st=(e,r,t)=>{const a=W(e),s=se(r,t),n=t.optionalProperties?`Option<${s}>`:s;return`${a!==e&&t.deriveSerde?`    #[serde(rename = "${e}")]
`:""}${t.optionalProperties&&t.deriveSerde?`    #[serde(skip_serializing_if = "Option::is_none")]
`:""}    pub ${a}: ${n},`},it=(e,r,t)=>{if(!e.isObject||!e.children)return"";const a=Object.entries(e.children).map(([s,n])=>st(s,n,r)).join(`
`);return`${t.length>0?`#[derive(${t.join(", ")})]
`:""}pub struct ${e.name} {
${a}
}`},ot={generate(e,r){const t=nt(r);return`${r.deriveSerde?`use serde::{Deserialize, Serialize};

`:""}${j(g(e,r.rootName),a=>it(a,r,t)).filter(Boolean).join(`

`)}`},getDefaultOptions:()=>({...tt})},lt={rootName:"Root",optionalProperties:!1,useStruct:!0,useCodingKeys:!0,useOptionalProperties:!1},ut={string:"String",number:"Double",boolean:"Bool",null:"Any"},ie=e=>e.isArray&&e.arrayItemType?`[${ie(e.arrayItemType)}]`:e.isObject?e.name:ut[e.name]??"Any",ct=(e,r)=>{const t=ie(e);return r.optionalProperties||r.useOptionalProperties?`${t}?`:t},dt=(e,r)=>r!==e?`        case ${r} = "${e}"`:`        case ${r}`,mt=(e,r)=>{if(!e.isObject||!e.children)return"";const t=Object.entries(e.children),a=t.map(([l,m])=>`    let ${d(l)}: ${ct(m,r)}`).join(`
`),s=t.some(([l])=>d(l)!==l),n=r.useCodingKeys&&s?`

    enum CodingKeys: String, CodingKey {
${t.map(([l])=>dt(l,d(l))).join(`
`)}
    }`:"",i=r.useStruct?"struct":"class",o=r.useStruct?"Codable":"Codable, Equatable";return`${i} ${e.name}: ${o} {
${a}${n}
}`},bt={generate(e,r){return j(g(e,r.rootName),t=>mt(t,r)).filter(Boolean).join(`

`)},getDefaultOptions:()=>({...lt})},vt={typescript:{value:"typescript",label:"TypeScript",extension:"ts",editorMode:"typescript"},javascript:{value:"javascript",label:"JavaScript",extension:"js",editorMode:"javascript"},go:{value:"go",label:"Go",extension:"go",editorMode:"go"},python:{value:"python",label:"Python",extension:"py",editorMode:"python"},rust:{value:"rust",label:"Rust",extension:"rs",editorMode:"rust"},java:{value:"java",label:"Java",extension:"java",editorMode:"java"},csharp:{value:"csharp",label:"C#",extension:"cs",editorMode:"csharp"},kotlin:{value:"kotlin",label:"Kotlin",extension:"kt",editorMode:"kotlin"},swift:{value:"swift",label:"Swift",extension:"swift",editorMode:"swift"},php:{value:"php",label:"PHP",extension:"php",editorMode:"php"}},wt=Object.values(vt),Rt=[{value:"dataclass",label:"dataclass",description:"@dataclass decorator"},{value:"typeddict",label:"TypedDict",description:"TypedDict class"}],Lt=[{value:"record",label:"Record (Java 16+)",description:"Immutable data class"},{value:"pojo",label:"POJO",description:"Traditional JavaBean"},{value:"lombok",label:"Lombok",description:"With @Data annotation"},{value:"immutables",label:"Immutables",description:"With @Value.Immutable"}],Jt=[{value:"none",label:"None",description:"No serialization annotations"},{value:"jackson",label:"Jackson",description:"@JsonProperty annotations"},{value:"gson",label:"Gson",description:"@SerializedName annotations"},{value:"moshi",label:"Moshi",description:"@Json annotations"}],kt=[{value:"none",label:"None",description:"No serialization annotations"},{value:"kotlinx",label:"Kotlinx Serialization",description:"@Serializable annotations"},{value:"gson",label:"Gson",description:"@SerializedName annotations"},{value:"moshi",label:"Moshi",description:"@Json annotations"},{value:"jackson",label:"Jackson",description:"@JsonProperty annotations"}],pt={rootName:"Root",optionalProperties:!1,useInterface:!0,useExport:!0,useReadonly:!1,strictNullChecks:!0},ft={string:"string",number:"number",boolean:"boolean"},oe=(e,r)=>e.isArray&&e.arrayItemType?`${oe(e.arrayItemType,r)}[]`:e.isObject?e.name:e.name==="null"?r.strictNullChecks?"null":"any":ft[e.name]??"unknown",$t=e=>/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(e),gt=e=>$t(e)?e:`'${e}'`,ht=(e,r,t)=>{const a=oe(r,t),s=t.optionalProperties&&t.strictNullChecks?`${a} | undefined`:a,n=t.useReadonly?"readonly ":"",i=t.optionalProperties?"?":"";return`  ${n}${gt(e)}${i}: ${s};`},jt=(e,r)=>{if(!e.isObject||!e.children)return"";const t=Object.entries(e.children).map(([i,o])=>ht(i,o,r)).join(`
`),a=r.useExport?"export ":"",s=r.useInterface?"interface":"type",n=r.useInterface?"":" =";return`${a}${s} ${e.name}${n} {
${t}
}`},Tt={generate(e,r){return j(g(e,r.rootName),t=>jt(t,r)).filter(Boolean).join(`

`)},getDefaultOptions:()=>({...pt})},St={typescript:Tt,javascript:_r,go:nr,python:rt,rust:ot,java:fr,csharp:Ie,kotlin:Br,swift:bt,php:Ur};function zt(e,r,t){return St[r].generate(e,t)}export{vt as a,Mt as c,xt as d,Dt as f,kt as i,Et as l,Lt as n,wt as o,Ct as p,Jt as r,Rt as s,zt as t,_t as u};
